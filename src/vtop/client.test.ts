import { describe, expect, it } from "vitest";
import { VtopClient } from "./client";
import { VtopError } from "./errors";

function response(body: string, init: ResponseInit & { url?: string } = {}): Response {
  const res = new Response(body, init);
  Object.defineProperty(res, "url", { value: init.url ?? "https://vtop.vit.ac.in/vtop/content" });
  return res;
}

describe("VtopClient", () => {
  it("stores cookies and follows redirects manually", async () => {
    const seenCookies: string[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      seenCookies.push(new Headers(init?.headers).get("cookie") ?? "");
      const href = String(url);
      if (href.endsWith("/start")) {
        return response("", {
          status: 302,
          headers: { location: "/next", "set-cookie": "JSESSIONID=abc; Path=/vtop; HttpOnly" },
          url: href,
        });
      }
      return response("ok", {
        status: 200,
        headers: { "set-cookie": "SERVERID=s1; Path=/" },
        url: href,
      });
    };

    const client = new VtopClient({ fetchImpl, baseUrl: "https://vtop.vit.ac.in" });
    const res = await client.get("/start");
    expect(res.text).toBe("ok");
    expect(seenCookies).toEqual(["", "JSESSIONID=abc"]);
    expect(client.cookieHeader()).toContain("JSESSIONID=abc");
    expect(client.cookieHeader()).toContain("SERVERID=s1");
  });

  it("sends browser-like request headers without Expo identifiers", async () => {
    let headers = new Headers();
    const client = new VtopClient({
      fetchImpl: async (_url, init) => {
        headers = new Headers(init?.headers);
        return response("ok");
      },
    });

    await client.get("/vtop/login");

    expect(headers.get("user-agent")).toBe(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    );
    expect(headers.get("user-agent")?.toLowerCase()).not.toContain("expo");
    expect(headers.get("accept")).toContain("text/html");
    expect(headers.get("accept-language")).toBe("en-US,en;q=0.9");
    expect(headers.get("upgrade-insecure-requests")).toBe("1");
  });

  it("maps HTTP blocking responses to typed VTOP errors", async () => {
    const client = new VtopClient({
      fetchImpl: async () => response("blocked", { status: 403 }),
    });
    await expect(client.get("/vtop/content")).rejects.toMatchObject({ code: "VTOP_UNAVAILABLE" } satisfies Partial<VtopError>);
  });

  it("maps thrown fetch failures to network unavailable", async () => {
    const client = new VtopClient({
      fetchImpl: async () => {
        throw new TypeError("Network request failed");
      },
    });
    await expect(client.get("/vtop/content")).rejects.toMatchObject({ code: "NETWORK_UNAVAILABLE" } satisfies Partial<VtopError>);
  });
});
