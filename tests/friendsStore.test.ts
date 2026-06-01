import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TimetableShareDecodeResult } from "../src/lib/types";

interface StoredRow {
  readonly fingerprint: string;
  readonly display_name: string;
  readonly imported_at: string;
  readonly exported_at: string;
  readonly payload: string;
}

const rows = new Map<string, StoredRow>();

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: vi.fn(async () => ({
    execAsync: vi.fn(async () => undefined),
    runAsync: vi.fn(async (sql: string, fingerprint: string, displayName?: string, importedAt?: string, exportedAt?: string, payload?: string) => {
      if (sql.startsWith("DELETE")) {
        rows.delete(fingerprint);
        return;
      }
      rows.set(fingerprint, {
        fingerprint,
        display_name: displayName ?? "",
        imported_at: importedAt ?? "",
        exported_at: exportedAt ?? "",
        payload: payload ?? "{}",
      });
    }),
    getAllAsync: vi.fn(async (_sql: string, firstArg?: string) => {
      const all = Array.from(rows.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
      if (!firstArg) return all;
      const needle = firstArg.replace(/%/g, "").toLocaleLowerCase();
      return all.filter((row) => row.display_name.toLocaleLowerCase().includes(needle) || row.payload.toLocaleLowerCase().includes(needle));
    }),
    withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => fn()),
  })),
}));

const { deleteFriend, loadFriends, upsertFriend } = await import("../src/storage/friendsStore");

const decoded: TimetableShareDecodeResult = {
  fingerprint: "abc123",
  displayName: "Ada Lovelace",
  exportedAt: "2026-06-01T00:00:00.000Z",
  encodedBytes: 120,
  timetables: [
    {
      semester: { id: "VL20252601", name: "Fall" },
      fetchedAt: "2026-01-01T00:00:00.000Z",
      courses: [],
      events: [],
    },
  ],
};

describe("friends store", () => {
  beforeEach(() => rows.clear());

  it("upserts duplicate friends by fingerprint", async () => {
    await upsertFriend(decoded, "2026-06-01T01:00:00.000Z");
    await upsertFriend({ ...decoded, displayName: "Ada Byron" }, "2026-06-01T02:00:00.000Z");

    const friends = await loadFriends();
    expect(friends).toHaveLength(1);
    expect(friends[0]).toMatchObject({
      id: "abc123",
      fingerprint: "abc123",
      displayName: "Ada Byron",
      importedAt: "2026-06-01T02:00:00.000Z",
      exportedAt: "2026-06-01T00:00:00.000Z",
    });
  });

  it("searches by display name and deletes friends", async () => {
    await upsertFriend(decoded, "2026-06-01T01:00:00.000Z");
    await upsertFriend({ ...decoded, fingerprint: "def456", displayName: "Grace Hopper" }, "2026-06-01T01:00:00.000Z");

    expect(await loadFriends("grace")).toHaveLength(1);
    await deleteFriend("def456");
    expect(await loadFriends()).toHaveLength(1);
  });
});
