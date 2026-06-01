import type { AuthSession, SemesterTimetable } from "../types";
import { VtopClient } from "./client";
import { VtopError } from "./errors";
import { parseSemesters, parseTimetableHtml } from "./parser";

export interface SyncOptions {
  readonly onStatus?: (status: string) => void;
}

export async function fetchAllTimetables(
  client: VtopClient,
  session: AuthSession,
  options: SyncOptions = {},
): Promise<SemesterTimetable[]> {
  options.onStatus?.("loading semesters");
  const entry = await client.postForm("/vtop/academics/common/StudentTimeTable", {
    verifyMenu: "true",
    authorizedID: session.authorizedId,
    _csrf: session.csrf,
    nocache: Date.now(),
  });

  const semesters = parseSemesters(entry.text);
  const fetchedAt = new Date().toISOString();
  const timetables: SemesterTimetable[] = [];

  for (const semester of semesters) {
    options.onStatus?.(`fetching ${semester.name}`);
    const html = await client.postForm("/vtop/processViewTimeTable", {
      _csrf: session.csrf,
      semesterSubId: semester.id,
      authorizedID: session.authorizedId,
      x: new Date().toUTCString(),
    });
    if (/\/vtop\/login/i.test(html.url)) throw new VtopError("SESSION_EXPIRED", "VTOP session expired");
    const parsed = parseTimetableHtml(html.text);
    timetables.push({ semester, courses: parsed.courses, events: parsed.events, fetchedAt });
  }

  return timetables;
}
