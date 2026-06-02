import { useMemo, useRef, useState } from "react";
import { EncodingType, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ShareTimetableForm, type QrRef } from "../components/share/ShareTimetableForm";
import type { SemesterTimetable } from "../lib/types";
import { TimetableShareError, encodeTimetableSharePayload } from "../lib/timetableShare";

interface Props {
  readonly timetables: readonly SemesterTimetable[];
  readonly onBack: () => void;
}

function qrPngBase64(ref: QrRef): Promise<string> {
  const { promise, resolve } = Promise.withResolvers<string>();
  ref.toDataURL(resolve);
  return promise;
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

  const encodedPayload = typeof encoded === "string" ? encoded : null;
  const errorMessage = encoded instanceof TimetableShareError ? encoded.message : encoded instanceof Error ? encoded.message : "";

  async function writeQrPng(): Promise<string> {
    if (!qrRef.current) throw new Error("QR preview is not ready");
    const base64 = await qrPngBase64(qrRef.current);
    const file = new File(Paths.cache, `better-vitty-timetable-${Date.now()}.png`);
    file.write(base64, { encoding: EncodingType.Base64 });
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
