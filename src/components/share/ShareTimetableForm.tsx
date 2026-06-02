import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { TIMETABLE_SHARE_MAX_BYTES } from "../../lib/timetableShare";

const MONO = "monospace";

export type QrRef = { toDataURL: (callback: (data: string) => void) => void };

interface ShareTimetableFormProps {
  readonly displayName: string;
  readonly encoded: string | null;
  readonly errorMessage: string;
  readonly status: string;
  readonly onBack: () => void;
  readonly onDisplayNameChange: (displayName: string) => void;
  readonly onQrRef: (ref: QrRef | null) => void;
  readonly onShare: () => void;
}

export function ShareTimetableForm({ displayName, encoded, errorMessage, status, onBack, onDisplayNameChange, onQrRef, onShare }: ShareTimetableFormProps) {
  const canShare = encoded !== null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
          <Text style={styles.linkText}>← back</Text>
        </Pressable>
        <Text style={styles.title}>share timetable</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>display name embedded in QR</Text>
        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={onDisplayNameChange}
          placeholder="better-vitty user"
          placeholderTextColor="#333"
          style={styles.input}
          value={displayName}
        />

        <View style={styles.qrBox}>
          {canShare ? (
            <QRCode getRef={(ref) => onQrRef(ref as QrRef | null)} value={encoded} size={240} quietZone={12} />
          ) : (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>

        <Text style={styles.meta}>{canShare ? `${encoded.length}/${TIMETABLE_SHARE_MAX_BYTES} compressed single-QR bytes` : "QR unavailable"}</Text>
        <Text style={styles.note}>privacy: this compressed QR contains your latest semester timetable directly. share it only with people you trust.</Text>

        <View style={styles.actions}>
          <Pressable disabled={!canShare} onPress={onShare} style={({ pressed }) => [styles.primaryBtn, !canShare && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>share image</Text>
          </Pressable>
        </View>

        {status ? <Text style={styles.status}>$ {status}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#fff", fontFamily: MONO, fontSize: 15, fontWeight: "700" },
  linkBtn: { paddingVertical: 8, paddingRight: 12 },
  linkText: { color: "#777", fontFamily: MONO, fontSize: 12 },
  pressed: { opacity: 0.55 },
  content: { flex: 1, padding: 20, gap: 14 },
  label: { color: "#777", fontFamily: MONO, fontSize: 12 },
  input: { borderColor: "#222", borderWidth: 1, color: "#fff", fontFamily: MONO, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
  qrBox: { alignItems: "center", justifyContent: "center", minHeight: 280, backgroundColor: "#fff", padding: 20 },
  errorText: { color: "#8b0000", fontFamily: MONO, fontSize: 12, textAlign: "center" },
  meta: { color: "#555", fontFamily: MONO, fontSize: 11 },
  note: { color: "#888", fontFamily: MONO, fontSize: 12, lineHeight: 18 },
  actions: { gap: 10, marginTop: 8 },
  primaryBtn: { borderColor: "#fff", borderWidth: 1, paddingVertical: 13, alignItems: "center" },
  primaryText: { color: "#fff", fontFamily: MONO, fontSize: 13 },
  disabled: { opacity: 0.4 },
  status: { color: "#555", fontFamily: MONO, fontSize: 11 },
});
