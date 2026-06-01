import { describe, expect, it } from "vitest";
import { extractDataUriParts } from "@better-vitty/captcha-solver";

describe("captcha data URI parsing", () => {
  it("accepts PNG and JPEG base64 data URIs", () => {
    expect(extractDataUriParts("data:image/png;base64,AAAA")).toEqual({ mimeType: "image/png", base64: "AAAA" });
    expect(extractDataUriParts("data:image/jpeg;base64,BBBB")).toEqual({ mimeType: "image/jpeg", base64: "BBBB" });
  });

  it("rejects non-data-URI captcha input", () => {
    expect(extractDataUriParts("/captcha.jpg")).toBeNull();
  });
});
