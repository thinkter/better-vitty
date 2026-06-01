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

export interface StoredCookie {
  readonly name: string;
  readonly value: string;
  readonly path: string;
}

export interface LoginOptions {
  readonly username: string;
  readonly password: string;
  readonly maxCaptchaAttempts?: number;
  readonly maxCaptchaPageAttempts?: number;
  readonly onStatus?: (status: string) => void;
}

export interface SyncOptions {
  readonly onStatus?: (status: string) => void;
}
