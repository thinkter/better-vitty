import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { FriendTimetable } from "../../lib/types";
import { usePhoneMetrics } from "../../lib/responsive";
import { TimetablePager } from "../timetable/TimetablePager";

const MONO = "monospace";

interface FriendTimetableViewProps {
  readonly friend: FriendTimetable;
  readonly status: string;
  readonly onBack: () => void;
  readonly onDelete: () => void;
}

export function FriendTimetableView({ friend, status, onBack, onDelete }: FriendTimetableViewProps) {
  const metrics = usePhoneMetrics();

  return (
    <SafeAreaView style={styles.screen}>
      <TimetablePager
        title={friend.registrationNumber ? `${friend.displayName} · ${friend.registrationNumber}` : friend.displayName}
        timetables={friend.timetables}
        headerRight={
          <View style={[styles.headerActions, { gap: metrics.compact ? 10 : 12 }]}>
            <Pressable onPress={onBack} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
              <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.linkText, { fontSize: metrics.actionFont }]}>[back]</Text>
            </Pressable>
            <Pressable onPress={onDelete} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
              <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.dangerText, { fontSize: metrics.actionFont }]}>[delete]</Text>
            </Pressable>
          </View>
        }
      />
      {status ? <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.status, { fontSize: metrics.captionFont, paddingHorizontal: metrics.gutter }]}>$ {status}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  linkBtn: { paddingVertical: 6 },
  linkText: { color: "#777", fontFamily: MONO },
  dangerText: { color: "#ff7777", fontFamily: MONO },
  pressed: { opacity: 0.55 },
  status: { color: "#555", fontFamily: MONO, paddingBottom: 8 },
});
