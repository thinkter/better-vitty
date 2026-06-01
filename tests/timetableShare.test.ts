import { describe, expect, it } from "vitest";
import { encode as encodeBase64 } from "base-64";
import { deflate } from "pako";
import type { SemesterTimetable } from "../src/lib/types";
import {
  TIMETABLE_SHARE_PREFIX,
  TimetableShareError,
  decodeTimetableSharePayload,
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

function encodeRawPayload(payload: unknown): string {
  const compressed = deflate(JSON.stringify(payload));
  let binary = "";
  for (let i = 0; i < compressed.length; i += 1) {
    binary += String.fromCharCode(compressed[i]!);
  }
  return `${TIMETABLE_SHARE_PREFIX}${encodeBase64(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
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

describe("timetable share codec", () => {
  it("round-trips representative timetable data", () => {
    const encoded = encodeTimetableSharePayload({
      displayName: "  Ada   Lovelace ",
      exportedAt: "2026-06-01T00:00:00.000Z",
      timetables: [SAMPLE_TIMETABLE],
    });

    expect(encoded.startsWith(TIMETABLE_SHARE_PREFIX)).toBe(true);
    const decoded = decodeTimetableSharePayload(encoded);

    expect(decoded.displayName).toBe("Ada Lovelace");
    expect(decoded.exportedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(decoded.timetables).toEqual([SAMPLE_TIMETABLE]);
    expect(decoded.fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it("rejects unknown prefixes and unsupported versions", () => {
    expectShareError(() => decodeTimetableSharePayload("NOTBVTT.payload"), "PREFIX");

    const unsupported = encodeRawPayload({
      v: 2,
      n: "Ada",
      x: "2026-06-01T00:00:00.000Z",
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
              raw: `${idx}-`.repeat(20),
            })),
          },
        ],
        maxBytes: 300,
      }),
      "OVERSIZE",
    );
  });
});
