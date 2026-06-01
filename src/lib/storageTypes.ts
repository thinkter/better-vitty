import * as SQLite from "expo-sqlite";

export type SQLiteDatabase = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;
