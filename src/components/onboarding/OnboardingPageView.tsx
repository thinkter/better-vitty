import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

const MONO = "monospace";

export interface OnboardingPage {
  readonly title: string;
  readonly body?: string;
  readonly features?: readonly string[];
  readonly note?: string;
  readonly cta: string;
}

interface OnboardingPageViewProps {
  readonly page: OnboardingPage;
  readonly pageIdx: number;
  readonly pageCount: number;
  readonly opacity: Animated.Value;
  readonly onNext: () => void;
}

export function OnboardingPageView({ page, pageIdx, pageCount, opacity, onNext }: OnboardingPageViewProps) {
  return (
    <Animated.View style={[styles.content, { opacity }]}>
      <Text style={styles.counter}>[{pageIdx + 1}/{pageCount}]</Text>

      <View style={styles.main}>
        <Text style={styles.title}>{page.title}</Text>
        <View style={styles.rule} />

        {page.body ? <Text style={styles.body}>{page.body}</Text> : null}

        {page.features ? (
          <View style={styles.featureList}>
            {page.features.map((feature) => (
              <Text key={feature} style={styles.feature}>{feature}</Text>
            ))}
          </View>
        ) : null}

        {page.note ? <Text style={styles.note}>{page.note}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Pressable onPress={onNext} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaText}>{page.cta}</Text>
        </Pressable>

        <View style={styles.dots}>
          {Array.from({ length: pageCount }, (_, idx) => (
            <Text key={idx} style={idx === pageIdx ? styles.dotActive : styles.dotInactive}>
              {idx === pageIdx ? "●" : "○"}
            </Text>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28 },
  counter: { color: "#444", fontFamily: MONO, fontSize: 12, marginBottom: 40 },
  main: { flex: 1, justifyContent: "center" },
  title: { color: "#fff", fontFamily: MONO, fontSize: 26, fontWeight: "700", marginBottom: 18, letterSpacing: -0.3 },
  rule: { height: 1, backgroundColor: "#1e1e1e", marginBottom: 28 },
  body: { color: "#bbb", fontFamily: MONO, fontSize: 14, lineHeight: 24 },
  featureList: { gap: 14 },
  feature: { color: "#bbb", fontFamily: MONO, fontSize: 14, lineHeight: 20 },
  note: { color: "#444", fontFamily: MONO, fontSize: 12, marginTop: 24 },
  footer: { gap: 28 },
  cta: { borderColor: "#fff", borderWidth: 1, paddingVertical: 15, paddingHorizontal: 20 },
  ctaPressed: { backgroundColor: "#111" },
  ctaText: { color: "#fff", fontFamily: MONO, fontSize: 14, textAlign: "center" },
  dots: { flexDirection: "row", gap: 12, justifyContent: "center", alignItems: "center" },
  dotActive: { color: "#fff", fontFamily: MONO, fontSize: 10 },
  dotInactive: { color: "#333", fontFamily: MONO, fontSize: 10 },
});
