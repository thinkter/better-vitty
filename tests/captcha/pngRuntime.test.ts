import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ONE_PIXEL_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const originalTextDecoder = globalThis.TextDecoder;

class ReactNativeLikeTextDecoder extends originalTextDecoder {
  constructor(label?: string, options?: TextDecoderOptions) {
    if (label?.toLowerCase() === "latin1") {
      throw new RangeError("TextDecoder does not support latin1");
    }
    super(label, options);
  }
}

describe("PNG decoding on React Native-like runtimes", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.TextDecoder = ReactNativeLikeTextDecoder as typeof TextDecoder;
  });

  afterEach(() => {
    globalThis.TextDecoder = originalTextDecoder;
  });

  it("imports the captcha solver package without latin1 TextDecoder support", async () => {
    await expect(import("@better-vitty/captcha-solver")).resolves.toHaveProperty("decodeImage");
  });

  it("decodes PNG captcha images without latin1 TextDecoder support", async () => {
    const { decodeImage } = await import("@better-vitty/captcha-solver");

    const decoded = decodeImage(ONE_PIXEL_PNG_DATA_URI);

    expect(decoded.width).toBe(1);
    expect(decoded.height).toBe(1);
    expect(Array.from(decoded.data)).toEqual([0, 255, 0, 127]);
  });
});
