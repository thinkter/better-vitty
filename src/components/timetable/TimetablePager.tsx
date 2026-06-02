import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Course, SemesterTimetable, TimetableEvent } from "../../lib/types";

const MONO = "monospace";
export const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
type Day = (typeof DAY_ORDER)[number];
const DAYS: readonly Day[] = DAY_ORDER;
const FALLBACK_DAY: Day = "MON";
const SLOT_LETTER_ORDER = "ABCDEFG";

function getCurrentDayIdx(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function parseEventSortKey(ev: TimetableEvent): number {
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(ev.time);
  if (timeMatch) return Number(timeMatch[1]) * 60 + Number(timeMatch[2]);

  const slotMatch = /^([A-Z]+)(\d+)?/.exec(ev.slot);
  if (!slotMatch) return Number.MAX_SAFE_INTEGER;
  const letterIdx = SLOT_LETTER_ORDER.indexOf(slotMatch[1]![0] ?? "");
  const number = Number(slotMatch[2] ?? "0");
  return 1000 + (letterIdx < 0 ? 99 : letterIdx) * 100 + number;
}

function resolveKind(ev: TimetableEvent, course: Course | undefined): string {
  if (ev.kind) return ev.kind;
  if (course?.type === "ETH") return "Theory";
  if (course?.type === "ELA") return "Lab";
  return course?.type ?? "";
}

function resolveTime(ev: TimetableEvent): string {
  return ev.time || ev.slot || "--";
}

function emptyDayBuckets(): Record<Day, TimetableEvent[]> {
  return {
    MON: [],
    TUE: [],
    WED: [],
    THU: [],
    FRI: [],
    SAT: [],
    SUN: [],
  };
}

function dayForEvent(event: TimetableEvent): Day | null {
  const normalized = event.day.trim().toUpperCase();
  for (const day of DAYS) {
    if (normalized.startsWith(day)) return day;
  }
  return null;
}

function buildDayEvents(events: readonly TimetableEvent[]): Record<Day, TimetableEvent[]> {
  const buckets = emptyDayBuckets();
  for (const event of events) {
    const day = dayForEvent(event);
    if (day) buckets[day].push(event);
  }
  for (const day of DAYS) {
    buckets[day].sort((a, b) => parseEventSortKey(a) - parseEventSortKey(b));
  }
  return buckets;
}

function buildCourseMap(courses: readonly Course[]): Map<string, Course> {
  const map = new Map<string, Course>();
  for (const course of courses) {
    if (!map.has(course.code)) map.set(course.code, course);
  }
  return map;
}

interface EventRowProps {
  readonly event: TimetableEvent;
  readonly course: Course | undefined;
  readonly isLast: boolean;
}

function EventRow({ event, course, isLast }: EventRowProps) {
  const kind = resolveKind(event, course);
  const meta = [event.venue || course?.venue, course?.faculty].filter(Boolean).join("  ·  ");
  return (
    <View>
      <View style={styles.event}>
        <View style={styles.eventTopRow}>
          <Text style={styles.eventTime}>{resolveTime(event)}</Text>
          {kind ? <Text style={styles.eventKind}>{kind}</Text> : null}
        </View>
        <Text style={styles.eventCode}>{event.courseCode}</Text>
        {course?.title ? <Text style={styles.eventTitle}>{course.title}</Text> : null}
        {meta ? <Text style={styles.eventMeta}>{meta}</Text> : null}
      </View>
      {!isLast ? <View style={styles.eventRule} /> : null}
    </View>
  );
}

interface TimetablePagerHeaderProps {
  readonly title: string;
  readonly semesterName: string;
  readonly showPicker: boolean;
  readonly headerRight?: ReactNode;
  readonly onTogglePicker: () => void;
}

function TimetablePagerHeader({ title, semesterName, showPicker, headerRight, onTogglePicker }: TimetablePagerHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.brand}>{title}</Text>
        {headerRight}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onTogglePicker}
        style={({ pressed }) => [styles.semesterBtn, pressed && styles.semesterBtnPressed]}
      >
        <Text style={styles.semesterName}>{semesterName}  {showPicker ? "▲" : "▼"}</Text>
      </Pressable>
    </View>
  );
}

interface SemesterPickerProps {
  readonly timetables: readonly SemesterTimetable[];
  readonly semesterIdx: number;
  readonly onSelect: (index: number) => void;
}

