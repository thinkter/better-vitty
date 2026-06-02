import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { FriendTimetable } from "../../lib/types";
import { TimetablePager } from "../timetable/TimetablePager";

const MONO = "monospace";

interface FriendTimetableViewProps {
  readonly friend: FriendTimetable;
  readonly status: string;
  readonly onBack: () => void;
  readonly onDelete: () => void;
}

export function FriendTimetableView({ friend, status, onBack, onDelete }: FriendTimetableViewProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <TimetablePager
        title={friend.displayName}
        timetables={friend.timetables}
        headerRight={
          <View style={styles.headerActions}>
            <Pressable onPress={onBack} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
              <Text style={styles.linkText}>[back]</Text>
            </Pressable>
            <Pressable onPress={onDelete} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
              <Text style={styles.dangerText}>[delete]</Text>
            </Pressable>
          </View>
        }
      />
      {status ? <Text style={styles.status}>$ {status}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  linkBtn: { paddingVertical: 6 },
  linkText: { color: "#777", fontFamily: MONO, fontSize: 12 },
  dangerText: { color: "#ff7777", fontFamily: MONO, fontSize: 12 },
  pressed: { opacity: 0.55 },
  status: { color: "#555", fontFamily: MONO, fontSize: 11, paddingHorizontal: 20, paddingBottom: 8 },
});
