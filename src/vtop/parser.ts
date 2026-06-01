import type { Course, Semester, TimetableEvent } from "../types";
import { VtopError } from "./errors";

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

export function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function inputValue(html: string, name: string): string | null {
  const inputRegex = /<input\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = inputRegex.exec(html)) !== null) {
    const tag = match[0];
    const nameMatch = /\bname\s*=\s*["']?([^"'\s>]+)/i.exec(tag);
    if (nameMatch?.[1] !== name) continue;
    return /\bvalue\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.trim() ?? "";
  }
  return null;
}

export function extractCsrf(html: string): string {
  const value = inputValue(html, "_csrf");
  if (!value) throw new VtopError("CSRF_MISSING", "VTOP page did not contain a CSRF token");
  return value;
}

export function extractAuthorizedId(html: string): string {
  const value = inputValue(html, "authorizedID") || inputValue(html, "authorizedIDX");
  if (value) return value;

  const match = /authorizedID[X]?\s*[=:]\s*['"]?([A-Za-z0-9_.@-]+)/.exec(html);
  if (match?.[1]) return match[1];
  throw new VtopError("SESSION_EXPIRED", "authenticated VTOP page did not contain authorizedID");
}

export function isRecaptchaPage(html: string): boolean {
  return /id=["'](?:g-)?recaptcha["']|class=["'][^"']*g-recaptcha|captchaType\s*=\s*2/i.test(html);
}

export function extractCaptchaDataUri(html: string): string | null {
  if (!/<input\b[^>]*(?:name|id)\s*=\s*["']?captchaStr/i.test(html)) return null;

  const imgRegex = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(imgMatch[0])?.[1]?.trim();
    if (src?.startsWith("data:image/")) return src;
  }

  const match = /(data:image\/(?:png|jpe?g);base64,[A-Za-z0-9+/=]+)/.exec(html);
  return match?.[1] ?? null;
}

export function parseSemesters(html: string): Semester[] {
  const selectMatch = /<select\b[^>]*id\s*=\s*["']semesterSubId["'][^>]*>([\s\S]*?)<\/select>/i.exec(html);
  const selectHtml = selectMatch?.[1] ?? html;
  const optionRegex = /<option\b[^>]*\bvalue\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi;
  const semesters: Semester[] = [];
  let optionMatch: RegExpExecArray | null;
  while ((optionMatch = optionRegex.exec(selectHtml)) !== null) {
    const id = optionMatch[1]?.trim() ?? "";
    const name = cleanText(optionMatch[2] ?? "");
    if (id && name && !/^select$/i.test(name)) semesters.push({ id, name });
  }
  if (semesters.length === 0) throw new VtopError("NO_SEMESTERS", "no registered semesters found");
  return semesters;
}

function rowCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(rowHtml)) !== null) {
    cells.push(cleanText(match[1] ?? ""));
  }
  return cells.filter((cell) => cell.length > 0);
}

function tableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const cells = rowCells(match[1] ?? "");
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

const COURSE_CODE_RE = /[A-Z]{2,}\d{3,}[A-Z]?/;

function splitCourseCell(value: string): { code: string; title: string; type: string } | null {
  const match = COURSE_CODE_RE.exec(value);
  if (!match) return null;
  const code = match[0];
  const afterCode = value.slice((match.index ?? 0) + code.length);
  const title = afterCode.replace(/^\s*-\s*/, "").replace(/\(\s*[^)]*Only\s*\)/i, "").trim();
  const type = /\(\s*([^)]*Only)\s*\)/i.exec(value)?.[1]?.trim() ?? "";
  return { code, title, type };
}

function parseSlotVenue(value: string): { slot: string; venue: string } {
  const parts = value.split("-").map((part) => part.trim()).filter(Boolean);
  return {
    slot: parts[0] ?? "",
    venue: parts.find((part) => /[A-Z]{2,}-?\d{2,}|SJT|TT|PRP|MB|SMV|ONLINE/i.test(part)) ?? "",
  };
}

export function parseCourses(html: string): Course[] {
  const courses: Course[] = [];
  for (const cells of tableRows(html)) {
    const courseCell = cells[2] ?? "";
    const course = splitCourseCell(courseCell);
    if (!course || cells.length !== 12 || !/^VL\d+/i.test(cells[6] ?? "")) continue;
    if (courses.some((existing) => existing.code === course.code && existing.classId === (cells[6] ?? ""))) continue;
    const slotVenue = parseSlotVenue(cells[7] ?? "");
    courses.push({
      code: course.code,
      title: course.title,
      type: course.type,
      credits: cells[3] ?? "",
      classId: cells[6] ?? "",
      slot: slotVenue.slot,
      venue: slotVenue.venue,
      faculty: (cells[8] ?? "").split("-")[0]?.trim() ?? "",
      status: cells[5] ?? "",
      raw: cells,
    });
  }
  return courses;
}

function findCourseCode(value: string): string {
  return COURSE_CODE_RE.exec(value)?.[0] ?? "";
}

export function parseTimetableEvents(html: string): TimetableEvent[] {
  const events: TimetableEvent[] = [];
  for (const cells of tableRows(html)) {
    if (cells.length < 4) continue;
    const day = cells.find((cell) => /^(MON|TUE|WED|THU|FRI|SAT|SUN|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(cell)) ?? "";
    if (!day) continue;
    const kind = cells.find((cell) => /theory|lab/i.test(cell)) ?? "";
    const codeCell = cells.find((cell) => findCourseCode(cell));
    if (!codeCell) continue;
    const raw = cells.join(" | ");
    events.push({
      day,
      kind,
      time: cells.find((cell) => /\d{1,2}:\d{2}/.test(cell)) ?? "",
      slot: cells.find((cell) => /^(?:[A-Z]\d?|L\d+)(?:\+|-|$)/.test(cell)) ?? "",
      courseCode: findCourseCode(codeCell),
      venue: cells.find((cell) => /[A-Z]{2,}-?\d{2,}|SJT|TT|PRP|MB|SMV|ONLINE/i.test(cell)) ?? "",
      raw,
    });
  }
  return events;
}

export function parseTimetableHtml(html: string): { courses: Course[]; events: TimetableEvent[] } {
  const courses = parseCourses(html);
  const events = parseTimetableEvents(html);
  if (courses.length === 0 && events.length === 0) {
    throw new VtopError("TIMETABLE_FORMAT_CHANGED", "timetable format changed");
  }
  return { courses, events };
}
