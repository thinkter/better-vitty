import { describe, expect, it } from "vitest";
import { encode as encodeBase64 } from "base-64";
import { deflate } from "pako";
import type { SemesterTimetable } from "../src/lib/types";
import {
  TIMETABLE_SHARE_LEGACY_PREFIX,
  TIMETABLE_SHARE_PREFIX,
  TimetableShareError,
  TIMETABLE_SHARE_DISPLAY_NAME_MAX_CHARS,
  buildLegacyTimetableSharePayload,
  decodeTimetableSharePayload,
  selectLatestTimetable,
  encodeTimetableSharePayload,
} from "../src/lib/timetableShare";

const SAMPLE_TIMETABLE: SemesterTimetable = {
  semester: { id: "VL20252601", name: "Fall Semester 2025-26" },
  fetchedAt: "2026-01-02T03:04:05.000Z",
  courses: [
    {
      code: "CSE1001",
      title: "Computer Networks",
      type: "ETH",
      credits: "3",
      classId: "VL202526010001",
      slot: "A1",
      venue: "SJT-301",
      faculty: "Dr. Ada",
      status: "Registered",
      raw: ["CSE1001 - Computer Networks"],
    },
  ],
  events: [
    {
      day: "MON",
      kind: "Theory",
      time: "09:00 - 09:50",
      slot: "A1",
      courseCode: "CSE1001",
      venue: "SJT-301",
      raw: "A1-CSE1001-TH-SJT-301-ALL",
    },
  ],
};

