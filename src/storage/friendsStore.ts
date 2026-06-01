import * as SQLite from "expo-sqlite";
import { TIMETABLE_DB_NAME } from "../lib/storageConstants";
import type { FriendTimetable, TimetableShareDecodeResult } from "../lib/types";
import type { SQLiteDatabase } from "../lib/storageTypes";

let dbPromise: Promise<SQLiteDatabase> | null = null;

interface FriendRow {
  readonly fingerprint: string;
  readonly display_name: string;
  readonly imported_at: string;
  readonly exported_at: string;
  readonly payload: string;
}

async function database(): Promise<SQLiteDatabase> {
  dbPromise ??= SQLite.openDatabaseAsync(TIMETABLE_DB_NAME);
  const db = await dbPromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS friends (
      fingerprint TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      exported_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS friends_display_name_idx ON friends(display_name COLLATE NOCASE);
  `);
  return db;
}

function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function rowToFriend(row: FriendRow): FriendTimetable {
  const parsed = JSON.parse(row.payload) as Pick<FriendTimetable, "timetables">;
  return {
    id: row.fingerprint,
    fingerprint: row.fingerprint,
    displayName: row.display_name,
    importedAt: row.imported_at,
    exportedAt: row.exported_at,
    timetables: parsed.timetables,
  };
}

export async function loadFriends(query = ""): Promise<FriendTimetable[]> {
  const db = await database();
  const normalizedQuery = normalizeSearch(query);
  const rows = normalizedQuery
    ? await db.getAllAsync<FriendRow>(
        `SELECT fingerprint, display_name, imported_at, exported_at, payload
         FROM friends
         WHERE lower(display_name) LIKE ? OR lower(payload) LIKE ?
         ORDER BY display_name COLLATE NOCASE ASC, imported_at DESC`,
        `%${normalizedQuery}%`,
        `%${normalizedQuery}%`,
      )
    : await db.getAllAsync<FriendRow>(
        `SELECT fingerprint, display_name, imported_at, exported_at, payload
         FROM friends
         ORDER BY display_name COLLATE NOCASE ASC, imported_at DESC`,
      );
  return rows.map(rowToFriend);
}

export async function upsertFriend(decoded: TimetableShareDecodeResult, importedAt = new Date().toISOString()): Promise<FriendTimetable> {
  const db = await database();
  const payload = JSON.stringify({ timetables: decoded.timetables });
  await db.runAsync(
    `INSERT INTO friends (fingerprint, display_name, imported_at, exported_at, payload)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(fingerprint) DO UPDATE SET
       display_name = excluded.display_name,
       imported_at = excluded.imported_at,
       exported_at = excluded.exported_at,
       payload = excluded.payload`,
    decoded.fingerprint,
    decoded.displayName,
    importedAt,
    decoded.exportedAt,
    payload,
  );
  return {
    id: decoded.fingerprint,
    fingerprint: decoded.fingerprint,
    displayName: decoded.displayName,
    importedAt,
    exportedAt: decoded.exportedAt,
    timetables: decoded.timetables,
  };
}

export async function deleteFriend(fingerprint: string): Promise<void> {
  const db = await database();
  await db.runAsync("DELETE FROM friends WHERE fingerprint = ?", fingerprint);
}
