import { useEffect, useMemo, useRef, useState } from "react";
import { EncodingType, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ShareTimetableForm, type QrRef } from "../components/share/ShareTimetableForm";
import type { SemesterTimetable } from "../lib/types";
import { TimetableShareError, encodeTimetableSharePayload } from "../lib/timetableShare";
import { loadCredentials } from "../storage/credentialStore";

interface Props {
  readonly timetables: readonly SemesterTimetable[];
  readonly onBack: () => void;
}

function qrPngBase64(ref: QrRef): Promise<string> {
  return new Promise((resolve) => {
    ref.toDataURL(resolve);
  });
}

export function ShareTimetableScreen({ timetables, onBack }: Props) {
  const qrRef = useRef<QrRef | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    loadCredentials()
      .then((credentials) => {
        if (!alive || !credentials) return;
        if (credentials.displayName) setDisplayName((current) => current || credentials.displayName || "");
        if (credentials.registrationNumber) setRegistrationNumber(credentials.registrationNumber);
      })
      .catch(() => {
        if (alive) setStatus("saved profile metadata unavailable");
      });
    return () => {
      alive = false;
    };
  }, []);

  const encoded = useMemo(() => {
    try {
      return encodeTimetableSharePayload({ displayName, registrationNumber, timetables });
    } catch (err) {
      return err;
    }
  }, [displayName, registrationNumber, timetables]);

  const encodedPayload = typeof encoded === "string" ? encoded : null;
  const errorMessage = encoded instanceof TimetableShareError ? encoded.message : encoded instanceof Error ? encoded.message : "";

  async function writeQrPng(): Promise<string> {
    if (!qrRef.current) throw new Error("QR preview is not ready");
    const base64 = await qrPngBase64(qrRef.current);
    const file = new File(Paths.cache, `better-vitty-timetable-${Date.now()}.png`);
    file.create({ overwrite: true });
    file.write(base64, { encoding: EncodingType.Base64 });
    if (!file.exists || file.size === 0) throw new Error("failed to prepare QR image");
    return file.uri;
  }

  async function shareQr() {
    if (!encodedPayload) return;
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

  return (
    <ShareTimetableForm
      displayName={displayName}
      registrationNumber={registrationNumber}
      encoded={encodedPayload}
      errorMessage={errorMessage}
      status={status}
      onBack={onBack}
      onDisplayNameChange={setDisplayName}
      onQrRef={(ref) => { qrRef.current = ref; }}
      onShare={shareQr}
    />
  );
}
