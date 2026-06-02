import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TimetableShareDecodeResult } from "../../lib/types";

const MONO = "monospace";

interface FriendImportPreviewProps {
  readonly pending: TimetableShareDecodeResult;
  readonly status: string;
  readonly onCancel: () => void;
  readonly onImport: () => void;
}

export function FriendImportPreview({ pending, status, onCancel, onImport }: FriendImportPreviewProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
          <Text style={styles.linkText}>← cancel</Text>
        </Pressable>
        <Text style={styles.title}>confirm import</Text>
      </View>
      <View style={styles.preview}>
        <Text style={styles.previewName}>{pending.displayName}</Text>
        <Text style={styles.previewMeta}>{pending.timetables.length} semesters · exported {new Date(pending.exportedAt).toLocaleString()}</Text>
        <Text style={styles.previewMeta}>{pending.encodedBytes} QR bytes · {pending.fingerprint}</Text>
        <Pressable onPress={onImport} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>import friend</Text>
        </Pressable>
        {status ? <Text style={styles.status}>$ {status}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { color: "#fff", fontFamily: MONO, fontSize: 15, fontWeight: "700" },
  linkBtn: { paddingVertical: 6 },
  linkText: { color: "#777", fontFamily: MONO, fontSize: 12 },
  pressed: { opacity: 0.55 },
  preview: { padding: 20, gap: 14 },
  previewName: { color: "#fff", fontFamily: MONO, fontSize: 18, fontWeight: "700" },
  previewMeta: { color: "#777", fontFamily: MONO, fontSize: 12, lineHeight: 18 },
  primaryBtn: { borderColor: "#fff", borderWidth: 1, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  primaryText: { color: "#fff", fontFamily: MONO, fontSize: 13 },
  status: { color: "#555", fontFamily: MONO, fontSize: 11, paddingBottom: 8 },
});
