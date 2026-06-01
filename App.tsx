import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Screen, SemesterTimetable } from "./src/lib/types";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { TimetableScreen } from "./src/screens/TimetableScreen";
import { isOnboardingComplete } from "./src/storage/onboardingStore";
import { loadTimetables } from "./src/storage/timetableStore";

const MONO = "monospace";

function BootScreen() {
  return (
    <View style={styles.boot}>
      <Text style={styles.bootText}>loading...</Text>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("boot");
  const [timetables, setTimetables] = useState<SemesterTimetable[]>([]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const [onboarded, saved] = await Promise.all([
        isOnboardingComplete(),
        loadTimetables(),
      ]);
      if (!alive) return;
      setTimetables(saved);
      if (!onboarded) {
        setScreen("onboarding");
      } else if (saved.length > 0) {
        setScreen("timetable");
      } else {
        setScreen("login");
      }
    }

    boot().catch(() => {
      if (alive) setScreen("login");
    });

    return () => {
      alive = false;
    };
  }, []);

  function handleSync(fetched: SemesterTimetable[]) {
    setTimetables(fetched);
    setScreen("timetable");
  }

  function handleResync() {
    setScreen("login");
  }

  return (
    <SafeAreaProvider style={styles.provider}>
      {screen === "boot" && <BootScreen />}
      {screen === "onboarding" && (
        <OnboardingScreen onComplete={() => setScreen("login")} />
      )}
      {screen === "login" && <LoginScreen onSync={handleSync} />}
      {screen === "timetable" && (
        <TimetableScreen timetables={timetables} onResync={handleResync} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
    backgroundColor: "#000",
  },
  boot: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  bootText: {
    color: "#333",
    fontFamily: MONO,
    fontSize: 13,
  },
});
