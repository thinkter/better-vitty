import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, Camera, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import type { FriendTimetable, TimetableShareDecodeResult } from "../lib/types";
import { TimetableShareError, decodeTimetableSharePayload } from "../lib/timetableShare";
import { deleteFriend, loadFriends, upsertFriend } from "../storage/friendsStore";
import { TimetablePager } from "./TimetableScreen";

const MONO = "monospace";

function decodeStatus(err: unknown): string {
  if (err instanceof TimetableShareError) return err.message;
  return err instanceof Error ? err.message : "failed to import timetable QR";
}

export function FriendsScreen() {
  const [friends, setFriends] = useState<FriendTimetable[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<FriendTimetable | null>(null);
  const [pending, setPending] = useState<TimetableShareDecodeResult | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const refreshFriends = useCallback(async () => {
    setFriends(await loadFriends());
  }, []);

  useEffect(() => {
    refreshFriends().catch((err) => setStatus(decodeStatus(err)));
  }, [refreshFriends]);

  const filteredFriends = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return friends;
    return friends.filter((friend) => {
      if (friend.displayName.toLocaleLowerCase().includes(normalized)) return true;
      return friend.timetables.some((timetable) =>
        timetable.courses.some((course) =>
          course.code.toLocaleLowerCase().includes(normalized)
          || course.title.toLocaleLowerCase().includes(normalized)
          || course.faculty.toLocaleLowerCase().includes(normalized),
        ),
      );
    });
  }, [friends, query]);

  async function importDecoded(decoded: TimetableShareDecodeResult) {
    const friend = await upsertFriend(decoded);
    await refreshFriends();
    setSelected(friend);
    setPending(null);
    setStatus(`imported ${friend.displayName}`);
  }

  function stageRawQr(raw: string) {
    try {
      setPending(decodeTimetableSharePayload(raw));
      setScannerOpen(false);
      setStatus("preview import before saving");
    } catch (err) {
      setStatus(decodeStatus(err));
    }
  }

  async function openScanner() {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) {
      setStatus("camera permission denied");
      return;
    }
    setScannerOpen(true);
    setStatus("scan a better-vitty QR");
  }

  async function importFromGallery() {
    setStatus("opening gallery...");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
    if (!permission.granted) {
      setStatus("photo permission denied");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1 });
    if (picked.canceled || !picked.assets[0]) {
      setStatus("image import cancelled");
      return;
    }
    try {
      const scans = await Camera.scanFromURLAsync(picked.assets[0].uri, ["qr"]);
      const qr = scans.find((scan) => scan.type === "qr") ?? scans[0];
      if (!qr?.data) {
        setStatus("no QR code found in image");
        return;
      }
      stageRawQr(qr.data);
    } catch (err) {
      setStatus(decodeStatus(err));
    }
  }

  async function removeSelected() {
    if (!selected) return;
    await deleteFriend(selected.fingerprint);
    setSelected(null);
    await refreshFriends();
    setStatus("friend removed");
  }

  if (scannerOpen) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => setScannerOpen(false)} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
            <Text style={styles.linkText}>← friends</Text>
          </Pressable>
          <Text style={styles.title}>scan QR</Text>
        </View>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={(result: BarcodeScanningResult) => stageRawQr(result.data)}
        />
        {status ? <Text style={styles.status}>$ {status}</Text> : null}
      </SafeAreaView>
    );
  }

  if (pending) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => setPending(null)} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
            <Text style={styles.linkText}>← cancel</Text>
          </Pressable>
          <Text style={styles.title}>confirm import</Text>
        </View>
        <View style={styles.preview}>
          <Text style={styles.previewName}>{pending.displayName}</Text>
          <Text style={styles.previewMeta}>{pending.timetables.length} semesters · exported {new Date(pending.exportedAt).toLocaleString()}</Text>
          <Text style={styles.previewMeta}>{pending.encodedBytes} QR bytes · {pending.fingerprint}</Text>
          <Pressable onPress={() => importDecoded(pending).catch((err) => setStatus(decodeStatus(err)))} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>import friend</Text>
          </Pressable>
          {status ? <Text style={styles.status}>$ {status}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (selected) {
    return (
      <SafeAreaView style={styles.screen}>
        <TimetablePager
          title={selected.displayName}
          timetables={selected.timetables}
          headerRight={
            <View style={styles.headerActions}>
              <Pressable onPress={() => setSelected(null)} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
                <Text style={styles.linkText}>[back]</Text>
              </Pressable>
              <Pressable onPress={() => removeSelected().catch((err) => setStatus(decodeStatus(err)))} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
                <Text style={styles.dangerText}>[delete]</Text>
              </Pressable>
            </View>
          }
        />
        {status ? <Text style={styles.status}>$ {status}</Text> : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerBlock}>
        <View style={styles.header}>
          <Text style={styles.title}>friends</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={openScanner} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
              <Text style={styles.linkText}>[scan]</Text>
            </Pressable>
            <Pressable onPress={importFromGallery} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
              <Text style={styles.linkText}>[gallery]</Text>
            </Pressable>
          </View>
        </View>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="search name, course, faculty"
          placeholderTextColor="#333"
          style={styles.search}
          value={query}
        />
        {status ? <Text style={styles.status}>$ {status}</Text> : null}
      </View>

      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.fingerprint}
        contentContainerStyle={styles.friendList}
        ListEmptyComponent={<Text style={styles.emptyText}>{query ? "no friends match search." : "no friends imported yet."}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)} style={({ pressed }) => [styles.friendRow, pressed && styles.rowPressed]}>
            <View style={styles.friendTopRow}>
              <Text style={styles.friendName}>{item.displayName}</Text>
              <Text style={styles.friendCount}>{item.timetables.length} sem</Text>
            </View>
            <Text style={styles.friendMeta}>imported {new Date(item.importedAt).toLocaleDateString()} · exported {new Date(item.exportedAt).toLocaleDateString()}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  headerBlock: { borderBottomColor: "#111", borderBottomWidth: 1, paddingBottom: 12 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { color: "#fff", fontFamily: MONO, fontSize: 15, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  linkBtn: { paddingVertical: 6 },
  linkText: { color: "#777", fontFamily: MONO, fontSize: 12 },
  dangerText: { color: "#ff7777", fontFamily: MONO, fontSize: 12 },
  pressed: { opacity: 0.55 },
  search: { marginHorizontal: 20, borderColor: "#222", borderWidth: 1, color: "#fff", fontFamily: MONO, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  status: { color: "#555", fontFamily: MONO, fontSize: 11, paddingHorizontal: 20, paddingBottom: 8 },
  friendList: { paddingVertical: 8, flexGrow: 1 },
  emptyText: { color: "#555", fontFamily: MONO, fontSize: 13, textAlign: "center", paddingTop: 48 },
  friendRow: { paddingHorizontal: 20, paddingVertical: 16, borderBottomColor: "#111", borderBottomWidth: 1 },
  rowPressed: { backgroundColor: "#0d0d0d" },
  friendTopRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  friendName: { color: "#fff", fontFamily: MONO, fontSize: 14, fontWeight: "700" },
  friendCount: { color: "#555", fontFamily: MONO, fontSize: 11 },
  friendMeta: { color: "#777", fontFamily: MONO, fontSize: 11, marginTop: 6 },
  camera: { flex: 1, margin: 20, borderColor: "#222", borderWidth: 1 },
  preview: { padding: 20, gap: 14 },
  previewName: { color: "#fff", fontFamily: MONO, fontSize: 18, fontWeight: "700" },
  previewMeta: { color: "#777", fontFamily: MONO, fontSize: 12, lineHeight: 18 },
  primaryBtn: { borderColor: "#fff", borderWidth: 1, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  primaryText: { color: "#fff", fontFamily: MONO, fontSize: 13 },
});
