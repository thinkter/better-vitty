import { useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingPageView, type OnboardingPage } from "../components/onboarding/OnboardingPageView";
import { markOnboardingComplete } from "../storage/onboardingStore";

const PAGES: OnboardingPage[] = [
  {
    title: "better-vitty",
    body: "your vtop timetable, automatically.\nno copy-pasting.\ntap sync once. you're done.",
    cta: "get started →",
  },
  {
    title: "local first.",
    body: "your vtop credentials and timetable never leave this phone.\n\ncredentials are kept in secure device storage so you can sync again later.\n\nno servers in between. no data collected.\nnothing phoned home. ever.",
    cta: "understood →",
  },
  {
    title: "share with friends.",
    body: "turn your timetable into a QR code.\n\nfriends can scan it in-app or import the QR image from their gallery.\n\nimported timetables stay on this phone as snapshots — no accounts, no cloud, no contact upload.",
    cta: "got it →",
  },
  {
    title: "what you get.",
    features: [
      "→  auto-sync from vtop",
      "→  today's classes at a glance",
      "→  full semester history",
      "→  QR timetable sharing",
      "→  searchable friends tab",
    ],
    cta: "nice →",
  },
  {
    title: "open source.",
    body: "we have nothing to hide.\n\nevery line of code is public on github.\ninspect exactly what happens to your credentials — right down to the network request.",
    note: "github.com/thinkter/better-vitty",
    cta: "connect to vtop →",
  },
];

interface Props {
  readonly onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: Props) {
  const [pageIdx, setPageIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const page = PAGES[pageIdx]!;
  const isLast = pageIdx === PAGES.length - 1;

  function nextPage() {
    if (animating) return;
    setAnimating(true);

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      if (isLast) {
        markOnboardingComplete().finally(onComplete);
        return;
      }
      setPageIdx((prev) => prev + 1);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => setAnimating(false));
    });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <OnboardingPageView page={page} pageIdx={pageIdx} pageCount={PAGES.length} opacity={fadeAnim} onNext={nextPage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
});
