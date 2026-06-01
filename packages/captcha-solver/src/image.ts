import { Buffer } from "buffer";
import * as jpeg from "jpeg-js";
import { decode as decodePng } from "fast-png";

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
    const decoded = decodePng(bytes);
    return { width: decoded.width, height: decoded.height, data: pngToRgba(decoded.data, decoded.channels) };
  }

  if (parts.mimeType === "image/jpeg" || parts.mimeType === "image/jpg") {
    const decoded = jpeg.decode(bytes, { useTArray: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }

  throw new Error(`unsupported captcha image type: ${parts.mimeType}`);
}

function pngToRgba(data: Uint8Array | Uint8ClampedArray | Uint16Array, channels: number): Uint8Array | Uint8ClampedArray {
  if (channels === 4 && !(data instanceof Uint16Array)) return data;
  const pixels = Math.floor(data.length / channels);
  const rgba = new Uint8Array(pixels * 4);
  for (let i = 0, j = 0; i < data.length; i += channels, j += 4) {
    const r = data[i] ?? 0;
    const g = data[i + (channels > 2 ? 1 : 0)] ?? r;
    const b = data[i + (channels > 2 ? 2 : 0)] ?? r;
    const a = channels === 2 ? (data[i + 1] ?? 255) : channels === 4 ? (data[i + 3] ?? 255) : 255;
    rgba[j] = r > 255 ? r >> 8 : r;
    rgba[j + 1] = g > 255 ? g >> 8 : g;
    rgba[j + 2] = b > 255 ? b >> 8 : b;
    rgba[j + 3] = a > 255 ? a >> 8 : a;
  }
  return rgba;
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
