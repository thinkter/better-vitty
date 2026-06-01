import { CAPTCHA_LABELS } from "./lib/constants";
import { bitmaps } from "./lib/bitmaps";
import type { RgbaData } from "./lib/types";
import { decodeImage, extractDataUriParts, resizeImage } from "./image";

function captchaParse(imgarr: number[][]): string {
  let captcha = "";

  for (let x = 1; x < 44; x += 1) {
    for (let y = 1; y < 179; y += 1) {
      const condition1 = imgarr[x]?.[y - 1] === 255 && imgarr[x]?.[y] === 0 && imgarr[x]?.[y + 1] === 255;
      const condition2 = imgarr[x - 1]?.[y] === 255 && imgarr[x]?.[y] === 0 && imgarr[x + 1]?.[y] === 255;
      const value = imgarr[x]?.[y];
      if (condition1 || condition2 || (value !== 255 && value !== 0)) {
        const row = imgarr[x];
        if (row) row[y] = 255;
      }
    }
  }

  const chars = "123456789ABCDEFGHIJKLMNPQRSTUVWXYZ";
  for (let j = 30; j < 181; j += 30) {
    let bestScore = -1;
    let bestChar = "";
    for (let i = 0; i < chars.length; i += 1) {
      let match = 0;
      let black = 0;
      const ch = chars.charAt(i);
      const mask = bitmaps[ch] as number[][] | undefined;
      if (!mask) continue;

      for (let x = 0; x < 32; x += 1) {
        for (let y = 0; y < 30; y += 1) {
          const y1 = y + j - 30;
          const x1 = x + 12;
          if (imgarr[x1]?.[y1] === mask[x]?.[y] && mask[x]?.[y] === 0) match += 1;
          if (mask[x]?.[y] === 0) black += 1;
        }
      }
      const score = black > 0 ? match / black : 0;
      if (score > bestScore) {
        bestScore = score;
        bestChar = ch;
      }
    }
    captcha += bestChar;
  }
  return captcha;
}

function preImg(img: number[][]): number[][] {
  let total = 0;
  for (const row of img) for (const value of row) total += value;
  const avg = total / (img.length * (img[0]?.length ?? 1));

  const bits = new Array<number[]>(img.length);
  for (let i = 0; i < img.length; i += 1) {
    const row = img[i] ?? [];
    const out = new Array<number>(row.length);
    for (let j = 0; j < row.length; j += 1) out[j] = (row[j] ?? 0) > avg ? 1 : 0;
    bits[i] = out;
  }
  return bits;
}

function saturation(d: RgbaData): number[][][] {
  const saturate = new Array<number>(d.length / 4);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    saturate[i / 4] = max > 0 ? Math.round(((max - min) * 255) / max) : 0;
  }

  const img = new Array<number[]>(40);
  for (let i = 0; i < 40; i += 1) {
    const row = new Array<number>(200);
    for (let j = 0; j < 200; j += 1) row[j] = saturate[i * 200 + j] ?? 0;
    img[i] = row;
  }

  const blocks = new Array<number[][]>(6);
  for (let i = 0; i < 6; i += 1) {
    const x1 = (i + 1) * 25 + 2;
    const y1 = 7 + 5 * (i % 2) + 1;
    const x2 = (i + 2) * 25 + 1;
    const y2 = 35 - 5 * ((i + 1) % 2);
    blocks[i] = img.slice(y1, y2).map((row) => row.slice(x1, x2));
  }
  return blocks;
}

function flatten(arr: number[][]): number[] {
  const width = arr[0]?.length ?? 0;
  const bits = new Array<number>(arr.length * width);
  for (let i = 0; i < arr.length; i += 1) {
    for (let j = 0; j < width; j += 1) bits[i * width + j] = arr[i]?.[j] ?? 0;
  }
  return bits;
}

function classify(input: number[], weights: number[][], biases: number[]): number {
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let out = 0; out < biases.length; out += 1) {
    let score = biases[out] ?? 0;
    for (let i = 0; i < input.length; i += 1) score += (input[i] ?? 0) * (weights[i]?.[out] ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = out;
    }
  }
  return bestIndex;
}

export async function solveCaptcha(imgDataUri: string): Promise<string> {
  const weights = bitmaps.weights as number[][] | undefined;
  const biases = bitmaps.biases as number[] | undefined;
  if (!weights?.length || !biases?.length) return solveCaptchaBitmap(imgDataUri);

  const img = decodeImage(imgDataUri);
  const data = img.width === 200 && img.height === 40 ? img.data : resizeImage(img, 200, 40);
  const blocks = saturation(data);

  let out = "";
  for (let i = 0; i < 6; i += 1) {
    const input = flatten(preImg(blocks[i] ?? []));
    out += CAPTCHA_LABELS[classify(input, weights, biases)] ?? "";
  }
  return out;
}

export async function solveCaptchaBitmap(imgDataUri: string): Promise<string> {
  const img = decodeImage(imgDataUri);
  const resizedData = resizeImage(img, 180, 45);
  const arr = new Array<number>(180 * 45);
  for (let i = 0, p = 0; i < resizedData.length; i += 4, p += 1) {
    arr[p] = Math.round((resizedData[i] ?? 0) * 0.299 + (resizedData[i + 1] ?? 0) * 0.587 + (resizedData[i + 2] ?? 0) * 0.114);
  }

  const rows = new Array<number[]>(45);
  for (let i = 0; i < 45; i += 1) rows[i] = arr.slice(i * 180, (i + 1) * 180);
  return captchaParse(rows);
}

export { extractDataUriParts };
