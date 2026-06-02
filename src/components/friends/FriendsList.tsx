import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { FriendTimetable } from "../../lib/types";

const MONO = "monospace";

interface FriendsListProps {
  readonly friends: readonly FriendTimetable[];
  readonly query: string;
  readonly status: string;
  readonly onQueryChange: (query: string) => void;
  readonly onOpenScanner: () => void;
  readonly onImportFromGallery: () => void;
  readonly onSelectFriend: (friend: FriendTimetable) => void;
}

export function FriendsList({ friends, query, status, onQueryChange, onOpenScanner, onImportFromGallery, onSelectFriend }: FriendsListProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerBlock}>
        <View style={styles.header}>
          <Text style={styles.title}>friends</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={onOpenScanner} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
              <Text style={styles.linkText}>[scan]</Text>
            </Pressable>
            <Pressable onPress={onImportFromGallery} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
              <Text style={styles.linkText}>[gallery]</Text>
            </Pressable>
          </View>
        </View>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onQueryChange}
          placeholder="search name, course, faculty"
          placeholderTextColor="#333"
          style={styles.search}
          value={query}
        />
        {status ? <Text style={styles.status}>$ {status}</Text> : null}
      </View>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.fingerprint}
        contentContainerStyle={styles.friendList}
        ListEmptyComponent={<Text style={styles.emptyText}>{query ? "no friends match search." : "no friends imported yet."}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => onSelectFriend(item)} style={({ pressed }) => [styles.friendRow, pressed && styles.rowPressed]}>
            <View style={styles.friendTopRow}>
              <Text style={styles.friendName}>{item.displayName}</Text>
              <Text style={styles.friendCount}>{item.timetables.length} sem</Text>
            </View>
            <Text style={styles.friendMeta}>imported {new Date(item.importedAt).toLocaleDateString()} · exported {new Date(item.exportedAt).toLocaleDateString()}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  headerBlock: { borderBottomColor: "#111", borderBottomWidth: 1, paddingBottom: 12 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { color: "#fff", fontFamily: MONO, fontSize: 15, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  linkBtn: { paddingVertical: 6 },
  linkText: { color: "#777", fontFamily: MONO, fontSize: 12 },
  pressed: { opacity: 0.55 },
  search: { marginHorizontal: 20, borderColor: "#222", borderWidth: 1, color: "#fff", fontFamily: MONO, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  status: { color: "#555", fontFamily: MONO, fontSize: 11, paddingHorizontal: 20, paddingBottom: 8 },
  friendList: { paddingVertical: 8, flexGrow: 1 },
  emptyText: { color: "#555", fontFamily: MONO, fontSize: 13, textAlign: "center", paddingTop: 48 },
  friendRow: { paddingHorizontal: 20, paddingVertical: 16, borderBottomColor: "#111", borderBottomWidth: 1 },
  rowPressed: { backgroundColor: "#0d0d0d" },
  friendTopRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  friendName: { color: "#fff", fontFamily: MONO, fontSize: 14, fontWeight: "700" },
  friendCount: { color: "#555", fontFamily: MONO, fontSize: 11 },
  friendMeta: { color: "#777", fontFamily: MONO, fontSize: 11, marginTop: 6 },
});
