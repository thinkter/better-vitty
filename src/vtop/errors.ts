export type VtopErrorCode =
  | "NETWORK_UNAVAILABLE"
  | "VTOP_UNAVAILABLE"
  | "SESSION_EXPIRED"
  | "CSRF_MISSING"
  | "CAPTCHA_UNAVAILABLE"
  | "CAPTCHA_REJECTED"
  | "INVALID_CREDENTIALS"
  | "MANDATORY_WEB_ACTION"
  | "NO_SEMESTERS"
  | "TIMETABLE_FORMAT_CHANGED";

export class VtopError extends Error {
  readonly code: VtopErrorCode;
  readonly status: number | undefined;

  constructor(code: VtopErrorCode, message: string, status?: number) {
    super(message);
    this.name = "VtopError";
    this.code = code;
    this.status = status;
  }
}

export function asVtopError(error: unknown): VtopError {
  if (error instanceof VtopError) return error;
  if (error instanceof TypeError) return new VtopError("NETWORK_UNAVAILABLE", "network unavailable");
  if (error instanceof Error) return new VtopError("NETWORK_UNAVAILABLE", error.message);
  return new VtopError("NETWORK_UNAVAILABLE", "network unavailable");
}

export function mapHttpStatus(status: number): VtopError | null {
  if (status === 403 || status >= 500) {
    return new VtopError("VTOP_UNAVAILABLE", "vtop unavailable or blocking request", status);
  }
  return null;
}
