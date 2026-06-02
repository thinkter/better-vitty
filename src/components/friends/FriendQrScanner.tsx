import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, type BarcodeScanningResult } from "expo-camera";

const MONO = "monospace";

interface FriendQrScannerProps {
  readonly status: string;
  readonly onBack: () => void;
  readonly onScan: (raw: string) => void;
}

export function FriendQrScanner({ status, onBack, onScan }: FriendQrScannerProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
          <Text style={styles.linkText}>← friends</Text>
        </Pressable>
        <Text style={styles.title}>scan QR</Text>
      </View>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={(result: BarcodeScanningResult) => onScan(result.data)}
      />
      {status ? <Text style={styles.status}>$ {status}</Text> : null}
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
  camera: { flex: 1, margin: 20, borderColor: "#222", borderWidth: 1 },
  status: { color: "#555", fontFamily: MONO, fontSize: 11, paddingHorizontal: 20, paddingBottom: 8 },
});
