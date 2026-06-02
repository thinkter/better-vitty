import { decode as decodeBase64, encode as encodeBase64 } from "base-64";
import { deflate, inflate } from "pako";
import type {
  CompactCourse,
  CompactSemesterTimetable,
  CompactTimetableEvent,
  CompactV2Course,
  CompactV2SemesterTimetable,
  CompactV2TimetableEvent,
  Course,
  SemesterTimetable,
  TimetableShareDecodeResult,
  TimetableSharePayloadV1,
  TimetableSharePayloadV2,
} from "./types";

export const TIMETABLE_SHARE_LEGACY_PREFIX = "BVTT1.";
export const TIMETABLE_SHARE_PREFIX = "BVTT2.";
export const TIMETABLE_SHARE_MAX_BYTES = 2500;
export const TIMETABLE_SHARE_DISPLAY_NAME_MAX_CHARS = 40;

const MAX_DECODED_TIMETABLES = 32;
const MAX_DECODED_COURSES_PER_TIMETABLE = 512;
const MAX_DECODED_EVENTS_PER_TIMETABLE = 8192;
const MAX_DECODED_STRINGS = 50000;
const MAX_DECODED_STRING_LENGTH = 4096;

export class TimetableShareError extends Error {
  constructor(readonly code: "EMPTY" | "PREFIX" | "VERSION" | "MALFORMED" | "OVERSIZE" | "NAME", message: string) {
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

function validatedDisplayName(displayName: string): string {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new TimetableShareError("NAME", "display name is required");
  }
  if (normalized.length > TIMETABLE_SHARE_DISPLAY_NAME_MAX_CHARS) {
    throw new TimetableShareError("NAME", `display name must be ${TIMETABLE_SHARE_DISPLAY_NAME_MAX_CHARS} characters or fewer`);
  }
  return normalized;
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

class StringTable {
  readonly values: string[] = [];
  private readonly indexes = new Map<string, number>();

  add(value: string): number {
    const existing = this.indexes.get(value);
    if (existing !== undefined) return existing;
    const index = this.values.length;
    this.values.push(value);
    this.indexes.set(value, index);
    return index;
  }
}

function buildCourseCodeIndex(courses: readonly SemesterTimetable["courses"][number][]): Map<string, number> {
  const indexes = new Map<string, number>();
  for (let i = 0; i < courses.length; i += 1) {
    const code = courses[i]?.code;
    if (code && !indexes.has(code)) indexes.set(code, i);
  }
  return indexes;
}

function compactV2Course(course: Course, strings: StringTable): CompactV2Course {
  return [
    strings.add(course.code),
    strings.add(course.title),
    strings.add(course.type),
    strings.add(course.credits),
    strings.add(course.classId),
    strings.add(course.slot),
    strings.add(course.venue),
    strings.add(course.faculty),
    strings.add(course.status),
  ];
}

function compactV2Timetable(timetable: SemesterTimetable, strings: StringTable): CompactV2SemesterTimetable {
  const courseIndexes = buildCourseCodeIndex(timetable.courses);
  const courses = timetable.courses.map((course) => compactV2Course(course, strings));
  const events = timetable.events.map<CompactV2TimetableEvent>((event) => {
    const courseIndex = courseIndexes.get(event.courseCode);
    return [
      strings.add(event.day),
      strings.add(event.kind),
      strings.add(event.time),
      strings.add(event.slot),
      courseIndex ?? (timetable.courses.length + strings.add(event.courseCode)),
      strings.add(event.venue),
    ];
  });
  return [
    strings.add(timetable.semester.id),
    strings.add(timetable.semester.name),
    strings.add(timetable.fetchedAt),
    courses,
    events,
  ];
}

function expandV2Course(course: CompactV2Course, strings: readonly string[]): Course {
  return {
    code: strings[course[0]]!,
    title: strings[course[1]]!,
    type: strings[course[2]]!,
    credits: strings[course[3]]!,
    classId: strings[course[4]]!,
    slot: strings[course[5]]!,
    venue: strings[course[6]]!,
    faculty: strings[course[7]]!,
    status: strings[course[8]]!,
    raw: [],
  };
}

function expandV2Timetable(timetable: CompactV2SemesterTimetable, strings: readonly string[]): SemesterTimetable {
  const courses = timetable[3].map((course) => expandV2Course(course, strings));
  return {
    semester: { id: strings[timetable[0]]!, name: strings[timetable[1]]! },
    fetchedAt: strings[timetable[2]]!,
    courses,
    events: timetable[4].map((event) => ({
      day: strings[event[0]]!,
      kind: strings[event[1]]!,
      time: strings[event[2]]!,
      slot: strings[event[3]]!,
      courseCode: event[4] < courses.length ? courses[event[4]]!.code : strings[event[4] - courses.length]!,
      venue: strings[event[5]]!,
      raw: "",
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
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new TimetableShareError("MALFORMED", "timetable QR payload is not base64url");
  }
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

function assertStringIndex(value: unknown, strings: readonly string[], field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= strings.length) {
    throw new TimetableShareError("MALFORMED", `invalid ${field}`);
  }
}

function assertCourseRef(value: unknown, strings: readonly string[], courseCount: number, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new TimetableShareError("MALFORMED", `invalid ${field}`);
  }
  if (value >= courseCount && value - courseCount >= strings.length) {
    throw new TimetableShareError("MALFORMED", `invalid ${field}`);
  }
}

function validateLegacyPayload(value: unknown): TimetableSharePayloadV1 {
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
  if (payload.t.length > MAX_DECODED_TIMETABLES) {
    throw new TimetableShareError("MALFORMED", "timetable QR contains too many timetables");
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
    if (timetable[3].length > MAX_DECODED_COURSES_PER_TIMETABLE || timetable[4].length > MAX_DECODED_EVENTS_PER_TIMETABLE) {
      throw new TimetableShareError("MALFORMED", `invalid timetable size ${timetableIdx}`);
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

  return payload as TimetableSharePayloadV1;
}

function validateV2Payload(value: unknown): TimetableSharePayloadV2 {
  if (!value || typeof value !== "object") {
    throw new TimetableShareError("MALFORMED", "payload is not an object");
  }
  const payload = value as { v?: unknown; s?: unknown; n?: unknown; x?: unknown; t?: unknown };
  if (payload.v !== 2) {
    throw new TimetableShareError("VERSION", "unsupported timetable QR version");
  }
  if (!Array.isArray(payload.s) || payload.s.length > MAX_DECODED_STRINGS) {
    throw new TimetableShareError("MALFORMED", "invalid string table");
  }
  for (const [idx, value] of payload.s.entries()) {
    if (typeof value !== "string" || value.length > MAX_DECODED_STRING_LENGTH) {
      throw new TimetableShareError("MALFORMED", `invalid string table entry ${idx}`);
    }
  }
  assertStringIndex(payload.n, payload.s, "display name");
  assertStringIndex(payload.x, payload.s, "export timestamp");
  if (!Array.isArray(payload.t) || payload.t.length === 0) {
    throw new TimetableShareError("EMPTY", "timetable QR contains no timetables");
  }
  if (payload.t.length > MAX_DECODED_TIMETABLES) {
    throw new TimetableShareError("MALFORMED", "timetable QR contains too many timetables");
  }

  for (const [timetableIdx, timetable] of payload.t.entries()) {
    if (!Array.isArray(timetable) || timetable.length !== 5) {
      throw new TimetableShareError("MALFORMED", `invalid timetable ${timetableIdx}`);
    }
    assertStringIndex(timetable[0], payload.s, "semester id");
    assertStringIndex(timetable[1], payload.s, "semester name");
    assertStringIndex(timetable[2], payload.s, "fetched timestamp");
    if (!Array.isArray(timetable[3]) || !Array.isArray(timetable[4])) {
      throw new TimetableShareError("MALFORMED", `invalid timetable lists ${timetableIdx}`);
    }
    if (timetable[3].length > MAX_DECODED_COURSES_PER_TIMETABLE || timetable[4].length > MAX_DECODED_EVENTS_PER_TIMETABLE) {
      throw new TimetableShareError("MALFORMED", `invalid timetable size ${timetableIdx}`);
    }
    for (const [courseIdx, course] of timetable[3].entries()) {
      if (!Array.isArray(course) || course.length !== 9) {
        throw new TimetableShareError("MALFORMED", `invalid course ${courseIdx}`);
      }
      for (let i = 0; i < 9; i += 1) assertStringIndex(course[i], payload.s, `course ${courseIdx} field ${i}`);
    }
    for (const [eventIdx, event] of timetable[4].entries()) {
      if (!Array.isArray(event) || event.length !== 6) {
        throw new TimetableShareError("MALFORMED", `invalid event ${eventIdx}`);
      }
      assertStringIndex(event[0], payload.s, `event ${eventIdx} day`);
      assertStringIndex(event[1], payload.s, `event ${eventIdx} kind`);
      assertStringIndex(event[2], payload.s, `event ${eventIdx} time`);
      assertStringIndex(event[3], payload.s, `event ${eventIdx} slot`);
      assertCourseRef(event[4], payload.s, timetable[3].length, `event ${eventIdx} course`);
      assertStringIndex(event[5], payload.s, `event ${eventIdx} venue`);
    }
  }

  return payload as TimetableSharePayloadV2;
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

export function buildLegacyTimetableSharePayload(input: EncodeInput): TimetableSharePayloadV1 {
  if (input.timetables.length === 0) {
    throw new TimetableShareError("EMPTY", "cannot share an empty timetable");
  }
  return {
    v: 1,
    n: validatedDisplayName(input.displayName),
    x: input.exportedAt ?? new Date().toISOString(),
    t: input.timetables.map(compactTimetable),
  };
}

function compareSemesterIds(a: string, b: string): number {
  return a.localeCompare(b);
}

export function selectLatestTimetable(timetables: readonly SemesterTimetable[]): SemesterTimetable {
  if (timetables.length === 0) {
    throw new TimetableShareError("EMPTY", "cannot share an empty timetable");
  }
  let latest = timetables[0]!;
  for (let i = 1; i < timetables.length; i += 1) {
    const candidate = timetables[i]!;
    if (compareSemesterIds(candidate.semester.id, latest.semester.id) > 0) latest = candidate;
  }
  return latest;
}

export function buildTimetableSharePayload(input: EncodeInput): TimetableSharePayloadV2 {
  const latestTimetable = selectLatestTimetable(input.timetables);
  const strings = new StringTable();
  const displayName = strings.add(validatedDisplayName(input.displayName));
  const exportedAt = strings.add(input.exportedAt ?? new Date().toISOString());
  const timetables = [compactV2Timetable(latestTimetable, strings)];
  return {
    v: 2,
    s: strings.values,
    n: displayName,
    x: exportedAt,
    t: timetables,
  };
}

export function encodeTimetableSharePayload(input: EncodeInput): string {
  const payload = buildTimetableSharePayload(input);
  const json = JSON.stringify(payload);
  const encoded = `${TIMETABLE_SHARE_PREFIX}${base64UrlEncode(deflate(json, { level: 9 }))}`;
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
  const legacy = raw.startsWith(TIMETABLE_SHARE_LEGACY_PREFIX);
  const current = raw.startsWith(TIMETABLE_SHARE_PREFIX);
  if (!legacy && !current) {
    throw new TimetableShareError("PREFIX", "not a better-vitty timetable QR");
  }

  try {
    const prefix = legacy ? TIMETABLE_SHARE_LEGACY_PREFIX : TIMETABLE_SHARE_PREFIX;
    const compressed = base64UrlDecode(raw.slice(prefix.length));
    const json = inflate(compressed, { to: "string" });
    const parsed = JSON.parse(json);
    if (legacy) {
      const payload = validateLegacyPayload(parsed);
      return {
        fingerprint: fnv1a64Hex(JSON.stringify(payload)),
        displayName: normalizeDisplayName(payload.n),
        exportedAt: payload.x,
        timetables: payload.t.map(expandTimetable),
        encodedBytes: raw.length,
      };
    }
    const payload = validateV2Payload(parsed);
    return {
      fingerprint: fnv1a64Hex(JSON.stringify(payload)),
      displayName: normalizeDisplayName(payload.s[payload.n]!),
      exportedAt: payload.s[payload.x]!,
      timetables: payload.t.map((timetable) => expandV2Timetable(timetable, payload.s)),
      encodedBytes: raw.length,
    };
  } catch (err) {
    if (err instanceof TimetableShareError) throw err;
    throw new TimetableShareError("MALFORMED", "timetable QR payload is corrupted");
  }
}
