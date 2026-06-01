import { useCallback, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
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
const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
type Day = (typeof DAY_ORDER)[number];

function getCurrentDayIdx(): number {
  // getDay(): 0=Sun, 1=Mon … 6=Sat. Map to DAY_ORDER index.
  const jsDay = new Date().getDay();
  return jsDay === 0 ? DAY_ORDER.length - 1 : jsDay - 1;
}

// VTOP timetable pages often omit a clock time — the slot code (A2, B2, L7, etc.)
// is the only time indicator. Use slot order as a fallback for sorting.
const SLOT_LETTER_ORDER = "ABCDEFG";

function parseEventSortKey(ev: TimetableEvent): number {
  // Prefer explicit clock time when the parser captured it.
  const timeParts = /^(\d{1,2}):(\d{2})/.exec(ev.time);
  if (timeParts) return Number(timeParts[1]) * 60 + Number(timeParts[2]);

  const slot = ev.slot;
  // Lab slots: L7+L8, L11+L12, etc.
  const labMatch = /^L(\d+)/.exec(slot);
  if (labMatch) return 10000 + Number(labMatch[1]);
  // Tutorial/theory: TA2, TF1, A2, G1, etc.
  const letterMatch = /^T?([A-G])/i.exec(slot);
  if (letterMatch)
    return (SLOT_LETTER_ORDER.indexOf(letterMatch[1]!.toUpperCase()) + 1) * 100;

  return 99999;
}

function resolveKind(ev: TimetableEvent, course: Course | undefined): string {
  if (ev.kind) return ev.kind.toLowerCase();
  const title = course?.title?.toLowerCase() ?? "";
  if (title.includes(" lab") || title.endsWith("lab")) return "lab";
  const type = course?.type?.toLowerCase() ?? "";
  if (type.includes("lab")) return "lab";
  if (type.includes("theory")) return "theory";
  return "";
}

function resolveTime(ev: TimetableEvent): string {
  if (ev.time) return ev.time;
  // Show slot code as a human-readable label when clock time is absent.
  return ev.slot || "";
}

function eventsForDay(
  events: readonly TimetableEvent[],
  day: Day,
): TimetableEvent[] {
  const prefix = day.slice(0, 3).toUpperCase();
  return [...events.filter((e) => e.day.toUpperCase().startsWith(prefix))].sort(
    (a, b) => parseEventSortKey(a) - parseEventSortKey(b),
  );
}

function findCourse(
  courses: readonly Course[],
  code: string,
): Course | undefined {
  return courses.find((c) => c.code === code);
}

interface Props {
  timetables: SemesterTimetable[];
  onResync: () => void;
  onSync: (onStatus?: (status: string) => void) => Promise<void>;
}

export function TimetableScreen({ timetables, onResync, onSync }: Props) {
  const { width } = useWindowDimensions();
  const initialDayIdx = useRef(getCurrentDayIdx()).current;
  const [semesterIdx, setSemesterIdx] = useState(0);
  const [dayIdx, setDayIdx] = useState(initialDayIdx);
  const [showPicker, setShowPicker] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncError, setSyncError] = useState("");
  const dayListRef = useRef<FlatList<Day>>(null);
  const scrollX = useRef(new Animated.Value(initialDayIdx * width)).current;
  const tabWidth = width / DAY_ORDER.length;

  const timetable = timetables[semesterIdx];

  const selectDay = useCallback((idx: number) => {
    setDayIdx(idx);
    setShowPicker(false);
    dayListRef.current?.scrollToOffset({ offset: idx * width, animated: true });
  }, [width]);

  const syncTimetables = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError("");
    setSyncStatus("connecting to vtop...");
    try {
      await onSync(setSyncStatus);
    } catch (err) {
      const vtopError = asVtopError(err);
      setSyncError(`${vtopError.code}: ${vtopError.message}`);
      setSyncStatus("sync failed");
    } finally {
      setSyncing(false);
    }
  }, [onSync, syncing]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.max(0, Math.min(DAY_ORDER.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
      if (idx !== dayIdx) setDayIdx(idx);
    },
    [dayIdx, width],
  );

  const dayIndicatorTranslateX = scrollX.interpolate({
    inputRange: DAY_ORDER.map((_, idx) => idx * width),
    outputRange: DAY_ORDER.map((_, idx) => idx * tabWidth),
    extrapolate: "clamp",
  });

  if (!timetable) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyScreen}>
          <Text style={styles.emptyText}>no timetable data.</Text>
          <Pressable onPress={onResync} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>sync timetable →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>better-vitty</Text>
          <Pressable
            accessibilityRole="button"
            disabled={syncing}
            onPress={syncTimetables}
            style={({ pressed }) => [
              styles.actionBtn,
              syncing && styles.actionBtnDisabled,
              pressed && styles.actionBtnPressed,
            ]}
          >
            <Text style={styles.actionBtnText}>
              {syncing ? "[syncing]" : "[sync]"}
            </Text>
          </Pressable>
        </View>

        {/* Semester selector */}
        <Pressable
          onPress={() => setShowPicker((v) => !v)}
          style={({ pressed }) => [
            styles.semesterBtn,
            pressed && styles.semesterBtnPressed,
          ]}
        >
          <Text style={styles.semesterName}>
            {timetable.semester.name}
            {"  "}
            {showPicker ? "▲" : "▼"}
          </Text>
        </Pressable>
        {syncStatus ? <Text style={styles.syncStatus}>$ {syncStatus}</Text> : null}
        {syncError ? <Text style={styles.syncError}>! {syncError}</Text> : null}
      </View>

      {/* ── Semester picker ── */}
      {showPicker && (
        <View style={styles.picker}>
          {timetables.map((t, idx) => (
            <Pressable
              key={t.semester.id}
              onPress={() => {
                setSemesterIdx(idx);
                setShowPicker(false);
              }}
              style={({ pressed }) => [
                styles.pickerRow,
                pressed && styles.pickerRowPressed,
              ]}
            >
              <Text
                style={[
                  styles.pickerText,
                  idx === semesterIdx && styles.pickerTextActive,
                ]}
              >
                {idx === semesterIdx ? "> " : "  "}
                {t.semester.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Day tabs ── */}
      <View style={styles.dayTabsOuter}>
        <View style={styles.dayTabs}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dayIndicator,
              {
                width: tabWidth,
                transform: [{ translateX: dayIndicatorTranslateX }],
              },
            ]}
          />
          {DAY_ORDER.map((day, idx) => {
            const active = idx === dayIdx;
            const hasClasses = eventsForDay(timetable.events, day).length > 0;
            return (
              <Pressable
                key={day}
                onPress={() => selectDay(idx)}
                style={[styles.dayTab, { width: tabWidth }]}
              >
                <Text
                  style={[
                    styles.dayTabText,
                    !hasClasses && styles.dayTabEmpty,
                    active && styles.dayTabActive,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.rule} />

      {/* ── Swipeable day content ── */}
      <Animated.FlatList
        ref={dayListRef}
        data={DAY_ORDER}
        horizontal
        pagingEnabled
        snapToInterval={width}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={dayIdx}
        getItemLayout={(_, index) => ({
          length: width,
          offset: index * width,
          index,
        })}
        keyExtractor={(day) => day}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={8}
        style={styles.dayList}
        renderItem={({ item: day }) => {
          const events = eventsForDay(timetable.events, day);
          return (
            <ScrollView
              style={[styles.dayPage, { width }]}
              contentContainerStyle={styles.dayPageContent}
            >
              {events.length === 0 ? (
                <View style={styles.noClasses}>
                  <Text style={styles.noClassesText}>
                    no classes on {day.toLowerCase()}.
                  </Text>
                </View>
              ) : (
                events.map((ev, i) => {
                  const course = findCourse(timetable.courses, ev.courseCode);
                  const meta = [ev.venue || course?.venue, course?.faculty]
                    .filter(Boolean)
                    .join("  ·  ");
                  return (
                    <View key={`${ev.courseCode}-${ev.time}-${i}`}>
                      <View style={styles.event}>
                        <View style={styles.eventTopRow}>
                          <Text style={styles.eventTime}>
                            {resolveTime(ev)}
                          </Text>
                          {resolveKind(ev, course) ? (
                            <Text style={styles.eventKind}>
                              {resolveKind(ev, course)}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.eventCode}>{ev.courseCode}</Text>
                        {course?.title ? (
                          <Text style={styles.eventTitle}>{course.title}</Text>
                        ) : null}
                        {meta ? (
                          <Text style={styles.eventMeta}>{meta}</Text>
                        ) : null}
                      </View>
                      {i < events.length - 1 && (
                        <View style={styles.eventRule} />
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },

  // ── empty fallback ──
  emptyScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    padding: 24,
  },
  emptyText: {
    color: "#555",
    fontFamily: MONO,
    fontSize: 14,
  },
  emptyBtn: {
    borderColor: "#fff",
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  emptyBtnText: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 14,
  },

  // ── header ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: "700",
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnPressed: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: "#555",
    fontFamily: MONO,
    fontSize: 12,
  },
  semesterBtn: {
    alignSelf: "flex-start",
  },
  semesterBtnPressed: {
    opacity: 0.6,
  },
  semesterName: {
    color: "#888",
    fontFamily: MONO,
    fontSize: 12,
  },
  syncStatus: {
    color: "#555",
    fontFamily: MONO,
    fontSize: 11,
  },
  syncError: {
    color: "#ff7777",
    fontFamily: MONO,
    fontSize: 11,
  },

  // ── semester picker ──
  picker: {
    borderTopColor: "#1a1a1a",
    borderTopWidth: 1,
    borderBottomColor: "#1a1a1a",
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  pickerRow: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  pickerRowPressed: {
    backgroundColor: "#0d0d0d",
  },
  pickerText: {
    color: "#555",
    fontFamily: MONO,
    fontSize: 13,
  },
  pickerTextActive: {
    color: "#fff",
  },

  // ── day tabs ──
  dayTabsOuter: {
    width: "100%",
  },
  dayTabs: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  dayIndicator: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 1,
    backgroundColor: "#fff",
  },
  dayTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  dayTabText: {
    color: "#444",
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  dayTabActive: {
    color: "#fff",
  },
  dayTabEmpty: {
    color: "#2a2a2a",
  },

  // ── separator ──
  rule: {
    height: 1,
    backgroundColor: "#111",
  },

  // ── day content ──
  dayList: {
    flex: 1,
  },
  dayPage: {
    flex: 1,
  },
  dayPageContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  noClasses: {
    paddingTop: 40,
    alignItems: "center",
  },
  noClassesText: {
    color: "#2a2a2a",
    fontFamily: MONO,
    fontSize: 13,
  },

  // ── event block ──
  event: {
    gap: 4,
    paddingVertical: 18,
  },
  eventTopRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  eventTime: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 13,
  },
  eventKind: {
    color: "#444",
    fontFamily: MONO,
    fontSize: 11,
  },
  eventCode: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 14,
    fontWeight: "700",
  },
  eventTitle: {
    color: "#bbb",
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 20,
  },
  eventMeta: {
    color: "#bbb",
    fontFamily: MONO,
    fontSize: 12,
    marginTop: 2,
  },
  eventRule: {
    height: 1,
    backgroundColor: "#111",
  },
});
