import type { Course, Semester, TimetableEvent } from "../lib/types";
import { COURSE_CODE_PATTERN } from "../lib/vtopConstants";
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

function attrValue(tag: string, name: string): string | null {
  const attrRegex = /\s([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tag)) !== null) {
    if (match[1]?.toLowerCase() !== name.toLowerCase()) continue;
    return (match[2] ?? match[3] ?? match[4] ?? "").trim();
  }
  return null;
}

function inputValue(html: string, name: string): string | null {
  const inputRegex = /<input\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = inputRegex.exec(html)) !== null) {
    const tag = match[0];
    if (attrValue(tag, "name") !== name) continue;
    return attrValue(tag, "value") ?? "";
  }
  return null;
}

export function tryExtractCsrf(html: string): string | null {
  const input = inputValue(html, "_csrf");
  if (input) return input;

  const metaRegex = /<meta\b[^>]*>/gi;
  let metaMatch: RegExpExecArray | null;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const tag = metaMatch[0];
    const name = attrValue(tag, "name") ?? attrValue(tag, "id");
    if (name !== "_csrf") continue;
    const content = attrValue(tag, "content");
    if (content) return content;
  }

  const scriptMatch = /(?:_csrf|csrfToken)\s*[:=]\s*['"]([^'"]+)['"]/i.exec(html);
  return scriptMatch?.[1]?.trim() || null;
}

export function extractCsrf(html: string): string {
  const value = tryExtractCsrf(html);
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
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(withoutComments)) !== null) {
    const cells = rowCells(match[1] ?? "");
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}