function SemesterPicker({ timetables, semesterIdx, onSelect }: SemesterPickerProps) {
  return (
    <ScrollView style={styles.picker} contentContainerStyle={styles.pickerContent}>
      {timetables.map((timetable, index) => (
        <Pressable
          accessibilityRole="button"
          key={timetable.semester.id || `${timetable.semester.name}-${index}`}
          onPress={() => onSelect(index)}
          style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
        >
          <Text style={[styles.pickerText, index === semesterIdx && styles.pickerTextActive]}>
            {index === semesterIdx ? "> " : "  "}{timetable.semester.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

interface DayTabsProps {
  readonly activeIdx: number;
  readonly dayEventCounts: Record<Day, number>;
  readonly onSelectDay: (index: number) => void;
}

function DayTabs({ activeIdx, dayEventCounts, onSelectDay }: DayTabsProps) {
  return (
    <View style={styles.dayTabsOuter}>
      <View style={styles.dayTabs}>
        {DAYS.map((day, idx) => {
          const active = idx === activeIdx;
          const hasClasses = dayEventCounts[day] > 0;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={day}
              onPress={() => onSelectDay(idx)}
              style={[styles.dayTab, active && styles.dayTabActiveBox]}
            >
              <Text style={[styles.dayTabText, !hasClasses && styles.dayTabEmpty, active && styles.dayTabActive]}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface DayScheduleProps {
  readonly day: Day;
  readonly events: readonly TimetableEvent[];
  readonly courseMap: ReadonlyMap<string, Course>;
}

function eventKey(event: TimetableEvent, index: number): string {
  return `${event.day}:${event.courseCode}:${event.slot}:${event.time}:${index}`;
}

function DaySchedule({ day, events, courseMap }: DayScheduleProps) {
  return (
    <ScrollView
      style={styles.dayScroll}
      contentContainerStyle={styles.dayContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {events.length === 0 ? (
        <View style={styles.noClasses}>
          <Text style={styles.noClassesText}>no classes on {day.toLowerCase()}.</Text>
        </View>
      ) : (
        events.map((event, index) => (
          <EventRow
            key={eventKey(event, index)}
            event={event}
            course={courseMap.get(event.courseCode)}
            isLast={index === events.length - 1}
          />
        ))
      )}
    </ScrollView>
  );
}

interface TimetablePagerProps {
  readonly timetables: readonly SemesterTimetable[];
  readonly title?: string;
  readonly headerRight?: ReactNode;
  readonly emptyAction?: ReactNode;
}

export function TimetablePager({ timetables, title = "better-vitty", headerRight, emptyAction }: TimetablePagerProps) {
  const initialDayIdx = useRef(getCurrentDayIdx()).current;
  const [semesterIdx, setSemesterIdx] = useState(0);
  const [dayIdx, setDayIdx] = useState(initialDayIdx);
  const [showPicker, setShowPicker] = useState(false);
  const timetable = timetables[semesterIdx] ?? timetables[0];

  useEffect(() => {
    if (semesterIdx >= timetables.length && timetables.length > 0) {
      setSemesterIdx(timetables.length - 1);
    }
  }, [semesterIdx, timetables.length]);

  const courseMap = useMemo(() => buildCourseMap(timetable?.courses ?? []), [timetable]);
  const dayEvents = useMemo(() => buildDayEvents(timetable?.events ?? []), [timetable]);
  const activeDay: Day = DAYS[dayIdx] ?? FALLBACK_DAY;
  const activeEvents = dayEvents[activeDay];

  const dayEventCounts = useMemo(() => {
    const counts = {} as Record<Day, number>;
    for (const day of DAYS) counts[day] = dayEvents[day].length;
    return counts;
  }, [dayEvents]);

  const selectDay = useCallback((idx: number) => {
    setDayIdx(idx);
    setShowPicker(false);
  }, []);

  if (!timetable) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyText}>no timetable data.</Text>
        {emptyAction}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TimetablePagerHeader
        title={title}
        semesterName={timetable.semester.name}
        showPicker={showPicker}
        headerRight={headerRight}
        onTogglePicker={() => setShowPicker((value) => !value)}
      />

      {showPicker ? (
        <SemesterPicker
          timetables={timetables}
          semesterIdx={semesterIdx}
          onSelect={(index) => {
            setSemesterIdx(index);
            setShowPicker(false);
          }}
        />
      ) : null}

      <DayTabs
        activeIdx={dayIdx}
        dayEventCounts={dayEventCounts}
        onSelectDay={selectDay}
      />

      <View style={styles.rule} />

      <DaySchedule
        day={activeDay}
        events={activeEvents}
        courseMap={courseMap}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  emptyScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 24 },
  emptyText: { color: "#555", fontFamily: MONO, fontSize: 14 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brand: { color: "#fff", fontFamily: MONO, fontSize: 15, fontWeight: "700" },
  semesterBtn: { alignSelf: "flex-start" },
  semesterBtnPressed: { opacity: 0.6 },
  semesterName: { color: "#888", fontFamily: MONO, fontSize: 12 },
  picker: { borderTopColor: "#1a1a1a", borderTopWidth: 1, borderBottomColor: "#1a1a1a", borderBottomWidth: 1, maxHeight: 220 },
  pickerContent: { paddingVertical: 2 },
  pickerRow: { paddingVertical: 10, paddingHorizontal: 20 },
  pickerRowPressed: { backgroundColor: "#0d0d0d" },
  pickerText: { color: "#555", fontFamily: MONO, fontSize: 13 },
  pickerTextActive: { color: "#fff" },
  dayTabsOuter: { width: "100%" },
  dayTabs: { flexDirection: "row", alignItems: "stretch", width: "100%" },
  dayTab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderBottomColor: "transparent", borderBottomWidth: 1 },
  dayTabActiveBox: { borderBottomColor: "#fff" },
  dayTabText: { color: "#444", fontFamily: MONO, fontSize: 13, letterSpacing: 0.5 },
  dayTabActive: { color: "#fff" },
  dayTabEmpty: { color: "#2a2a2a" },
  rule: { height: 1, backgroundColor: "#111" },
  dayScroll: { flex: 1 },
  dayContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, flexGrow: 1 },
  noClasses: { paddingTop: 40, alignItems: "center" },
  noClassesText: { color: "#2a2a2a", fontFamily: MONO, fontSize: 13 },
  event: { gap: 4, paddingVertical: 18 },
  eventTopRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 },
  eventTime: { color: "#fff", fontFamily: MONO, fontSize: 13 },
  eventKind: { color: "#444", fontFamily: MONO, fontSize: 11 },
  eventCode: { color: "#fff", fontFamily: MONO, fontSize: 14, fontWeight: "700" },
  eventTitle: { color: "#bbb", fontFamily: MONO, fontSize: 13, lineHeight: 20 },
  eventMeta: { color: "#bbb", fontFamily: MONO, fontSize: 12, marginTop: 2 },
  eventRule: { height: 1, backgroundColor: "#111" },
});