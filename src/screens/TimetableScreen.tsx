import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Course, SemesterTimetable, TimetableEvent } from "../lib/types";
import { asVtopError } from "../vtop/errors";

const MONO = "monospace";
export const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
type Day = (typeof DAY_ORDER)[number];
const DAYS: Day[] = [...DAY_ORDER];

function getCurrentDayIdx(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

const SLOT_LETTER_ORDER = "ABCDEFG";

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

function eventsForDay(events: readonly TimetableEvent[], day: Day): TimetableEvent[] {
  return events
    .filter((ev) => ev.day.toUpperCase().startsWith(day))
    .sort((a, b) => parseEventSortKey(a) - parseEventSortKey(b));
}

function findCourse(courses: readonly Course[], code: string): Course | undefined {
  return courses.find((c) => c.code === code);
}

interface TimetablePagerProps {
  readonly timetables: readonly SemesterTimetable[];
  readonly title?: string;
  readonly headerRight?: ReactNode;
  readonly emptyAction?: ReactNode;
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
      {!isLast && <View style={styles.eventRule} />}
    </View>
  );
}

export function TimetablePager({ timetables, title = "better-vitty", headerRight, emptyAction }: TimetablePagerProps) {
  const { width } = useWindowDimensions();
  const initialDayIdx = useRef(getCurrentDayIdx()).current;
  const [semesterIdx, setSemesterIdx] = useState(0);
  const [dayIdx, setDayIdx] = useState(initialDayIdx);
  const [showPicker, setShowPicker] = useState(false);
  const dayListRef = useRef<FlatList<Day>>(null);
  const scrollX = useRef(new Animated.Value(initialDayIdx * width)).current;
  const tabWidth = width / DAY_ORDER.length;
  const timetable = timetables[semesterIdx] ?? timetables[0];

  const dayEventCounts = useMemo(() => {
    if (!timetable) return new Map<Day, number>();
    return new Map(DAYS.map((day) => [day, eventsForDay(timetable.events, day).length]));
  }, [timetable]);

  const selectDay = useCallback((idx: number) => {
    setDayIdx(idx);
    setShowPicker(false);
    dayListRef.current?.scrollToOffset({ offset: idx * width, animated: true });
  }, [width]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      dayListRef.current?.scrollToOffset({ offset: dayIdx * width, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [dayIdx, semesterIdx, showPicker, width]);

  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(DAY_ORDER.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
    if (idx !== dayIdx) setDayIdx(idx);
  }, [dayIdx, width]);

  const dayIndicatorTranslateX = scrollX.interpolate({
    inputRange: DAYS.map((_, idx) => idx * width),
    outputRange: DAYS.map((_, idx) => idx * tabWidth),
    extrapolate: "clamp",
  });

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
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>{title}</Text>
          {headerRight}
        </View>

        <Pressable onPress={() => setShowPicker((v) => !v)} style={({ pressed }) => [styles.semesterBtn, pressed && styles.semesterBtnPressed]}>
          <Text style={styles.semesterName}>{timetable.semester.name}  {showPicker ? "▲" : "▼"}</Text>
        </Pressable>
      </View>

      {showPicker && (
        <FlatList
          data={timetables}
          keyExtractor={(item) => item.semester.id}
          style={styles.picker}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => {
                setSemesterIdx(index);
                setShowPicker(false);
              }}
              style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
            >
              <Text style={[styles.pickerText, index === semesterIdx && styles.pickerTextActive]}>
                {index === semesterIdx ? "> " : "  "}{item.semester.name}
              </Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.dayTabsOuter}>
        <View style={styles.dayTabs}>
          <Animated.View pointerEvents="none" style={[styles.dayIndicator, { width: tabWidth, transform: [{ translateX: dayIndicatorTranslateX }] }]} />
          {DAYS.map((day, idx) => {
            const active = idx === dayIdx;
            const hasClasses = (dayEventCounts.get(day) ?? 0) > 0;
            return (
              <Pressable key={day} onPress={() => selectDay(idx)} style={[styles.dayTab, { width: tabWidth }]}>
                <Text style={[styles.dayTabText, !hasClasses && styles.dayTabEmpty, active && styles.dayTabActive]}>{day}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.rule} />

      <Animated.FlatList
        ref={dayListRef}
        data={DAYS}
        extraData={`${semesterIdx}:${dayIdx}:${showPicker}`}
        horizontal
        pagingEnabled
        snapToInterval={width}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        overScrollMode="never"
        removeClippedSubviews={false}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={dayIdx}
        getItemLayout={(_, index) => ({ length: width, offset: index * width, index })}
        keyExtractor={(day) => day}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={8}
        style={styles.dayList}
        renderItem={({ item: day }) => {
          const events = eventsForDay(timetable.events, day);
          return (
            <FlatList
              data={events}
              style={[styles.dayPage, { width }]}
              contentContainerStyle={styles.dayPageContent}
              keyExtractor={(event, index) => `${event.courseCode}-${event.slot}-${event.time}-${index}`}
              renderItem={({ item, index }) => <EventRow event={item} course={findCourse(timetable.courses, item.courseCode)} isLast={index === events.length - 1} />}
              ListEmptyComponent={
                <View style={styles.noClasses}>
                  <Text style={styles.noClassesText}>no classes on {day.toLowerCase()}.</Text>
                </View>
              }
            />
          );
        }}
      />
    </View>
  );
}

interface Props {
  readonly timetables: SemesterTimetable[];
  readonly onResync: () => void;
  readonly onSync: (onStatus?: (status: string) => void) => Promise<void>;
  readonly onShare: () => void;
}

export function TimetableScreen({ timetables, onResync, onSync, onShare }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncError, setSyncError] = useState("");

  const syncTimetables = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError("");
    setSyncStatus("connecting to vtop...");
    try {
      await onSync(setSyncStatus);
      setSyncStatus("sync complete");
    } catch (err) {
      const vtopError = asVtopError(err);
      setSyncError(`${vtopError.code}: ${vtopError.message}`);
      setSyncStatus("sync failed");
    } finally {
      setSyncing(false);
    }
  }, [onSync, syncing]);

  return (
    <SafeAreaView style={styles.screen}>
      <TimetablePager
        timetables={timetables}
        emptyAction={
          <Pressable onPress={onResync} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>sync timetable →</Text>
          </Pressable>
        }
        headerRight={
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" onPress={onShare} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}>
              <Text style={styles.actionBtnText}>[share]</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={syncing} onPress={syncTimetables} style={({ pressed }) => [styles.actionBtn, syncing && styles.actionBtnDisabled, pressed && styles.actionBtnPressed]}>
              <Text style={styles.actionBtnText}>{syncing ? "[syncing]" : "[sync]"}</Text>
            </Pressable>
          </View>
        }
      />
      {syncStatus ? <Text style={styles.syncStatus}>$ {syncStatus}</Text> : null}
      {syncError ? <Text style={styles.syncError}>! {syncError}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  emptyScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 24 },
  emptyText: { color: "#555", fontFamily: MONO, fontSize: 14 },
  emptyBtn: { borderColor: "#fff", borderWidth: 1, paddingVertical: 12, paddingHorizontal: 20 },
  emptyBtnText: { color: "#fff", fontFamily: MONO, fontSize: 14 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brand: { color: "#fff", fontFamily: MONO, fontSize: 15, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 14 },
  actionBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnPressed: { opacity: 0.5 },
  actionBtnText: { color: "#555", fontFamily: MONO, fontSize: 12 },
  semesterBtn: { alignSelf: "flex-start" },
  semesterBtnPressed: { opacity: 0.6 },
  semesterName: { color: "#888", fontFamily: MONO, fontSize: 12 },
  syncStatus: { color: "#555", fontFamily: MONO, fontSize: 11, paddingHorizontal: 20, paddingBottom: 6 },
  syncError: { color: "#ff7777", fontFamily: MONO, fontSize: 11, paddingHorizontal: 20, paddingBottom: 6 },
  picker: { borderTopColor: "#1a1a1a", borderTopWidth: 1, borderBottomColor: "#1a1a1a", borderBottomWidth: 1, maxHeight: 220 },
  pickerRow: { paddingVertical: 10, paddingHorizontal: 20 },
  pickerRowPressed: { backgroundColor: "#0d0d0d" },
  pickerText: { color: "#555", fontFamily: MONO, fontSize: 13 },
  pickerTextActive: { color: "#fff" },
  dayTabsOuter: { width: "100%" },
  dayTabs: { position: "relative", flexDirection: "row", alignItems: "center", width: "100%" },
  dayIndicator: { position: "absolute", left: 0, bottom: 0, height: 1, backgroundColor: "#fff" },
  dayTab: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  dayTabText: { color: "#444", fontFamily: MONO, fontSize: 13, letterSpacing: 0.5 },
  dayTabActive: { color: "#fff" },
  dayTabEmpty: { color: "#2a2a2a" },
  rule: { height: 1, backgroundColor: "#111" },
  dayList: { flex: 1 },
  dayPage: { flex: 1 },
  dayPageContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, flexGrow: 1 },
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
