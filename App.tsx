import { useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { appStyles as styles } from "./src/lib/appStyles";
import type { AppPhase, SemesterTimetable } from "./src/lib/types";
import { loadTimetables, saveTimetables } from "./src/storage/timetableStore";
import { VtopClient } from "./src/vtop/client";
import { asVtopError } from "./src/vtop/errors";
import { loginToVtop } from "./src/vtop/login";
import { fetchAllTimetables } from "./src/vtop/timetable";


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
  const [phase, setPhase] = useState<AppPhase>("loading");
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

