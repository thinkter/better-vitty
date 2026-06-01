import { useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { SemesterTimetable } from "./src/types";
import { loadTimetables, saveTimetables } from "./src/storage/timetableStore";
import { VtopClient } from "./src/vtop/client";
import { asVtopError } from "./src/vtop/errors";
import { loginToVtop } from "./src/vtop/login";
import { fetchAllTimetables } from "./src/vtop/timetable";

type Phase = "idle" | "loading" | "syncing" | "done" | "error";

function renderTimetables(timetables: readonly SemesterTimetable[]): string {
  if (timetables.length === 0) return "no saved timetables\nlogin and sync to fetch VTOP data";
  return timetables
    .map((timetable) => {
      const courses = timetable.courses
        .slice(0, 20)
        .map((course) => `  ${course.code.padEnd(9)} ${course.title}${course.slot ? ` [${course.slot}]` : ""}`)
        .join("\n");
      const events = timetable.events
        .slice(0, 30)
        .map((event) => `  ${event.day.padEnd(9)} ${event.time.padEnd(13)} ${event.courseCode} ${event.venue}`)
        .join("\n");
      return `$ ${timetable.semester.name}\nfetched: ${timetable.fetchedAt}\ncourses:\n${courses || "  none parsed"}\nevents:\n${events || "  none parsed"}`;
    })
    .join("\n\n");
}

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState("loading local store");
  const [error, setError] = useState("");
  const [timetables, setTimetables] = useState<SemesterTimetable[]>([]);

  useEffect(() => {
    let alive = true;
    loadTimetables()
      .then((saved) => {
        if (!alive) return;
        setTimetables(saved);
        setStatus(saved.length ? "saved timetables loaded" : "ready");
        setPhase("idle");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "failed to load local store");
        setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const output = useMemo(() => renderTimetables(timetables), [timetables]);
  const busy = phase === "loading" || phase === "syncing";

  async function sync() {
    setPhase("syncing");
    setError("");
    const client = new VtopClient();
    try {
      const login = await loginToVtop(client, {
        username: username.trim(),
        password,
        onStatus: setStatus,
      });
      setStatus(`logged in after ${login.attempts} captcha attempt(s)`);
      const fetched = await fetchAllTimetables(client, login.session, { onStatus: setStatus });
      await saveTimetables(fetched);
      setTimetables(fetched);
      setStatus(`saved ${fetched.length} semester timetable(s) locally`);
      setPhase("done");
    } catch (err) {
      const vtopError = asVtopError(err);
      setError(`${vtopError.code}: ${vtopError.message}`);
      setStatus("sync failed; saved data retained");
      setPhase("error");
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>better-vitty</Text>
        <Text style={styles.line}>local-only VTOP timetable sync</Text>
        <Text style={styles.prompt}>username</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          onChangeText={setUsername}
          placeholder="VTOP username"
          placeholderTextColor="#777"
          style={styles.input}
          value={username}
        />
        <Text style={styles.prompt}>password</Text>
        <TextInput
          editable={!busy}
          onChangeText={setPassword}
          placeholder="VTOP password"
          placeholderTextColor="#777"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy || username.trim().length === 0 || password.length === 0}
          onPress={sync}
          style={({ pressed }) => [styles.button, (busy || username.trim().length === 0 || password.length === 0) && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>{busy ? "working..." : "sync timetable"}</Text>
        </Pressable>
        <Text style={styles.status}>$ {status}</Text>
        {error ? <Text style={styles.error}>! {error}</Text> : null}
        <View style={styles.outputBox}>
          <Text selectable style={styles.output}>{output}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const mono = "monospace";
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  content: { padding: 20, gap: 10 },
  title: { color: "#fff", fontFamily: mono, fontSize: 22, fontWeight: "700" },
  line: { color: "#fff", fontFamily: mono, fontSize: 14 },
  prompt: { color: "#fff", fontFamily: mono, fontSize: 13, marginTop: 8 },
  input: { borderColor: "#fff", borderWidth: 1, color: "#fff", fontFamily: mono, minHeight: 44, paddingHorizontal: 10 },
  button: { borderColor: "#fff", borderWidth: 1, marginTop: 8, padding: 12 },
  disabled: { opacity: 0.35 },
  pressed: { backgroundColor: "#222" },
  buttonText: { color: "#fff", fontFamily: mono, textAlign: "center" },
  status: { color: "#fff", fontFamily: mono, marginTop: 10 },
  error: { color: "#ff7777", fontFamily: mono },
  outputBox: { borderColor: "#333", borderWidth: 1, marginTop: 8, padding: 10 },
  output: { color: "#fff", fontFamily: mono, fontSize: 12, lineHeight: 18 },
});
