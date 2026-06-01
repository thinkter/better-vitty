import { useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markOnboardingComplete } from "../storage/onboardingStore";

const MONO = "monospace";

interface Page {
  title: string;
  body?: string;
  features?: string[];
  note?: string;
  cta: string;
}

const PAGES: Page[] = [
  {
    title: "better-vitty",
    body: "your vtop timetable, automatically.\nno copy-pasting.\ntap sync once. you're done.",
    cta: "get started →",
  },
  {
    // title: "no cloud. ever.",
    title: "local first.",
    body: "your vtop credentials and timetable never leave this phone.\n\ncredentials are kept in secure device storage so you can sync again later.\n\nno servers in between. no data collected.\nnothing phoned home. ever.",
    cta: "understood →",
  },
  {
    title: "what you get.",
    features: [
      "→  auto-sync from vtop",
      "→  today's classes at a glance",
      "→  full semester history",
      "→  share your timetable",
      "→  home screen widgets",
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
  onComplete: () => void;
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
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Page counter */}
        <Text style={styles.counter}>
          [{pageIdx + 1}/{PAGES.length}]
        </Text>

        {/* Main body */}
        <View style={styles.main}>
          <Text style={styles.title}>{page.title}</Text>
          <View style={styles.rule} />

          {page.body ? <Text style={styles.body}>{page.body}</Text> : null}

          {page.features ? (
            <View style={styles.featureList}>
              {page.features.map((f) => (
                <Text key={f} style={styles.feature}>
                  {f}
                </Text>
              ))}
            </View>
          ) : null}

          {page.note ? <Text style={styles.note}>{page.note}</Text> : null}
        </View>

        {/* Footer: CTA + dots */}
        <View style={styles.footer}>
          <Pressable
            onPress={nextPage}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>{page.cta}</Text>
          </Pressable>

          <View style={styles.dots}>
            {PAGES.map((_, idx) => (
              <Text
                key={idx}
                style={idx === pageIdx ? styles.dotActive : styles.dotInactive}
              >
                {idx === pageIdx ? "●" : "○"}
              </Text>
            ))}
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  counter: {
    color: "#444",
    fontFamily: MONO,
    fontSize: 12,
    marginBottom: 40,
  },
  main: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 18,
    letterSpacing: -0.3,
  },
  rule: {
    height: 1,
    backgroundColor: "#1e1e1e",
    marginBottom: 28,
  },
  body: {
    color: "#bbb",
    fontFamily: MONO,
    fontSize: 14,
    lineHeight: 24,
  },
  featureList: {
    gap: 14,
  },
  feature: {
    color: "#bbb",
    fontFamily: MONO,
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    color: "#444",
    fontFamily: MONO,
    fontSize: 12,
    marginTop: 24,
  },
  footer: {
    gap: 28,
  },
  cta: {
    borderColor: "#fff",
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  ctaPressed: {
    backgroundColor: "#111",
  },
  ctaText: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 14,
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  dotActive: {
    color: "#fff",
    fontFamily: MONO,
    fontSize: 10,
  },
  dotInactive: {
    color: "#333",
    fontFamily: MONO,
    fontSize: 10,
  },
});
