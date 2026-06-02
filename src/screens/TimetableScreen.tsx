import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TimetablePager } from "../components/timetable/TimetablePager";
import type { SemesterTimetable } from "../lib/types";
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
  return (
    <View style={styles.headerActions}>
      <Pressable accessibilityRole="button" onPress={onShare} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}>
        <Text style={styles.actionBtnText}>[share]</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={syncing} onPress={onSync} style={({ pressed }) => [styles.actionBtn, syncing && styles.actionBtnDisabled, pressed && styles.actionBtnPressed]}>
        <Text style={styles.actionBtnText}>{syncing ? "[syncing]" : "[sync]"}</Text>
      </Pressable>
    </View>
  );
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
        emptyAction={<EmptyTimetableAction onResync={onResync} />}
        headerRight={<TimetableHeaderActions syncing={syncing} onShare={onShare} onSync={syncTimetables} />}
      />
      {syncStatus ? <Text style={styles.syncStatus}>$ {syncStatus}</Text> : null}
      {syncError ? <Text style={styles.syncError}>! {syncError}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  emptyBtn: { borderColor: "#fff", borderWidth: 1, paddingVertical: 12, paddingHorizontal: 20 },
  emptyBtnText: { color: "#fff", fontFamily: MONO, fontSize: 14 },
  headerActions: { flexDirection: "row", gap: 14 },
  actionBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnPressed: { opacity: 0.5 },
  actionBtnText: { color: "#555", fontFamily: MONO, fontSize: 12 },
  syncStatus: { color: "#555", fontFamily: MONO, fontSize: 11, paddingHorizontal: 20, paddingBottom: 6 },
  syncError: { color: "#ff7777", fontFamily: MONO, fontSize: 11, paddingHorizontal: 20, paddingBottom: 6 },
});
