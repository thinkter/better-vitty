import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SemesterTimetable } from "../lib/types";
import {
  DAY_ORDER,
  buildCourseMap,
  buildDayEvents,
  parseEventTimeRange,
  resolveKind,
  resolveTime,
  type Day,
} from "../lib/timetableModel";

export interface WidgetEvent {
  readonly time: string;
  readonly startMinutes: number | null;
  readonly endMinutes: number | null;
  readonly code: string;
  readonly title: string;
  readonly venue: string;
  readonly faculty: string;
  readonly kind: string;
}

export interface WidgetSnapshot {
  readonly v: 1;
  readonly semesterName: string;
  readonly generatedAt: string;
  readonly week: Record<Day, WidgetEvent[]>;
}

export const WIDGET_SNAPSHOT_KEY = "widget_snapshot_v1";

export function buildWidgetSnapshot(timetables: readonly SemesterTimetable[]): WidgetSnapshot {
  const timetable = timetables[0];
  const semesterName = timetable?.semester.name ?? "";
  const dayEvents = buildDayEvents(timetable?.events ?? []);
  const courseMap = buildCourseMap(timetable?.courses ?? []);

  const week = {} as Record<Day, WidgetEvent[]>;
  for (const day of DAY_ORDER) {
    week[day] = dayEvents[day].map((ev) => {
      const course = courseMap.get(ev.courseCode);
      const { startMinutes, endMinutes } = parseEventTimeRange(ev);
      return {
        time: resolveTime(ev),
        startMinutes,
        endMinutes,
        code: ev.courseCode,
        title: course?.title ?? "",
        venue: ev.venue || (course?.venue ?? ""),
        faculty: course?.faculty ?? "",
        kind: resolveKind(ev, course),
      };
    });
  }

  return { v: 1, semesterName, generatedAt: new Date().toISOString(), week };
}

export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WidgetSnapshot;
    if (parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function refreshWidgetFromTimetables(
  timetables: readonly SemesterTimetable[],
): Promise<void> {
  const snapshot = buildWidgetSnapshot(timetables);
  await writeWidgetSnapshot(snapshot);

  try {
    const { requestWidgetUpdate } = await import("react-native-android-widget");
    const { TodayWidget } = await import("./TodayWidget");
    const React = await import("react");
    await requestWidgetUpdate({
      widgetName: "Today",
      renderWidget: (info) =>
        React.createElement(TodayWidget, {
          snapshot,
          widthDp: info.width,
          heightDp: info.height,
        }),
      widgetNotFound: () => undefined,
    });
  } catch {
    // non-fatal: widget not installed or platform not Android
  }
}
