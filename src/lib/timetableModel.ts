import type { Course, TimetableEvent } from "./types";

export const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Day = (typeof DAY_ORDER)[number];

const SLOT_LETTER_ORDER = "ABCDEFG";

export function getCurrentDayIdx(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function parseEventSortKey(ev: TimetableEvent): number {
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(ev.time);
  if (timeMatch) return Number(timeMatch[1]) * 60 + Number(timeMatch[2]);

  const slotMatch = /^([A-Z]+)(\d+)?/.exec(ev.slot);
  if (!slotMatch) return Number.MAX_SAFE_INTEGER;
  const letterIdx = SLOT_LETTER_ORDER.indexOf(slotMatch[1]![0] ?? "");
  const number = Number(slotMatch[2] ?? "0");
  return 1000 + (letterIdx < 0 ? 99 : letterIdx) * 100 + number;
}

export function resolveKind(ev: TimetableEvent, course: Course | undefined): string {
  if (ev.kind) return ev.kind;
  if (course?.type === "ETH") return "Theory";
  if (course?.type === "ELA") return "Lab";
  return course?.type ?? "";
}

export function resolveTime(ev: TimetableEvent): string {
  return ev.time || ev.slot || "--";
}

function emptyDayBuckets(): Record<Day, TimetableEvent[]> {
  return { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
}

export function dayForEvent(event: TimetableEvent): Day | null {
  const normalized = event.day.trim().toUpperCase();
  for (const day of DAY_ORDER) {
    if (normalized.startsWith(day)) return day;
  }
  return null;
}

export function buildDayEvents(events: readonly TimetableEvent[]): Record<Day, TimetableEvent[]> {
  const buckets = emptyDayBuckets();
  for (const event of events) {
    const day = dayForEvent(event);
    if (day) buckets[day].push(event);
  }
  for (const day of DAY_ORDER) {
    buckets[day].sort((a, b) => parseEventSortKey(a) - parseEventSortKey(b));
  }
  return buckets;
}

export function buildCourseMap(courses: readonly Course[]): Map<string, Course> {
  const map = new Map<string, Course>();
  for (const course of courses) {
    if (!map.has(course.code)) map.set(course.code, course);
  }
  return map;
}

export interface EventTimeRange {
  readonly startMinutes: number | null;
  readonly endMinutes: number | null;
}

function parseMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function parseEventTimeRange(ev: TimetableEvent): EventTimeRange {
  const time = ev.time.trim();
  const rangeMatch = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(time);
  if (rangeMatch) {
    return { startMinutes: parseMinutes(rangeMatch[1]!), endMinutes: parseMinutes(rangeMatch[2]!) };
  }
  const single = parseMinutes(time);
  return { startMinutes: single, endMinutes: single };
}

export interface CurrentNextResult {
  readonly currentIndex: number | null;
  readonly nextIndex: number | null;
}

export function selectCurrentNext(
  events: readonly TimetableEvent[],
  nowMinutes: number,
): CurrentNextResult {
  let currentIndex: number | null = null;
  let nextIndex: number | null = null;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    const { startMinutes, endMinutes } = parseEventTimeRange(ev);
    if (startMinutes !== null && endMinutes !== null) {
      if (startMinutes <= nowMinutes && nowMinutes <= endMinutes) {
        currentIndex = i;
        continue;
      }
      if (startMinutes > nowMinutes && nextIndex === null) {
        nextIndex = i;
      }
    }
  }

  return { currentIndex, nextIndex };
}
