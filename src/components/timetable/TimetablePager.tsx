import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Course, SemesterTimetable, TimetableEvent } from "../../lib/types";
import { usePhoneMetrics } from "../../lib/responsive";

const MONO = "monospace";
export const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
type Day = (typeof DAY_ORDER)[number];
type PhoneMetrics = ReturnType<typeof usePhoneMetrics>;
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
  readonly metrics: PhoneMetrics;
}

function EventRow({ event, course, isLast, metrics }: EventRowProps) {
  const kind = resolveKind(event, course);
  const meta = [event.venue || course?.venue, course?.faculty].filter(Boolean).join("  ·  ");
  return (
    <View>
      <View style={[styles.event, { gap: metrics.eventGap, paddingVertical: metrics.eventPaddingY }]}>
        <View style={styles.eventTopRow}>
          <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.eventTime, { fontSize: metrics.eventTimeFont }]}>{resolveTime(event)}</Text>
          {kind ? <Text maxFontSizeMultiplier={metrics.fontMultiplier} numberOfLines={1} style={[styles.eventKind, { fontSize: metrics.captionFont }]}>{kind}</Text> : null}
        </View>
        <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.eventCode, { fontSize: metrics.eventCodeFont }]}>{event.courseCode}</Text>
        {course?.title ? <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.eventTitle, { fontSize: metrics.eventBodyFont, lineHeight: metrics.eventTitleLineHeight }]}>{course.title}</Text> : null}
        {meta ? <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.eventMeta, { fontSize: metrics.eventMetaFont }]}>{meta}</Text> : null}
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
  readonly metrics: PhoneMetrics;
}

function TimetablePagerHeader({ title, semesterName, showPicker, headerRight, onTogglePicker, metrics }: TimetablePagerHeaderProps) {
  return (
    <View style={[styles.header, { paddingHorizontal: metrics.gutter, paddingTop: metrics.headerTop, paddingBottom: metrics.headerBottom, gap: metrics.headerGap }]}>
      <View style={styles.headerRow}>
        <Text
          ellipsizeMode="tail"
          maxFontSizeMultiplier={metrics.fontMultiplier}
          numberOfLines={1}
          style={[styles.brand, { fontSize: metrics.brandFont }]}
        >
          {title}
        </Text>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onTogglePicker}
        style={({ pressed }) => [styles.semesterBtn, pressed && styles.semesterBtnPressed]}
      >
        <Text
          ellipsizeMode="tail"
          maxFontSizeMultiplier={metrics.fontMultiplier}
          numberOfLines={1}
          style={[styles.semesterName, { fontSize: metrics.tabFont }]}
        >
          {semesterName}  {showPicker ? "▲" : "▼"}
        </Text>
      </Pressable>
    </View>
  );
}

interface SemesterPickerProps {
  readonly timetables: readonly SemesterTimetable[];
  readonly semesterIdx: number;
  readonly onSelect: (index: number) => void;
  readonly metrics: PhoneMetrics;
}

function SemesterPicker({ timetables, semesterIdx, onSelect, metrics }: SemesterPickerProps) {
  return (
    <ScrollView style={styles.picker} contentContainerStyle={styles.pickerContent}>
      {timetables.map((timetable, index) => (
        <Pressable
          accessibilityRole="button"
          key={timetable.semester.id || `${timetable.semester.name}-${index}`}
          onPress={() => onSelect(index)}
          style={({ pressed }) => [styles.pickerRow, { paddingHorizontal: metrics.gutter }, pressed && styles.pickerRowPressed]}
        >
          <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.pickerText, { fontSize: metrics.eventBodyFont }, index === semesterIdx && styles.pickerTextActive]}>
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
  readonly metrics: PhoneMetrics;
}

function DayTabs({ activeIdx, dayEventCounts, onSelectDay, metrics }: DayTabsProps) {
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
              style={[styles.dayTab, { minHeight: metrics.minTouchSize, paddingVertical: metrics.dayTabPaddingY }, active && styles.dayTabActiveBox]}
            >
              <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.dayTabText, { fontSize: metrics.dayTabFont }, !hasClasses && styles.dayTabEmpty, active && styles.dayTabActive]}>{day}</Text>
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
  readonly metrics: PhoneMetrics;
}