function encodeRawPayload(payload: unknown, prefix = TIMETABLE_SHARE_PREFIX): string {
  const compressed = deflate(JSON.stringify(payload));
  let binary = "";
  for (let i = 0; i < compressed.length; i += 1) {
    binary += String.fromCharCode(compressed[i]!);
  }
  return `${prefix}${encodeBase64(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

function expectShareError(fn: () => unknown, code: TimetableShareError["code"]) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(TimetableShareError);
    expect((err as TimetableShareError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

function displayableTimetable(timetable: SemesterTimetable): SemesterTimetable {
  return {
    ...timetable,
    courses: timetable.courses.map((course) => ({ ...course, raw: [] })),
    events: timetable.events.map((event) => ({ ...event, raw: "" })),
  };
}

function courseFor(semester: number, idx: number, rawLength = 1): SemesterTimetable["courses"][number] {
  const code = `CSE${semester.toString().padStart(2, "0")}${idx.toString().padStart(2, "0")}`;
  return {
    code,
    title: `Program Core ${idx}`,
    type: idx % 3 === 0 ? "ELA" : "ETH",
    credits: idx % 3 === 0 ? "1" : "3",
    classId: `VL202526${semester.toString().padStart(2, "0")}${idx.toString().padStart(4, "0")}`,
    slot: idx % 3 === 0 ? `L${idx}` : `${String.fromCharCode(65 + (idx % 6))}${(idx % 2) + 1}`,
    venue: `PRP-${(idx % 5) + 200}`,
    faculty: `Dr. Faculty ${(idx % 4) + 1}`,
    status: "Registered",
    raw: Array.from({ length: rawLength }, (_, rawIdx) => `${code} raw parser row ${rawIdx} ${"source-cell ".repeat(20)}`),
  };
}

function makeTimetable(semester: number, courseCount: number, eventCount: number, rawLength = 1): SemesterTimetable {
  const courses = Array.from({ length: courseCount }, (_, idx) => courseFor(semester, idx, rawLength));
  return {
    semester: { id: `VL202526${semester.toString().padStart(2, "0")}`, name: `Semester ${semester}` },
    fetchedAt: "2026-06-01T00:00:00.000Z",
    courses,
    events: Array.from({ length: eventCount }, (_, idx) => {
      const course = courses[idx % courses.length]!;
      return {
        day: ["MON", "TUE", "WED", "THU", "FRI", "SAT"][idx % 6]!,
        kind: course.type === "ELA" ? "Lab" : "Theory",
        time: `${(8 + (idx % 8)).toString().padStart(2, "0")}:00 - ${(8 + (idx % 8)).toString().padStart(2, "0")}:50`,
        slot: course.slot,
        courseCode: course.code,
        venue: course.venue,
        raw: `${idx}-${course.code}-${"raw-event-cell ".repeat(25)}`,
      };
    }),
  };
}

describe("timetable share codec", () => {
  it("round-trips representative timetable display data with the current v2 format", () => {
    const encoded = encodeTimetableSharePayload({
      displayName: "  Ada   Lovelace ",
      exportedAt: "2026-06-01T00:00:00.000Z",
      timetables: [SAMPLE_TIMETABLE],
    });

    expect(encoded.startsWith(TIMETABLE_SHARE_PREFIX)).toBe(true);
    const decoded = decodeTimetableSharePayload(encoded);

    expect(decoded.displayName).toBe("Ada Lovelace");
    expect(decoded.exportedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(decoded.timetables).toEqual([displayableTimetable(SAMPLE_TIMETABLE)]);
    expect(decoded.timetables[0]!.courses[0]!.raw).toEqual([]);
    expect(decoded.timetables[0]!.events[0]!.raw).toBe("");
    expect(decoded.fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it("requires a non-empty display name within the QR name limit", () => {
    expectShareError(
      () => encodeTimetableSharePayload({
        displayName: "   ",
        exportedAt: "2026-06-01T00:00:00.000Z",
        timetables: [SAMPLE_TIMETABLE],
      }),
      "NAME",
    );
    expectShareError(
      () => encodeTimetableSharePayload({
        displayName: "A".repeat(TIMETABLE_SHARE_DISPLAY_NAME_MAX_CHARS + 1),
        exportedAt: "2026-06-01T00:00:00.000Z",
        timetables: [SAMPLE_TIMETABLE],
      }),
      "NAME",
    );
  });

  it("decodes legacy v1 QR payloads without dropping legacy raw fields", () => {
    const legacy = buildLegacyTimetableSharePayload({
      displayName: "Ada",
      exportedAt: "2026-06-01T00:00:00.000Z",
      timetables: [SAMPLE_TIMETABLE],
    });
    const encoded = encodeRawPayload(legacy, TIMETABLE_SHARE_LEGACY_PREFIX);

    expect(encoded.startsWith(TIMETABLE_SHARE_LEGACY_PREFIX)).toBe(true);
    expect(decodeTimetableSharePayload(encoded).timetables).toEqual([SAMPLE_TIMETABLE]);
  });

  it("fits raw-heavy timetable data by omitting invisible parser source rows", () => {
    const timetables = Array.from({ length: 4 }, (_, idx) => makeTimetable(idx + 1, 8, 42, 8));
    const legacy = buildLegacyTimetableSharePayload({
      displayName: "Ada",
      exportedAt: "2026-06-01T00:00:00.000Z",
      timetables,
    });
    const legacyEncoded = encodeRawPayload(legacy, TIMETABLE_SHARE_LEGACY_PREFIX);
    const encoded = encodeTimetableSharePayload({
      displayName: "Ada",
      exportedAt: "2026-06-01T00:00:00.000Z",
      timetables,
    });

    expect(legacyEncoded.length).toBeGreaterThan(2500);
    expect(encoded.length).toBeLessThanOrEqual(2500);
    expect(decodeTimetableSharePayload(encoded).timetables).toEqual([displayableTimetable(selectLatestTimetable(timetables))]);
  });

  it("accepts four-semester and five-year-style inputs while sharing only the latest semester", () => {
    const fourSemesterTimetables = Array.from({ length: 4 }, (_, idx) => makeTimetable(idx + 1, 7, 36, 2));
    const fiveYearTimetables = Array.from({ length: 10 }, (_, idx) => makeTimetable(idx + 1, 5, 24, 2));

    for (const timetables of [fourSemesterTimetables, fiveYearTimetables]) {
      const encoded = encodeTimetableSharePayload({
        displayName: "Long Programme",
        exportedAt: "2026-06-01T00:00:00.000Z",
        timetables,
      });
      const decoded = decodeTimetableSharePayload(encoded);

      expect(encoded.startsWith(TIMETABLE_SHARE_PREFIX)).toBe(true);
      expect(decoded.timetables).toHaveLength(1);
      expect(decoded.timetables).toEqual([displayableTimetable(selectLatestTimetable(timetables))]);
    }
  });

  it("selects the latest semester by VTOP semester id before encoding", () => {
    const older = makeTimetable(1, 2, 4);
    const newest = { ...makeTimetable(5, 2, 4), semester: { id: "VL20252605", name: "Winter Semester 2025-26" } };
    const middle = { ...makeTimetable(3, 2, 4), semester: { id: "VL20252601", name: "Fall Semester 2025-26" } };
    const encoded = encodeTimetableSharePayload({
      displayName: "Ada",
      exportedAt: "2026-06-01T00:00:00.000Z",
      timetables: [older, newest, middle],
    });

    expect(decodeTimetableSharePayload(encoded).timetables).toEqual([displayableTimetable(newest)]);
  });

  it("rejects unknown prefixes and unsupported versions", () => {
    expectShareError(() => decodeTimetableSharePayload("NOTBVTT.payload"), "PREFIX");

    const unsupported = encodeRawPayload({
      v: 3,
      s: ["Ada", "2026-06-01T00:00:00.000Z"],
      n: 0,
      x: 1,
      t: [],
    });
    expectShareError(() => decodeTimetableSharePayload(unsupported, 5000), "VERSION");
  });

  it("rejects malformed QR bodies without crashing", () => {
    expectShareError(() => decodeTimetableSharePayload(`${TIMETABLE_SHARE_PREFIX}%%%`), "MALFORMED");
    expectShareError(() => decodeTimetableSharePayload(`${TIMETABLE_SHARE_PREFIX}abcd`), "MALFORMED");
  });

  it("rejects empty and oversized timetable exports", () => {
    expectShareError(() => encodeTimetableSharePayload({ displayName: "Ada", timetables: [] }), "EMPTY");
    expectShareError(
      () => encodeTimetableSharePayload({
        displayName: "Ada",
        exportedAt: "2026-06-01T00:00:00.000Z",
        timetables: [
          {
            ...SAMPLE_TIMETABLE,
            events: Array.from({ length: 300 }, (_, idx) => ({
              ...SAMPLE_TIMETABLE.events[0]!,
              slot: `L${idx}`,
              courseCode: `UNIQUE${idx}`,
              venue: `unique venue ${idx} ${"x".repeat(80)}`,
              raw: `${idx}-`.repeat(20),
            })),
          },
        ],
        maxBytes: 300,
      }),
      "OVERSIZE",
    );
  });

  it("rejects impossible-to-fit pathological data instead of truncating", () => {
    const timetables = Array.from({ length: 10 }, (_, semester) => ({
      ...makeTimetable(semester + 1, 30, 120, 1),
      courses: Array.from({ length: 30 }, (_, course) => ({
        ...courseFor(semester + 1, course),
        code: `PATH${semester}-${course}-${"A".repeat(30)}`,
        title: `Unique pathological course ${semester}-${course}-${"B".repeat(80)}`,
        faculty: `Unique faculty ${semester}-${course}-${"C".repeat(80)}`,
      })),
      events: Array.from({ length: 120 }, (_, event) => ({
        day: `DAY-${semester}-${event}`,
        kind: `KIND-${semester}-${event}`,
        time: `${event}:00 - ${event}:50 ${"D".repeat(40)}`,
        slot: `SLOT-${semester}-${event}-${"E".repeat(40)}`,
        courseCode: `UNMATCHED-${semester}-${event}-${"F".repeat(40)}`,
        venue: `VENUE-${semester}-${event}-${"G".repeat(80)}`,
        raw: "",
      })),
    }));

    expectShareError(
      () => encodeTimetableSharePayload({
        displayName: "Pathological",
        exportedAt: "2026-06-01T00:00:00.000Z",
        timetables,
      }),
      "OVERSIZE",
    );
  });
});
