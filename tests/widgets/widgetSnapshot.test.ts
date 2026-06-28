import { describe, expect, it } from "vitest";
import type { TimetableEvent } from "../../src/lib/types";
import {
  parseEventTimeRange,
  selectCurrentNext,
} from "../../src/lib/timetableModel";
import { buildWidgetSnapshot } from "../../src/widgets/widgetSnapshot";
import type { SemesterTimetable } from "../../src/lib/types";

function makeEvent(overrides: Partial<TimetableEvent> = {}): TimetableEvent {
  return {
    day: "MON",
    kind: "Theory",
    time: "09:00 - 09:50",
    slot: "A1",
    courseCode: "CSE1001",
    venue: "SJT-301",
    raw: "",
    ...overrides,
  };
}

const SAMPLE_TIMETABLE: SemesterTimetable = {
  semester: { id: "VL2025", name: "Fall 2025-26" },
  fetchedAt: "2026-01-01T00:00:00.000Z",
  courses: [
    {
      code: "CSE1001",
      title: "Computer Networks",
      type: "ETH",
      credits: "3",
      classId: "CLS001",
      slot: "A1",
      venue: "SJT-301",
      faculty: "Dr. Ada",
      status: "Registered",
      raw: [],
    },
    {
      code: "CSE2001",
      title: "OS Lab",
      type: "ELA",
      credits: "2",
      classId: "CLS002",
      slot: "B1",
      venue: "TT-101",
      faculty: "Dr. Bob",
      status: "Registered",
      raw: [],
    },
  ],
  events: [
    makeEvent({ day: "MON", time: "09:00 - 09:50", slot: "A1", courseCode: "CSE1001" }),
    makeEvent({ day: "MON", time: "10:00 - 10:50", slot: "B1", courseCode: "CSE2001", kind: "" }),
    makeEvent({ day: "TUE", time: "11:00 - 11:50", slot: "A1", courseCode: "CSE1001" }),
  ],
};

describe("parseEventTimeRange", () => {
  it("parses a standard time range", () => {
    const ev = makeEvent({ time: "08:00 - 08:50" });
    const { startMinutes, endMinutes } = parseEventTimeRange(ev);
    expect(startMinutes).toBe(8 * 60);
    expect(endMinutes).toBe(8 * 60 + 50);
  });

  it("parses a single HH:MM time", () => {
    const ev = makeEvent({ time: "14:30" });
    const { startMinutes, endMinutes } = parseEventTimeRange(ev);
    expect(startMinutes).toBe(14 * 60 + 30);
    expect(endMinutes).toBe(14 * 60 + 30);
  });

  it("returns null for unparseable time", () => {
    const ev = makeEvent({ time: "A1" });
    const { startMinutes, endMinutes } = parseEventTimeRange(ev);
    expect(startMinutes).toBeNull();
    expect(endMinutes).toBeNull();
  });

  it("returns null for empty time", () => {
    const ev = makeEvent({ time: "" });
    const { startMinutes, endMinutes } = parseEventTimeRange(ev);
    expect(startMinutes).toBeNull();
    expect(endMinutes).toBeNull();
  });

  it("handles padded spaces around dash", () => {
    const ev = makeEvent({ time: "10:00 - 10:50" });
    expect(parseEventTimeRange(ev).startMinutes).toBe(600);
    expect(parseEventTimeRange(ev).endMinutes).toBe(650);
  });
});

describe("selectCurrentNext", () => {
  const events: TimetableEvent[] = [
    makeEvent({ time: "09:00 - 09:50" }),
    makeEvent({ time: "10:00 - 10:50" }),
    makeEvent({ time: "11:00 - 11:50" }),
  ];

  it("returns null/null before first class", () => {
    const { currentIndex, nextIndex } = selectCurrentNext(events, 8 * 60);
    expect(currentIndex).toBeNull();
    expect(nextIndex).toBe(0);
  });

  it("identifies current class mid-slot", () => {
    const { currentIndex, nextIndex } = selectCurrentNext(events, 9 * 60 + 25);
    expect(currentIndex).toBe(0);
    expect(nextIndex).toBe(1);
  });

  it("identifies next class between slots", () => {
    const { currentIndex, nextIndex } = selectCurrentNext(events, 9 * 60 + 55);
    expect(currentIndex).toBeNull();
    expect(nextIndex).toBe(1);
  });

  it("returns null/null after last class", () => {
    const { currentIndex, nextIndex } = selectCurrentNext(events, 12 * 60);
    expect(currentIndex).toBeNull();
    expect(nextIndex).toBeNull();
  });

  it("returns null/null for empty events", () => {
    const { currentIndex, nextIndex } = selectCurrentNext([], 9 * 60);
    expect(currentIndex).toBeNull();
    expect(nextIndex).toBeNull();
  });
});

describe("buildWidgetSnapshot", () => {
  it("returns empty week for empty timetables", () => {
    const snap = buildWidgetSnapshot([]);
    expect(snap.v).toBe(1);
    expect(snap.semesterName).toBe("");
    expect(snap.week.MON).toEqual([]);
    expect(snap.week.SUN).toEqual([]);
  });

  it("buckets events by day correctly", () => {
    const snap = buildWidgetSnapshot([SAMPLE_TIMETABLE]);
    expect(snap.semesterName).toBe("Fall 2025-26");
    expect(snap.week.MON).toHaveLength(2);
    expect(snap.week.TUE).toHaveLength(1);
    expect(snap.week.WED).toHaveLength(0);
  });

  it("resolves course title, venue, faculty from course map", () => {
    const snap = buildWidgetSnapshot([SAMPLE_TIMETABLE]);
    const mon = snap.week.MON;
    const cse1001 = mon.find((e) => e.code === "CSE1001");
    expect(cse1001?.title).toBe("Computer Networks");
    expect(cse1001?.faculty).toBe("Dr. Ada");
    expect(cse1001?.venue).toBe("SJT-301");
  });

  it("resolves kind from course type when event kind is empty", () => {
    const snap = buildWidgetSnapshot([SAMPLE_TIMETABLE]);
    const cse2001 = snap.week.MON.find((e) => e.code === "CSE2001");
    expect(cse2001?.kind).toBe("Lab");
  });

  it("parses startMinutes/endMinutes", () => {
    const snap = buildWidgetSnapshot([SAMPLE_TIMETABLE]);
    const ev = snap.week.MON[0]!;
    expect(ev.startMinutes).toBe(9 * 60);
    expect(ev.endMinutes).toBe(9 * 60 + 50);
  });

  it("uses the timetable with the latest semester id when multiple provided", () => {
    const older: SemesterTimetable = {
      ...SAMPLE_TIMETABLE,
      semester: { id: "VL2024", name: "Spring 2024-25" },
      events: [],
    };
    const snap = buildWidgetSnapshot([SAMPLE_TIMETABLE, older]);
    expect(snap.semesterName).toBe("Fall 2025-26");
    expect(snap.week.MON).toHaveLength(2);
  });

  it("picks the latest semester even when it appears last in the array", () => {
    const older: SemesterTimetable = {
      ...SAMPLE_TIMETABLE,
      semester: { id: "VL2024", name: "Spring 2024-25" },
      events: [],
    };
    const snap = buildWidgetSnapshot([older, SAMPLE_TIMETABLE]);
    expect(snap.semesterName).toBe("Fall 2025-26");
    expect(snap.week.MON).toHaveLength(2);
  });
});
