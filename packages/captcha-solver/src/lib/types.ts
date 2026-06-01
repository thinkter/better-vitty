export type RgbaData = Uint8Array | Uint8ClampedArray;

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly data: RgbaData;
}

export interface DataUriParts {
  readonly mimeType: string;
  readonly base64: string;
}
