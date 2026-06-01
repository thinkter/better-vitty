import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VtopError } from "./errors";
import { extractCsrf, parseSemesters, parseTimetableHtml } from "./parser";

function harEntry(index: number): string {
  const har = JSON.parse(readFileSync("vtop.vit.ac.in.har", "utf8")) as {
    log: { entries: Array<{ response: { content: { text?: string } } }> };
  };
  return har.log.entries[index]?.response.content.text ?? "";
}

describe("VTOP HTML parsers", () => {
  it("extracts all semester options from the timetable entry page", () => {
    const semesters = parseSemesters(harEntry(87));
    expect(semesters).toEqual([
      { id: "VL20252605", name: "Winter Semester 2025-26" },
      { id: "VL20252601", name: "Fall Semester 2025-26" },
      { id: "VL20242505", name: "Winter Semester 2024-25" },
      { id: "VL20242501", name: "Fall Semester 2024-25" },
    ]);
  });

  it("parses course and event data from a processViewTimeTable response", () => {
    const parsed = parseTimetableHtml(harEntry(88));
    expect(parsed.courses.length).toBeGreaterThan(0);
    expect(parsed.events.length).toBeGreaterThan(0);
    expect(parsed.courses.some((course) => course.code.length > 0 && course.title.length > 0)).toBe(true);
    expect(parsed.events.some((event) => event.day.length > 0 && event.courseCode.length > 0)).toBe(true);
  });

  it("throws typed errors for missing CSRF and empty semesters", () => {
    expect(() => extractCsrf("<html></html>")).toThrow(VtopError);
    expect(() => parseSemesters('<select id="semesterSubId"></select>')).toThrow(VtopError);
  });
});
