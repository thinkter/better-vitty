import * as SQLite from "expo-sqlite";
import type { SemesterTimetable } from "../types";

const DB_NAME = "better-vitty.db";

type SQLiteDatabase = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;
let dbPromise: Promise<SQLiteDatabase> | null = null;

async function database(): Promise<SQLiteDatabase> {
  dbPromise ??= SQLite.openDatabaseAsync(DB_NAME);
  const db = await dbPromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS timetables (
      semester_id TEXT PRIMARY KEY NOT NULL,
      semester_name TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `);
  return db;
}

export async function saveTimetables(timetables: readonly SemesterTimetable[]): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM timetables");
    for (const timetable of timetables) {
      await db.runAsync(
        "INSERT INTO timetables (semester_id, semester_name, fetched_at, payload) VALUES (?, ?, ?, ?)",
        timetable.semester.id,
        timetable.semester.name,
        timetable.fetchedAt,
        JSON.stringify(timetable),
      );
    }
  });
}

export async function loadTimetables(): Promise<SemesterTimetable[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ payload: string }>("SELECT payload FROM timetables ORDER BY fetched_at DESC, semester_name ASC");
  return rows.map((row) => JSON.parse(row.payload) as SemesterTimetable);
}