function eventKey(event: TimetableEvent, index: number): string {
  return `${event.day}:${event.courseCode}:${event.slot}:${event.time}:${index}`;
}

function DaySchedule({ day, events, courseMap, metrics }: DayScheduleProps) {
  return (
    <ScrollView
      style={styles.dayScroll}
      contentContainerStyle={[styles.dayContent, { paddingHorizontal: metrics.gutter, paddingTop: metrics.scheduleTop, paddingBottom: metrics.scheduleBottom }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {events.length === 0 ? (
        <View style={styles.noClasses}>
          <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.noClassesText, { fontSize: metrics.eventBodyFont }]}>no classes on {day.toLowerCase()}.</Text>
        </View>
      ) : (
        events.map((event, index) => (
          <EventRow
            key={eventKey(event, index)}
            event={event}
            course={courseMap.get(event.courseCode)}
            isLast={index === events.length - 1}
            metrics={metrics}
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
  const metrics = usePhoneMetrics();
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
        metrics={metrics}
      />

      {showPicker ? (
        <SemesterPicker
          timetables={timetables}
          semesterIdx={semesterIdx}
          metrics={metrics}
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
        metrics={metrics}
      />

      <View style={styles.rule} />

      <DaySchedule
        day={activeDay}
        events={activeEvents}
        courseMap={courseMap}
        metrics={metrics}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  emptyScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 24 },
  emptyText: { color: "#555", fontFamily: MONO, fontSize: 14 },
  header: {},
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brand: { color: "#fff", flex: 1, fontFamily: MONO, fontWeight: "700", minWidth: 0 },
  headerRight: { flexShrink: 0 },
  semesterBtn: { alignSelf: "flex-start", maxWidth: "100%" },
  semesterBtnPressed: { opacity: 0.6 },
  semesterName: { color: "#888", fontFamily: MONO },
  picker: { borderTopColor: "#1a1a1a", borderTopWidth: 1, borderBottomColor: "#1a1a1a", borderBottomWidth: 1, maxHeight: 220 },
  pickerContent: { paddingVertical: 2 },
  pickerRow: { paddingVertical: 10 },
  pickerRowPressed: { backgroundColor: "#0d0d0d" },
  pickerText: { color: "#555", fontFamily: MONO },
  pickerTextActive: { color: "#fff" },
  dayTabsOuter: { width: "100%" },
  dayTabs: { flexDirection: "row", alignItems: "stretch", width: "100%" },
  dayTab: { flex: 1, alignItems: "center", justifyContent: "center", borderBottomColor: "transparent", borderBottomWidth: 1 },
  dayTabActiveBox: { borderBottomColor: "#fff" },
  dayTabText: { color: "#444", fontFamily: MONO, letterSpacing: 0 },
  dayTabActive: { color: "#fff" },
  dayTabEmpty: { color: "#2a2a2a" },
  rule: { height: 1, backgroundColor: "#111" },
  dayScroll: { flex: 1 },
  dayContent: { flexGrow: 1 },
  noClasses: { paddingTop: 40, alignItems: "center" },
  noClassesText: { color: "#2a2a2a", fontFamily: MONO },
  event: {},
  eventTopRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 },
  eventTime: { color: "#fff", flexShrink: 0, fontFamily: MONO },
  eventKind: { color: "#444", flexShrink: 1, fontFamily: MONO, marginLeft: 12, maxWidth: "35%", textAlign: "right" },
  eventCode: { color: "#fff", fontFamily: MONO, fontWeight: "700" },
  eventTitle: { color: "#bbb", fontFamily: MONO },
  eventMeta: { color: "#bbb", fontFamily: MONO, marginTop: 2 },
  eventRule: { height: 1, backgroundColor: "#111" },
});
