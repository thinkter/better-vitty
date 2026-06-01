import type { SemesterTimetable } from "../lib/types";
import { saveTimetables } from "../storage/timetableStore";
import { VtopClient } from "./client";
import { loginToVtop } from "./login";
import { fetchAllTimetables } from "./timetable";

interface SyncTimetablesOptions {
  readonly username: string;
  readonly password: string;
  readonly onStatus?: (status: string) => void;
}

export interface SyncTimetablesResult {
  readonly attempts: number;
  readonly timetables: SemesterTimetable[];
}

export async function syncTimetablesFromVtop(
  options: SyncTimetablesOptions,
): Promise<SyncTimetablesResult> {
  const client = new VtopClient();
  const login = await loginToVtop(client, {
    username: options.username.trim(),
    password: options.password,
    ...(options.onStatus ? { onStatus: options.onStatus } : {}),
  });
  options.onStatus?.(
    `authenticated (${login.attempts} captcha attempt${login.attempts === 1 ? "" : "s"})`,
  );
  const timetables = await fetchAllTimetables(
    client,
    login.session,
    options.onStatus ? { onStatus: options.onStatus } : {},
  );
  await saveTimetables(timetables);
  options.onStatus?.(
    `saved ${timetables.length} semester${timetables.length === 1 ? "" : "s"} to device`,
  );
  return {
    attempts: login.attempts,
    timetables,
  };
}
