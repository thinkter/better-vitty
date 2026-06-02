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

export type Screen = "boot" | "onboarding" | "login" | "app";

export interface FriendTimetable {
  readonly id: string;
  readonly fingerprint: string;
  readonly displayName: string;
  readonly importedAt: string;
  readonly exportedAt: string;
  readonly timetables: readonly SemesterTimetable[];
}

export type TimetableSharePayload = TimetableSharePayloadV1 | TimetableSharePayloadV2;

export interface TimetableSharePayloadV1 {
  readonly v: 1;
  readonly n: string;
  readonly x: string;
  readonly t: readonly CompactSemesterTimetable[];
}

export type CompactCourse = readonly [
  code: string,
  title: string,
  type: string,
  credits: string,
  classId: string,
  slot: string,
  venue: string,
  faculty: string,
  status: string,
  raw: readonly string[],
];

export type CompactTimetableEvent = readonly [
  day: string,
  kind: string,
  time: string,
  slot: string,
  courseCode: string,
  venue: string,
  raw: string,
];

export type CompactSemesterTimetable = readonly [
  semesterId: string,
  semesterName: string,
  fetchedAt: string,
  courses: readonly CompactCourse[],
  events: readonly CompactTimetableEvent[],
];
export interface TimetableSharePayloadV2 {
  readonly v: 2;
  readonly s: readonly string[];
  readonly n: number;
  readonly x: number;
  readonly t: readonly CompactV2SemesterTimetable[];
}

export type CompactV2Course = readonly [
  code: number,
  title: number,
  type: number,
  credits: number,
  classId: number,
  slot: number,
  venue: number,
  faculty: number,
  status: number,
];

export type CompactV2TimetableEvent = readonly [
  day: number,
  kind: number,
  time: number,
  slot: number,
  courseCode: number,
  venue: number,
];

export type CompactV2SemesterTimetable = readonly [
  semesterId: number,
  semesterName: number,
  fetchedAt: number,
  courses: readonly CompactV2Course[],
  events: readonly CompactV2TimetableEvent[],
];

export interface TimetableShareDecodeResult {
  readonly fingerprint: string;
  readonly displayName: string;
  readonly exportedAt: string;
  readonly timetables: readonly SemesterTimetable[];
  readonly encodedBytes: number;
}
