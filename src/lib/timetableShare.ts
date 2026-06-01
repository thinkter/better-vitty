import { decode as decodeBase64, encode as encodeBase64 } from "base-64";
import { deflate, inflate } from "pako";
import type {
  CompactCourse,
  CompactSemesterTimetable,
  CompactTimetableEvent,
  Course,
  SemesterTimetable,
  TimetableShareDecodeResult,
  TimetableSharePayload,
} from "./types";

export const TIMETABLE_SHARE_PREFIX = "BVTT1.";
export const TIMETABLE_SHARE_MAX_BYTES = 2500;

export class TimetableShareError extends Error {
  constructor(readonly code: "EMPTY" | "PREFIX" | "VERSION" | "MALFORMED" | "OVERSIZE", message: string) {
    super(message);
    this.name = "TimetableShareError";
  }
}

interface EncodeInput {
  readonly displayName: string;
  readonly timetables: readonly SemesterTimetable[];
  readonly exportedAt?: string;
  readonly maxBytes?: number;
}

function normalizeDisplayName(displayName: string): string {
  const trimmed = displayName.trim().replace(/\s+/g, " ");
  return trimmed || "better-vitty user";
}

function compactCourse(course: Course): CompactCourse {
  return [
    course.code,
    course.title,
    course.type,
    course.credits,
    course.classId,
    course.slot,
    course.venue,
    course.faculty,
    course.status,
    course.raw,
  ];
}

function compactTimetable(timetable: SemesterTimetable): CompactSemesterTimetable {
  const courses = timetable.courses.map(compactCourse);
  const events = timetable.events.map<CompactTimetableEvent>((event) => [
    event.day,
    event.kind,
    event.time,
    event.slot,
    event.courseCode,
    event.venue,
    event.raw,
  ]);
  return [
    timetable.semester.id,
    timetable.semester.name,
    timetable.fetchedAt,
    courses,
    events,
  ];
}

function expandCourse(course: CompactCourse): Course {
  return {
    code: course[0],
    title: course[1],
    type: course[2],
    credits: course[3],
    classId: course[4],
    slot: course[5],
    venue: course[6],
    faculty: course[7],
    status: course[8],
    raw: course[9],
  };
}

function expandTimetable(timetable: CompactSemesterTimetable): SemesterTimetable {
  return {
    semester: { id: timetable[0], name: timetable[1] },
    fetchedAt: timetable[2],
    courses: timetable[3].map(expandCourse),
    events: timetable[4].map((event) => ({
      day: event[0],
      kind: event[1],
      time: event[2],
      slot: event[3],
      courseCode: event[4],
      venue: event[5],
      raw: event[6],
    })),
  };
}

function bytesToBinary(bytes: Uint8Array): string {
  let output = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return output;
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 0xff;
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return encodeBase64(bytesToBinary(bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return binaryToBytes(decodeBase64(padded));
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TimetableShareError("MALFORMED", `invalid ${field}`);
  }
}

function assertStringArray(value: unknown, field: string): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new TimetableShareError("MALFORMED", `invalid ${field}`);
  }
}

function validatePayload(value: unknown): TimetableSharePayload {
  if (!value || typeof value !== "object") {
    throw new TimetableShareError("MALFORMED", "payload is not an object");
  }
  const payload = value as { v?: unknown; n?: unknown; x?: unknown; t?: unknown };
  if (payload.v !== 1) {
    throw new TimetableShareError("VERSION", "unsupported timetable QR version");
  }
  assertString(payload.n, "display name");
  assertString(payload.x, "export timestamp");
  if (!Array.isArray(payload.t) || payload.t.length === 0) {
    throw new TimetableShareError("EMPTY", "timetable QR contains no timetables");
  }

  for (const [timetableIdx, timetable] of payload.t.entries()) {
    if (!Array.isArray(timetable) || timetable.length !== 5) {
      throw new TimetableShareError("MALFORMED", `invalid timetable ${timetableIdx}`);
    }
    assertString(timetable[0], "semester id");
    assertString(timetable[1], "semester name");
    assertString(timetable[2], "fetched timestamp");
    if (!Array.isArray(timetable[3]) || !Array.isArray(timetable[4])) {
      throw new TimetableShareError("MALFORMED", `invalid timetable lists ${timetableIdx}`);
    }
    for (const [courseIdx, course] of timetable[3].entries()) {
      if (!Array.isArray(course) || course.length !== 10) {
        throw new TimetableShareError("MALFORMED", `invalid course ${courseIdx}`);
      }
      for (let i = 0; i < 9; i += 1) assertString(course[i], `course ${courseIdx} field ${i}`);
      assertStringArray(course[9], `course ${courseIdx} raw`);
    }
    for (const [eventIdx, event] of timetable[4].entries()) {
      if (!Array.isArray(event) || event.length !== 7) {
        throw new TimetableShareError("MALFORMED", `invalid event ${eventIdx}`);
      }
      for (let i = 0; i < 7; i += 1) assertString(event[i], `event ${eventIdx} field ${i}`);
    }
  }

  return payload as TimetableSharePayload;
}

function fnv1a64Hex(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= BigInt(value.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

export function buildTimetableSharePayload(input: EncodeInput): TimetableSharePayload {
  if (input.timetables.length === 0) {
    throw new TimetableShareError("EMPTY", "cannot share an empty timetable");
  }
  return {
    v: 1,
    n: normalizeDisplayName(input.displayName),
    x: input.exportedAt ?? new Date().toISOString(),
    t: input.timetables.map(compactTimetable),
  };
}

export function encodeTimetableSharePayload(input: EncodeInput): string {
  const payload = buildTimetableSharePayload(input);
  const json = JSON.stringify(payload);
  const encoded = `${TIMETABLE_SHARE_PREFIX}${base64UrlEncode(deflate(json))}`;
  const maxBytes = input.maxBytes ?? TIMETABLE_SHARE_MAX_BYTES;
  if (encoded.length > maxBytes) {
    throw new TimetableShareError("OVERSIZE", `timetable QR payload is ${encoded.length} bytes; limit is ${maxBytes}`);
  }
  return encoded;
}

export function decodeTimetableSharePayload(raw: string, maxBytes = TIMETABLE_SHARE_MAX_BYTES): TimetableShareDecodeResult {
  if (raw.length > maxBytes) {
    throw new TimetableShareError("OVERSIZE", `timetable QR payload is ${raw.length} bytes; limit is ${maxBytes}`);
  }
  if (!raw.startsWith(TIMETABLE_SHARE_PREFIX)) {
    throw new TimetableShareError("PREFIX", "not a better-vitty timetable QR");
  }

  try {
    const compressed = base64UrlDecode(raw.slice(TIMETABLE_SHARE_PREFIX.length));
    const json = inflate(compressed, { to: "string" });
    const payload = validatePayload(JSON.parse(json));
    return {
      fingerprint: fnv1a64Hex(JSON.stringify(payload)),
      displayName: normalizeDisplayName(payload.n),
      exportedAt: payload.x,
      timetables: payload.t.map(expandTimetable),
      encodedBytes: raw.length,
    };
  } catch (err) {
    if (err instanceof TimetableShareError) throw err;
    throw new TimetableShareError("MALFORMED", "timetable QR payload is corrupted");
  }
}
