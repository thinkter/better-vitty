import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { FriendImportPreview } from "../components/friends/FriendImportPreview";
import { FriendQrScanner } from "../components/friends/FriendQrScanner";
import { FriendTimetableView } from "../components/friends/FriendTimetableView";
import { FriendsList } from "../components/friends/FriendsList";
import type { FriendTimetable, TimetableShareDecodeResult } from "../lib/types";
import { TimetableShareError, decodeTimetableSharePayload } from "../lib/timetableShare";
import { deleteFriend, loadFriends, upsertFriend } from "../storage/friendsStore";

function decodeStatus(err: unknown): string {
  if (err instanceof TimetableShareError) return err.message;
  return err instanceof Error ? err.message : "failed to import timetable QR";
}

function filterFriends(friends: readonly FriendTimetable[], query: string): FriendTimetable[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...friends];
  return friends.filter((friend) => {
    if (friend.displayName.toLocaleLowerCase().includes(normalized)) return true;
    if (friend.registrationNumber.toLocaleLowerCase().includes(normalized)) return true;
    return friend.timetables.some((timetable) =>
      timetable.courses.some((course) =>
        course.code.toLocaleLowerCase().includes(normalized)
        || course.title.toLocaleLowerCase().includes(normalized)
        || course.faculty.toLocaleLowerCase().includes(normalized),
      ),
    );
  });
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

  const filteredFriends = useMemo(() => filterFriends(friends, query), [friends, query]);

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
    return <FriendQrScanner status={status} onBack={() => setScannerOpen(false)} onScan={stageRawQr} />;
  }

  if (pending) {
    return (
      <FriendImportPreview
        pending={pending}
        status={status}
        onCancel={() => setPending(null)}
        onImport={() => importDecoded(pending).catch((err) => setStatus(decodeStatus(err)))}
      />
    );
  }

  if (selected) {
    return (
      <FriendTimetableView
        friend={selected}
        status={status}
        onBack={() => setSelected(null)}
        onDelete={() => removeSelected().catch((err) => setStatus(decodeStatus(err)))}
      />
    );
  }

  return (
    <FriendsList
      friends={filteredFriends}
      query={query}
      status={status}
      onQueryChange={setQuery}
      onOpenScanner={() => openScanner().catch((err) => setStatus(decodeStatus(err)))}
      onImportFromGallery={() => importFromGallery().catch((err) => setStatus(decodeStatus(err)))}
      onSelectFriend={setSelected}
    />
  );
}