function splitCourseCell(value: string): { code: string; title: string; type: string } | null {
  const match = COURSE_CODE_PATTERN.exec(value);
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

const DAY_PATTERN = /^(MON|TUE|WED|THU|FRI|SAT|SUN|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i;
const SLOT_PATTERN = /(?:^|[^A-Z0-9])((?:L\d+|T?[A-G]{1,2}\d))(?:$|[^A-Z0-9])/i;
const TRAILING_CLASS_MARKER_PATTERN = /^(?:ALL\d*|NIL|GENERAL|REGULAR)$/i;

interface EventCellParts {
  readonly kind: string;
  readonly slot: string;
  readonly courseCode: string;
  readonly venue: string;
}

interface TimeBand {
  readonly start: string;
  readonly end: string;
}

interface TimeBands {
  readonly theory: readonly TimeBand[];
  readonly lab: readonly TimeBand[];
}


function findDay(cells: readonly string[]): string {
  return cells.find((cell) => DAY_PATTERN.test(cell)) ?? "";
}

function findSlot(value: string): string {
  return SLOT_PATTERN.exec(value)?.[1] ?? "";
}

function isLikelyCourseCode(code: string): boolean {
  return /^[A-Z]{2,}\d{4,}[A-Z]?$/i.test(code) || /^[A-Z]{2,}\d{3,}[A-Z]$/i.test(code);
}

function hasLikelyCourseCode(value: string): boolean {
  const match = COURSE_CODE_PATTERN.exec(value);
  return Boolean(match && isLikelyCourseCode(match[0]));
}

function findKind(value: string): string {
  const token = /(?:^|-|\s)(TH|ETH|ELA|LO|LAB|SS)(?=$|-|\s)/i.exec(value)?.[1]?.toUpperCase() ?? "";
  if (token === "TH" || token === "ETH") return "Theory";
  if (token === "LO" || token === "LAB" || token === "ELA") return "Lab";
  if (token === "SS") return "Soft Skill";
  if (/theory/i.test(value)) return "Theory";
  if (/lab/i.test(value)) return "Lab";
  return "";
}

function parseEventCell(value: string): EventCellParts | null {
  const courseMatch = COURSE_CODE_PATTERN.exec(value);
  if (!courseMatch) return null;
  if (!isLikelyCourseCode(courseMatch[0])) return null;

  const slot = findSlot(value);
  const kind = findKind(value);
  const afterCode = value.slice((courseMatch.index ?? 0) + courseMatch[0].length).trim();
  const hasCourseCellShape = Boolean(slot || kind || /^-\s*\S/.test(afterCode) || value.trim() === courseMatch[0]);
  if (!hasCourseCellShape) return null;

  const parts = value.split("-").map((part) => part.trim()).filter(Boolean);
  const coursePartIndex = parts.findIndex((part) => part.includes(courseMatch[0]));
  const kindPartIndex = parts.findIndex((part, index) => index > coursePartIndex && Boolean(findKind(part)));
  const venueParts = kindPartIndex === -1 ? [] : parts.slice(kindPartIndex + 1);
  while (venueParts.length > 0 && TRAILING_CLASS_MARKER_PATTERN.test(venueParts[venueParts.length - 1] ?? "")) {
    venueParts.pop();
  }

  return {
    kind,
    slot,
    courseCode: courseMatch[0],
    venue: venueParts.join("-"),
  };
}

function findNearestSlot(cells: readonly string[], courseCellIndex: number): string {
  for (let index = courseCellIndex - 1; index >= 0; index -= 1) {
    const cell = cells[index] ?? "";
    if (hasLikelyCourseCode(cell)) continue;
    const slot = findSlot(cell);
    if (slot) return slot;
  }

  for (let index = courseCellIndex + 1; index < cells.length; index += 1) {
    const cell = cells[index] ?? "";
    if (hasLikelyCourseCode(cell)) continue;
    const slot = findSlot(cell);
    if (slot) return slot;
  }

  return "";
}

function findVenueAfterCourse(cells: readonly string[], courseCellIndex: number): string {
  for (let index = courseCellIndex + 1; index < cells.length; index += 1) {
    const cell = cells[index] ?? "";
    if (
      !cell ||
      DAY_PATTERN.test(cell) ||
      /\d{1,2}:\d{2}/.test(cell) ||
      findKind(cell) ||
      findSlot(cell) ||
      hasLikelyCourseCode(cell)
    ) continue;
    return cell;
  }
  return "";
}

function buildTimeBands(startRow: readonly string[] | undefined, endRow: readonly string[] | undefined): TimeBand[] {
  if (!startRow || !endRow) return [];
  const starts = startRow.slice(2);
  const ends = endRow.slice(1);
  const length = Math.min(starts.length, ends.length);
  const bands: TimeBand[] = [];
  for (let index = 0; index < length; index += 1) {
    const start = starts[index] ?? "";
    const end = ends[index] ?? "";
    bands.push({ start, end });
  }
  return bands;
}

function parseTimeBands(rows: readonly string[][]): TimeBands {
  const theoryStartIndex = rows.findIndex((cells) => /^THEORY$/i.test(cells[0] ?? "") && /^Start$/i.test(cells[1] ?? ""));
  const labStartIndex = rows.findIndex((cells) => /^LAB$/i.test(cells[0] ?? "") && /^Start$/i.test(cells[1] ?? ""));
  return {
    theory: buildTimeBands(rows[theoryStartIndex], rows[theoryStartIndex + 1]),
    lab: buildTimeBands(rows[labStartIndex], rows[labStartIndex + 1]),
  };
}

function timeForBand(bands: TimeBands, kind: string, dataIndex: number): string {
  const source = /^lab$/i.test(kind) ? bands.lab : bands.theory;
  const band = source[dataIndex];
  if (!band || !band.start || !band.end || band.start === "-" || band.end === "-" || /^Lunch$/i.test(band.start)) return "";
  return `${band.start} - ${band.end}`;
}

export function parseTimetableEvents(html: string): TimetableEvent[] {
  const rows = tableRows(html);
  const bands = parseTimeBands(rows);
  const events: TimetableEvent[] = [];
  let currentDay = "";

  for (const cells of rows) {
    const explicitDay = findDay(cells);
    if (explicitDay) currentDay = explicitDay;
    const day = explicitDay || currentDay;
    if (!day) continue;

    const kindCellIndex = cells.findIndex((cell) => /^(THEORY|LAB)$/i.test(cell));
    const kindCell = kindCellIndex === -1 ? "" : (cells[kindCellIndex] ?? "");
    const rowKind = kindCell || cells.find((cell) => /theory|lab/i.test(cell)) || "";
    const rowTime = cells.find((cell) => /\d{1,2}:\d{2}/.test(cell)) ?? "";
    const rowSlot = cells.find(findSlot) ?? "";
    const dataStartIndex = kindCellIndex === -1 ? 0 : kindCellIndex + 1;

    for (let index = 0; index < cells.length; index += 1) {
      const parsed = parseEventCell(cells[index] ?? "");
      if (!parsed) continue;
      const isSeparateCourseCell = !parsed.slot && !parsed.kind;
      const effectiveKind = parsed.kind || findKind(rowKind);
      const dataIndex = index - dataStartIndex;
      events.push({
        day,
        kind: effectiveKind,
        time: rowTime || (dataIndex >= 0 ? timeForBand(bands, effectiveKind, dataIndex) : ""),
        slot: parsed.slot || (isSeparateCourseCell ? findNearestSlot(cells, index) : findSlot(rowSlot)),
        courseCode: parsed.courseCode,
        venue: parsed.venue || findVenueAfterCourse(cells, index),
        raw: cells.join(" | "),
      });
    }
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
