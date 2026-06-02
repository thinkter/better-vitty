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
  readonly registration_number: string | null;
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
  `);
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(friends)");
  if (!columns.some((column) => column.name === "registration_number")) {
    await db.execAsync("ALTER TABLE friends ADD COLUMN registration_number TEXT NOT NULL DEFAULT '';");
  }
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS friends_display_name_idx ON friends(display_name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS friends_registration_number_idx ON friends(registration_number COLLATE NOCASE);
  `);
  return db;
}

function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function stableFriendKey(decoded: TimetableShareDecodeResult): string {
  return decoded.registrationNumber ? `reg:${decoded.registrationNumber}` : decoded.fingerprint;
}

async function existingFriendKey(db: SQLiteDatabase, decoded: TimetableShareDecodeResult, key: string): Promise<string> {
  if (!decoded.registrationNumber) return key;
  const existing = await db.getFirstAsync<{ fingerprint: string }>(
    `SELECT fingerprint
     FROM friends
     WHERE fingerprint = ? OR registration_number = ? OR lower(payload) LIKE ?
     ORDER BY CASE WHEN fingerprint = ? THEN 0 WHEN registration_number = ? THEN 1 ELSE 2 END
     LIMIT 1`,
    key,
    decoded.registrationNumber,
    `%"registrationnumber":"${decoded.registrationNumber.toLocaleLowerCase()}"%`,
    key,
    decoded.registrationNumber,
  );
  return existing?.fingerprint ?? key;
}

function rowToFriend(row: FriendRow): FriendTimetable {
  const parsed = JSON.parse(row.payload) as Pick<FriendTimetable, "registrationNumber" | "timetables">;
  return {
    id: row.fingerprint,
    fingerprint: row.fingerprint,
    displayName: row.display_name,
    registrationNumber: row.registration_number || parsed.registrationNumber || "",
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
        `SELECT fingerprint, display_name, imported_at, exported_at, payload, registration_number
         FROM friends
         WHERE lower(display_name) LIKE ? OR lower(registration_number) LIKE ? OR lower(payload) LIKE ?
         ORDER BY display_name COLLATE NOCASE ASC, imported_at DESC`,
        `%${normalizedQuery}%`,
        `%${normalizedQuery}%`,
        `%${normalizedQuery}%`,
      )
    : await db.getAllAsync<FriendRow>(
        `SELECT fingerprint, display_name, imported_at, exported_at, payload, registration_number
         FROM friends
         ORDER BY display_name COLLATE NOCASE ASC, imported_at DESC`,
      );
  return rows.map(rowToFriend);
}

export async function upsertFriend(decoded: TimetableShareDecodeResult, importedAt = new Date().toISOString()): Promise<FriendTimetable> {
  const db = await database();
  const key = stableFriendKey(decoded);
  const existingKey = await existingFriendKey(db, decoded, key);
  const payload = JSON.stringify({ registrationNumber: decoded.registrationNumber, timetables: decoded.timetables });
  await db.runAsync(
    `INSERT INTO friends (fingerprint, display_name, imported_at, exported_at, payload, registration_number)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(fingerprint) DO UPDATE SET
       fingerprint = excluded.fingerprint,
       display_name = excluded.display_name,
       imported_at = excluded.imported_at,
       exported_at = excluded.exported_at,
       payload = excluded.payload,
       registration_number = excluded.registration_number`,
    existingKey,
    decoded.displayName,
    importedAt,
    decoded.exportedAt,
    payload,
    decoded.registrationNumber,
  );
  return {
    id: existingKey,
    fingerprint: existingKey,
    displayName: decoded.displayName,
    registrationNumber: decoded.registrationNumber,
    importedAt,
    exportedAt: decoded.exportedAt,
    timetables: decoded.timetables,
  };
}

export async function deleteFriend(fingerprint: string): Promise<void> {
  const db = await database();
  await db.runAsync("DELETE FROM friends WHERE fingerprint = ?", fingerprint);
}
