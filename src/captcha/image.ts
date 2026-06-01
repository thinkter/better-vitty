import { Buffer } from "buffer";
import * as jpeg from "jpeg-js";
import { PNG } from "pngjs";

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
}

export interface DataUriParts {
  readonly mimeType: string;
  readonly base64: string;
}

export function extractDataUriParts(dataUri: string): DataUriParts | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUri.trim());
  if (!match?.[1] || !match[2]) return null;
  return { mimeType: match[1].toLowerCase(), base64: match[2] };
}

export function decodeBase64(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export function decodeImage(dataUri: string): DecodedImage {
  const parts = extractDataUriParts(dataUri);
  if (!parts) throw new Error("invalid captcha data URI");

  const bytes = decodeBase64(parts.base64);
  if (parts.mimeType === "image/png") {
    const decoded = PNG.sync.read(Buffer.from(bytes));
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }

  if (parts.mimeType === "image/jpeg" || parts.mimeType === "image/jpg") {
    const decoded = jpeg.decode(bytes, { useTArray: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }

  throw new Error(`unsupported captcha image type: ${parts.mimeType}`);
}

export function resizeImage(src: DecodedImage, targetW: number, targetH: number): Uint8ClampedArray {
  const target = new Uint8ClampedArray(targetW * targetH * 4);
  for (let y = 0; y < targetH; y += 1) {
    const srcY = Math.floor((y * src.height) / targetH);
    for (let x = 0; x < targetW; x += 1) {
      const srcX = Math.floor((x * src.width) / targetW);
      const srcIdx = (srcY * src.width + srcX) * 4;
      const targetIdx = (y * targetW + x) * 4;
      target[targetIdx] = src.data[srcIdx] ?? 0;
      target[targetIdx + 1] = src.data[srcIdx + 1] ?? 0;
      target[targetIdx + 2] = src.data[srcIdx + 2] ?? 0;
      target[targetIdx + 3] = src.data[srcIdx + 3] ?? 255;
    }
  }
  return target;
}
