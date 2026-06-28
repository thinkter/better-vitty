import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Screen, SemesterTimetable } from "./src/lib/types";
import { usePhoneMetrics } from "./src/lib/responsive";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { TimetableScreen } from "./src/screens/TimetableScreen";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { ShareTimetableScreen } from "./src/screens/ShareTimetableScreen";
import {
  deleteCredentials,
  loadCredentials,
  saveCredentials,
} from "./src/storage/credentialStore";
import { isOnboardingComplete } from "./src/storage/onboardingStore";
import { loadTimetables } from "./src/storage/timetableStore";
import { refreshWidgetFromTimetables } from "./src/widgets/widgetSnapshot";
import { asVtopError } from "./src/vtop/errors";
import { syncTimetablesFromVtop } from "./src/vtop/syncTimetables";

const MONO = "monospace";
type AppTab = "my timetable" | "friends";

interface AppShellProps {
  readonly timetables: SemesterTimetable[];
  readonly onResync: () => void;
  readonly onSync: (onStatus?: (status: string) => void) => Promise<void>;
}

function AppShell({ timetables, onResync, onSync }: AppShellProps) {
  const metrics = usePhoneMetrics();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<AppTab>("my timetable");
  const [sharing, setSharing] = useState(false);

  if (sharing) {
    return <ShareTimetableScreen timetables={timetables} onBack={() => setSharing(false)} />;
  }

  return (
    <View style={styles.appShell}>
      <View style={styles.appContent}>
        {tab === "my timetable" ? (
          <TimetableScreen
            timetables={timetables}
            onResync={onResync}
            onSync={onSync}
            onShare={() => setSharing(true)}
          />
        ) : (
          <FriendsScreen />
        )}
      </View>
      <View style={[styles.tabBar, { paddingBottom: insets.bottom + metrics.bottomTabSafeGap }]}>
        {(["my timetable", "friends"] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            onPress={() => setTab(item)}
            style={({ pressed }) => [styles.tabBtn, { minHeight: metrics.minTouchSize, paddingVertical: metrics.bottomTabPaddingY }, pressed && styles.tabBtnPressed]}
          >
            <Text maxFontSizeMultiplier={metrics.fontMultiplier} style={[styles.tabText, { fontSize: metrics.tabFont }, tab === item && styles.tabTextActive]}>
              {tab === item ? "> " : ""}
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}


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
      refreshWidgetFromTimetables(saved).catch(() => undefined);
      if (!onboarded) {
        setScreen("onboarding");
      } else if (saved.length > 0) {
        setScreen("app");
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
    setScreen("app");
  }

  function handleResync() {
    setScreen("login");
  }

  async function handleStoredCredentialSync(onStatus?: (status: string) => void) {
    const credentials = await loadCredentials();
    if (!credentials) {
      onStatus?.("stored credentials not found");
      setScreen("login");
      return;
    }

    try {
      const result = await syncTimetablesFromVtop(
        onStatus ? { ...credentials, onStatus } : credentials,
      );
      await saveCredentials({ ...credentials, ...result.identity });
      setTimetables(result.timetables);
      refreshWidgetFromTimetables(result.timetables).catch(() => undefined);
    } catch (err) {
      if (asVtopError(err).code === "INVALID_CREDENTIALS") {
        await deleteCredentials();
      }
      throw err;
    }
  }

  return (
    <SafeAreaProvider style={styles.provider}>
      {screen === "boot" && <BootScreen />}
      {screen === "onboarding" && (
        <OnboardingScreen onComplete={() => setScreen("login")} />
      )}
      {screen === "login" && <LoginScreen onSync={handleSync} />}
      {screen === "app" && (
        <AppShell
          timetables={timetables}
          onResync={handleResync}
          onSync={handleStoredCredentialSync}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
    backgroundColor: "#000",
  },
  appShell: {
    flex: 1,
    backgroundColor: "#000",
  },
  appContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderTopColor: "#111",
    borderTopWidth: 1,
    backgroundColor: "#000",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
  },
  tabBtnPressed: {
    backgroundColor: "#0d0d0d",
  },
  tabText: {
    color: "#555",
    fontFamily: MONO,
  },
  tabTextActive: {
    color: "#fff",
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
