import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TimetablePager } from "../components/timetable/TimetablePager";
import type { SemesterTimetable } from "../lib/types";
import { usePhoneMetrics } from "../lib/responsive";
import { asVtopError } from "../vtop/errors";

const MONO = "monospace";

interface Props {
  readonly timetables: SemesterTimetable[];
  readonly onResync: () => void;
  readonly onSync: (onStatus?: (status: string) => void) => Promise<void>;
  readonly onShare: () => void;
}

function EmptyTimetableAction({ onResync }: Pick<Props, "onResync">) {
  return (
    <Pressable onPress={onResync} style={styles.emptyBtn}>
      <Text style={styles.emptyBtnText}>sync timetable →</Text>
    </Pressable>
  );
}

interface TimetableHeaderActionsProps {
  readonly syncing: boolean;
  readonly onShare: () => void;
  readonly onSync: () => void;
}

function TimetableHeaderActions({ syncing, onShare, onSync }: TimetableHeaderActionsProps) {
  const metrics = usePhoneMetrics();

  return (
    <View style={[styles.headerActions, { gap: metrics.compact ? 10 : 14 }]}>
      <Pressable accessibilityRole="button" onPress={onShare} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}>
        <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.actionBtnText, { fontSize: metrics.actionFont }]}>[share]</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={syncing} onPress={onSync} style={({ pressed }) => [styles.actionBtn, syncing && styles.actionBtnDisabled, pressed && styles.actionBtnPressed]}>
        <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.actionBtnText, { fontSize: metrics.actionFont }]}>{syncing ? "[syncing]" : "[sync]"}</Text>
      </Pressable>
    </View>
  );
}

export function TimetableScreen({ timetables, onResync, onSync, onShare }: Props) {
  const metrics = usePhoneMetrics();
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
        emptyAction={<EmptyTimetableAction onResync={onResync} />}
        headerRight={<TimetableHeaderActions syncing={syncing} onShare={onShare} onSync={syncTimetables} />}
      />
      {syncStatus ? <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.syncStatus, { fontSize: metrics.captionFont, paddingHorizontal: metrics.gutter }]}>$ {syncStatus}</Text> : null}
      {syncError ? <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.syncError, { fontSize: metrics.captionFont, paddingHorizontal: metrics.gutter }]}>! {syncError}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  emptyBtn: { borderColor: "#fff", borderWidth: 1, paddingVertical: 12, paddingHorizontal: 20 },
  emptyBtnText: { color: "#fff", fontFamily: MONO, fontSize: 14 },
  headerActions: { flexDirection: "row" },
  actionBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnPressed: { opacity: 0.5 },
  actionBtnText: { color: "#555", fontFamily: MONO },
  syncStatus: { color: "#555", fontFamily: MONO, paddingBottom: 6 },
  syncError: { color: "#ff7777", fontFamily: MONO, paddingBottom: 6 },
});
