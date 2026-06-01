export interface Semester {
  readonly id: string;
  readonly name: string;
}

export interface Course {
  readonly code: string;
  readonly title: string;
  readonly type: string;
  readonly credits: string;
  readonly classId: string;
  readonly slot: string;
  readonly venue: string;
  readonly faculty: string;
  readonly status: string;
  readonly raw: readonly string[];
}

export interface TimetableEvent {
  readonly day: string;
  readonly kind: string;
  readonly time: string;
  readonly slot: string;
  readonly courseCode: string;
  readonly venue: string;
  readonly raw: string;
}

export interface SemesterTimetable {
  readonly semester: Semester;
  readonly courses: readonly Course[];
  readonly events: readonly TimetableEvent[];
  readonly fetchedAt: string;
}

export interface AuthSession {
  readonly csrf: string;
  readonly authorizedId: string;
}

export interface LoginResult {
  readonly session: AuthSession;
  readonly attempts: number;
}

export type AppPhase = "idle" | "loading" | "syncing" | "done" | "error";

export type Screen = "boot" | "onboarding" | "login" | "timetable";
