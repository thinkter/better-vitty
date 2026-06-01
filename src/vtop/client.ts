import { VtopError, asVtopError, mapHttpStatus } from "./errors";

export interface VtopResponse {
  readonly url: string;
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
}

export interface VtopClientOptions {
  readonly fetchImpl?: typeof fetch;
  readonly baseUrl?: string;
}

interface StoredCookie {
  readonly name: string;
  readonly value: string;
  readonly path: string;
}

const DEFAULT_BASE_URL = "https://vtop.vit.ac.in";

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
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
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
      const eq = nameValue?.indexOf("=") ?? -1;
      if (!nameValue || eq <= 0) continue;
      const name = nameValue.slice(0, eq);
      const value = nameValue.slice(eq + 1);
      let path = "/";
      for (const attr of attrs) {
        const attrEq = attr.indexOf("=");
        if (attrEq > 0 && attr.slice(0, attrEq).toLowerCase() === "path") path = attr.slice(attrEq + 1) || "/";
      }
      this.cookies.set(name, { name, value, path });
    }
  }

  private async request(method: string, path: string, body?: string, headers?: HeadersInit, redirectDepth = 0): Promise<VtopResponse> {
    if (redirectDepth > 8) throw new VtopError("VTOP_UNAVAILABLE", "too many VTOP redirects");
    const url = this.absoluteUrl(path);
    const cookie = this.cookieHeader();
    const requestHeaders: Record<string, string> = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 BetterVitty/0.1 Expo",
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
        redirect: "manual",
      };
      if (body !== undefined) init.body = body;
      response = await this.fetchImpl(url, init);
    } catch (error) {
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
