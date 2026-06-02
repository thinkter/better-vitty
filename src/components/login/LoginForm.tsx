import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const MONO = "monospace";
const GITHUB_URL = "https://github.com/thinkter/better-vitty";

interface LoginFormProps {
  readonly username: string;
  readonly password: string;
  readonly busy: boolean;
  readonly canSync: boolean;
  readonly status: string;
  readonly error: string;
  readonly onUsernameChange: (username: string) => void;
  readonly onPasswordChange: (password: string) => void;
  readonly onSync: () => void;
}

export function LoginForm({ username, password, busy, canSync, status, error, onUsernameChange, onPasswordChange, onSync }: LoginFormProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>connect to vtop.</Text>
      <Text style={styles.subtitle}>credentials are stored securely on this device.</Text>
      <View style={styles.rule} />

      <Text style={styles.label}>vtop username</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        onChangeText={onUsernameChange}
        placeholder="vtop username"
        placeholderTextColor="#444"
        style={styles.input}
        value={username}
      />

      <Text style={styles.label}>vtop password</Text>
      <TextInput
        editable={!busy}
        onChangeText={onPasswordChange}
        placeholder="vtop password"
        placeholderTextColor="#444"
        secureTextEntry
        style={styles.input}
        value={password}
      />

      <Pressable
        accessibilityRole="button"
        disabled={!canSync}
        onPress={onSync}
        style={({ pressed }) => [styles.button, !canSync && styles.buttonDisabled, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>{busy ? "syncing..." : "sync timetable →"}</Text>
      </Pressable>

      {status ? <Text style={styles.status}>$ {status}</Text> : null}
      {error ? <Text style={styles.error}>! {error}</Text> : null}

      <View style={styles.trustBlock}>
        <Text style={styles.trustText}>
          {"the app connects directly to vtop.vit.ac.in from\nyour phone. no proxy, no server, no middleman.\nyour password is kept in secure device storage."}
        </Text>
      </View>

      <Pressable onPress={() => Linking.openURL(GITHUB_URL)} style={({ pressed }) => [styles.githubRow, pressed && styles.githubPressed]}>
        <Text style={styles.githubLink}>↗ view source on github</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 12 },
  title: { color: "#fff", fontFamily: MONO, fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#666", fontFamily: MONO, fontSize: 13 },
  rule: { height: 1, backgroundColor: "#1e1e1e", marginVertical: 8 },
  label: { color: "#fff", fontFamily: MONO, fontSize: 12, marginTop: 4 },
  input: { borderColor: "#333", borderWidth: 1, color: "#fff", fontFamily: MONO, fontSize: 14, minHeight: 48, paddingHorizontal: 12 },
  button: { borderColor: "#fff", borderWidth: 1, marginTop: 8, paddingVertical: 15 },
  buttonDisabled: { opacity: 0.3 },
  buttonPressed: { backgroundColor: "#111" },
  buttonText: { color: "#fff", fontFamily: MONO, fontSize: 14, textAlign: "center" },
  status: { color: "#888", fontFamily: MONO, fontSize: 12, marginTop: 4 },
  error: { color: "#ff7777", fontFamily: MONO, fontSize: 12 },
  trustBlock: { borderColor: "#1a1a1a", borderWidth: 1, marginTop: 16, padding: 14 },
  trustText: { color: "#555", fontFamily: MONO, fontSize: 12, lineHeight: 20 },
  githubRow: { marginTop: 4 },
  githubPressed: { opacity: 0.6 },
  githubLink: { color: "#555", fontFamily: MONO, fontSize: 12 },
});
