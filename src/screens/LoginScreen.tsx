import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppPhase, SemesterTimetable } from "../lib/types";
import { saveTimetables } from "../storage/timetableStore";
import { VtopClient } from "../vtop/client";
import { asVtopError } from "../vtop/errors";
import { loginToVtop } from "../vtop/login";
import { fetchAllTimetables } from "../vtop/timetable";

const MONO = "monospace";
// TODO: replace with the real repository URL before shipping
const GITHUB_URL = "https://github.com/user/better-vitty";

interface Props {
  onSync: (timetables: SemesterTimetable[]) => void;
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
    const client = new VtopClient();
    try {
      const login = await loginToVtop(client, {
        username: username.trim(),
        password,
        onStatus: setStatus,
      });
      setStatus(`authenticated (${login.attempts} captcha attempt${login.attempts === 1 ? "" : "s"})`);
      const fetched = await fetchAllTimetables(client, login.session, { onStatus: setStatus });
      await saveTimetables(fetched);
      setStatus(`saved ${fetched.length} semester${fetched.length === 1 ? "" : "s"} to device`);
      setPhase("done");
      onSync(fetched);
    } catch (err) {
      const vtopError = asVtopError(err);
      setError(`${vtopError.code}: ${vtopError.message}`);
      setStatus("sync failed — check credentials and try again");
      setPhase("error");
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Heading */}
        <Text style={styles.title}>connect to vtop.</Text>
        <Text style={styles.subtitle}>credentials are stored only on this device.</Text>
        <View style={styles.rule} />

        {/* Form */}
        <Text style={styles.label}>registration number</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          onChangeText={setUsername}
          placeholder="e.g. 22BCE1234"
          placeholderTextColor="#444"
          style={styles.input}
          value={username}
        />

        <Text style={styles.label}>password</Text>
        <TextInput
          editable={!busy}
          onChangeText={setPassword}
          placeholder="vtop password"
          placeholderTextColor="#444"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable
          accessibilityRole="button"
          disabled={!canSync}
          onPress={sync}
          style={({ pressed }) => [
            styles.button,
            !canSync && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{busy ? "syncing..." : "sync timetable →"}</Text>
        </Pressable>

        {/* Status / error output */}
        {status ? <Text style={styles.status}>$ {status}</Text> : null}
        {error ? <Text style={styles.error}>! {error}</Text> : null}

        {/* Trust note */}
        <View style={styles.trustBlock}>
          <Text style={styles.trustText}>
            {
              "the app connects directly to vtop.vit.ac.in from\nyour phone. no proxy, no server, no middleman.\nyour password is never transmitted anywhere else."
            }
          </Text>
        </View>

        {/* GitHub link */}
        <Pressable
          onPress={() => Linking.openURL(GITHUB_URL)}
          style={({ pressed }) => [styles.githubRow, pressed && styles.githubPressed]}
        >
          <Text style={styles.githubLink}>↗ view source on github</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  content: {
    padding: 24,
    gap: 12,
  },
  title: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: "#666",
    fontFamily: MONO,
    fontSize: 13,
  },
  rule: {
    height: 1,
    backgroundColor: "#1e1e1e",
    marginVertical: 8,
  },
  label: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderColor: "#333",
    borderWidth: 1,
    color: "#fff",
    fontFamily: MONO,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  button: {
    borderColor: "#fff",
    borderWidth: 1,
    marginTop: 8,
    paddingVertical: 15,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonPressed: {
    backgroundColor: "#111",
  },
  buttonText: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 14,
    textAlign: "center",
  },
  status: {
    color: "#888",
    fontFamily: MONO,
    fontSize: 12,
    marginTop: 4,
  },
  error: {
    color: "#ff7777",
    fontFamily: MONO,
    fontSize: 12,
  },
  trustBlock: {
    borderColor: "#1a1a1a",
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  trustText: {
    color: "#555",
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 20,
  },
  githubRow: {
    marginTop: 4,
  },
  githubPressed: {
    opacity: 0.6,
  },
  githubLink: {
    color: "#555",
    fontFamily: MONO,
    fontSize: 12,
  },
});
