import { useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoginForm } from "../components/login/LoginForm";
import type { AppPhase, SemesterTimetable } from "../lib/types";
import { saveCredentials } from "../storage/credentialStore";
import { asVtopError } from "../vtop/errors";
import { syncTimetablesFromVtop } from "../vtop/syncTimetables";

interface Props {
  readonly onSync: (timetables: SemesterTimetable[]) => void;
}

export function LoginScreen({ onSync }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<AppPhase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const busy = phase === "loading" || phase === "syncing";
  const canSync = username.trim().length > 0 && password.length > 0 && !busy;

  async function sync() {
    setPhase("syncing");
    setError("");
    setStatus("connecting to vtop...");
    try {
      const credentials = {
        username: username.trim(),
        password,
      };
      const result = await syncTimetablesFromVtop({
        ...credentials,
        onStatus: setStatus,
      });
      await saveCredentials({ ...credentials, ...result.identity });
      setPhase("done");
      onSync(result.timetables);
    } catch (err) {
      const vtopError = asVtopError(err);
      setError(`${vtopError.code}: ${vtopError.message}`);
      setStatus("sync failed — check credentials and try again");
      setPhase("error");
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <LoginForm
        username={username}
        password={password}
        busy={busy}
        canSync={canSync}
        status={status}
        error={error}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSync={sync}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
});
