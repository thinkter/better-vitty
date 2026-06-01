import { StyleSheet } from "react-native";

const MONO_FONT_FAMILY = "monospace";

export const appStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  content: { padding: 20, gap: 10 },
  title: { color: "#fff", fontFamily: MONO_FONT_FAMILY, fontSize: 22, fontWeight: "700" },
  line: { color: "#fff", fontFamily: MONO_FONT_FAMILY, fontSize: 14 },
  prompt: { color: "#fff", fontFamily: MONO_FONT_FAMILY, fontSize: 13, marginTop: 8 },
  input: { borderColor: "#fff", borderWidth: 1, color: "#fff", fontFamily: MONO_FONT_FAMILY, minHeight: 44, paddingHorizontal: 10 },
  button: { borderColor: "#fff", borderWidth: 1, marginTop: 8, padding: 12 },
  disabled: { opacity: 0.35 },
  pressed: { backgroundColor: "#222" },
  buttonText: { color: "#fff", fontFamily: MONO_FONT_FAMILY, textAlign: "center" },
  status: { color: "#fff", fontFamily: MONO_FONT_FAMILY, marginTop: 10 },
  error: { color: "#ff7777", fontFamily: MONO_FONT_FAMILY },
  outputBox: { borderColor: "#333", borderWidth: 1, marginTop: 8, padding: 10 },
  output: { color: "#fff", fontFamily: MONO_FONT_FAMILY, fontSize: 12, lineHeight: 18 },
});
