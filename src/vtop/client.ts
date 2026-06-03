import { BROWSER_HEADERS, DEFAULT_VTOP_BASE_URL } from "../lib/vtopConstants";
import type { StoredCookie, VtopClientOptions, VtopResponse } from "../lib/vtopTypes";
import { VtopError, asVtopError, mapHttpStatus } from "./errors";
export type { VtopClientOptions, VtopResponse } from "../lib/vtopTypes";

const NETWORK_RETRY_DELAYS_MS = [350, 900] as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function splitSetCookie(header: string): string[] {
  const values: string[] = [];
  let start = 0;
  let inExpires = false;
  for (let i = 0; i < header.length; i += 1) {
    const c = header[i];
    if (c === "," && !inExpires) {
      values.push(header.slice(start, i).trim());
      start = i + 1;
      continue;
    }
    if (header.slice(i, i + 8).toLowerCase() === "expires=") inExpires = true;
    if (inExpires && c === ";") inExpires = false;
  }
  values.push(header.slice(start).trim());
  return values.filter(Boolean);
}

function headerGet(headers: Headers, name: string): string | null {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? headers.get(name.toUpperCase());
}

export class VtopClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly cookies = new Map<string, StoredCookie>();

  constructor(options: VtopClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? DEFAULT_VTOP_BASE_URL).replace(/\/$/, "");
  }

  clearSession(): void {
    this.cookies.clear();
  }

  cookieHeader(): string {
    return Array.from(this.cookies.values()).map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  }

  async get(path: string, headers?: HeadersInit): Promise<VtopResponse> {
    return this.request("GET", path, undefined, headers);
  }

  async postForm(path: string, form: Record<string, string | number | boolean>, headers?: HeadersInit): Promise<VtopResponse> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) body.append(key, String(value));
    return this.request("POST", path, body.toString(), {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      ...headers,
    });
  }

  private absoluteUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  private storeCookies(headers: Headers): void {
    const raw = headerGet(headers, "set-cookie");
    if (!raw) return;
    for (const cookieText of splitSetCookie(raw)) {
      const parts = cookieText.split(";").map((part) => part.trim());
      const [nameValue, ...attrs] = parts;
      if (!nameValue) continue;
      const [name, ...valueParts] = nameValue.split("=");
      if (!name || valueParts.length === 0) continue;
      const value = valueParts.join("=");
      let path = "/";
      for (const attr of attrs) {
        const [attrName, ...attrValueParts] = attr.split("=");
        if (attrName?.toLowerCase() === "path" && attrValueParts.length > 0) path = attrValueParts.join("=") || "/";
      }
      this.cookies.set(name, { name, value, path });
    }
  }

  private async request(
    method: string,
    path: string,
    body?: string,
    headers?: HeadersInit,
    redirectDepth = 0,
    networkAttempt = 0,
  ): Promise<VtopResponse> {
    if (redirectDepth > 8) throw new VtopError("VTOP_UNAVAILABLE", "too many VTOP redirects");
    const url = this.absoluteUrl(path);
    const cookie = this.cookieHeader();
    const requestHeaders: Record<string, string> = {
      ...BROWSER_HEADERS,
      ...(cookie ? { Cookie: cookie } : {}),
    };
    if (headers) {
      const normalized = new Headers(headers);
      normalized.forEach((value, key) => {
        requestHeaders[key] = value;
      });
    }

    let response: Response;
    try {
      const init: RequestInit = {
        method,
        headers: requestHeaders,
        credentials: "omit",
        redirect: "manual",
      };
      if (body !== undefined) init.body = body;
      response = await this.fetchImpl(url, init);
    } catch (error) {
      const retryDelay = NETWORK_RETRY_DELAYS_MS[networkAttempt];
      if (method === "GET" && retryDelay !== undefined) {
        await delay(retryDelay);
        return this.request(method, path, body, headers, redirectDepth, networkAttempt + 1);
      }
      throw asVtopError(error);
    }

    this.storeCookies(response.headers);
    const location = headerGet(response.headers, "location");
    if (location && response.status >= 300 && response.status < 400) {
      return this.request("GET", location, undefined, undefined, redirectDepth + 1);
    }

    const mapped = mapHttpStatus(response.status);
    if (mapped) throw mapped;
    const text = await response.text();
    return { url: response.url || url, status: response.status, headers: response.headers, text };
  }
}
