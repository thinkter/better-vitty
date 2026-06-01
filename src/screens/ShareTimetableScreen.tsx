import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { EncodingType, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SemesterTimetable } from "../lib/types";
import { TIMETABLE_SHARE_MAX_BYTES, TimetableShareError, encodeTimetableSharePayload } from "../lib/timetableShare";

const MONO = "monospace";

type QrRef = { toDataURL: (callback: (data: string) => void) => void };

interface Props {
  readonly timetables: readonly SemesterTimetable[];
  readonly onBack: () => void;
}

function qrPngBase64(ref: QrRef): Promise<string> {
  return new Promise((resolve) => ref.toDataURL(resolve));
}

export function ShareTimetableScreen({ timetables, onBack }: Props) {
  const qrRef = useRef<QrRef | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");

  const encoded = useMemo(() => {
    try {
      return encodeTimetableSharePayload({ displayName, timetables });
    } catch (err) {
      return err;
    }
  }, [displayName, timetables]);

  const canShare = typeof encoded === "string";

  async function writeQrPng(): Promise<string> {
    if (!qrRef.current) throw new Error("QR preview is not ready");
    const base64 = await qrPngBase64(qrRef.current);
    const file = new File(Paths.cache, `better-vitty-timetable-${Date.now()}.png`);
    file.write(base64, { encoding: EncodingType.Base64 });
    return file.uri;
  }

  async function shareQr() {
    if (!canShare) return;
    setStatus("preparing QR image...");
    try {
      const uri = await writeQrPng();
      if (!(await Sharing.isAvailableAsync())) {
        setStatus("sharing is not available on this device");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "share timetable QR" });
      setStatus("share sheet opened");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "failed to share QR");
    }
  }


  const errorMessage = encoded instanceof TimetableShareError ? encoded.message : encoded instanceof Error ? encoded.message : "";

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
          onChangeText={setDisplayName}
          placeholder="better-vitty user"
          placeholderTextColor="#333"
          style={styles.input}
          value={displayName}
        />

        <View style={styles.qrBox}>
          {canShare ? (
            <QRCode getRef={(ref) => { qrRef.current = ref as QrRef | null; }} value={encoded} size={240} quietZone={12} />
          ) : (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>

        <Text style={styles.meta}>{canShare ? `${encoded.length}/${TIMETABLE_SHARE_MAX_BYTES} QR bytes` : "QR unavailable"}</Text>
        <Text style={styles.note}>privacy: this QR contains your timetable data directly. share it only with people you trust.</Text>

        <View style={styles.actions}>
          <Pressable disabled={!canShare} onPress={shareQr} style={({ pressed }) => [styles.primaryBtn, !canShare && styles.disabled, pressed && styles.pressed]}>
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
