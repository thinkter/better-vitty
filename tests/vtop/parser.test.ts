import { describe, expect, it } from "vitest";
import { VtopError } from "../../src/vtop/errors";
import { extractCsrf, parseSemesters, parseTimetableHtml } from "../../src/vtop/parser";

const SEMESTER_HTML = `
  <select id="semesterSubId">
    <option value="">Select</option>
    <option value="VL20252605">Winter Semester 2025-26</option>
    <option value="VL20252601">Fall Semester 2025-26</option>
    <option value="VL20242505">Winter Semester 2024-25</option>
    <option value="VL20242501">Fall Semester 2024-25</option>
  </select>
`;

const TIMETABLE_HTML = `
  <table>
    <tr>
      <td>1</td><td>Embedded Theory</td><td>CSE1001 - Computer Networks (Theory Only)</td><td>3</td>
      <td>ETH</td><td>Registered</td><td>VL202526010001</td><td>A1 - SJT-301</td>
      <td>Dr. Ada - SITE</td><td>Regular</td><td>Basket</td><td>English</td>
    </tr>
    <tr>
      <td>Monday</td><td>Theory</td><td>09:00 - 09:50</td><td>A1</td><td>CSE1001 - Computer Networks</td><td>SJT-301</td>
    </tr>
  </table>
`;

describe("VTOP HTML parsers", () => {
  it("extracts all semester options from the timetable entry page", () => {
    expect(parseSemesters(SEMESTER_HTML)).toEqual([
      { id: "VL20252605", name: "Winter Semester 2025-26" },
      { id: "VL20252601", name: "Fall Semester 2025-26" },
      { id: "VL20242505", name: "Winter Semester 2024-25" },
      { id: "VL20242501", name: "Fall Semester 2024-25" },
    ]);
  });

  it("parses course and event data from a processViewTimeTable response", () => {
    const parsed = parseTimetableHtml(TIMETABLE_HTML);

    expect(parsed.courses).toContainEqual(
      expect.objectContaining({ code: "CSE1001", title: "Computer Networks", classId: "VL202526010001", slot: "A1", venue: "SJT" }),
    );
    expect(parsed.events).toContainEqual(expect.objectContaining({ day: "Monday", kind: "Theory", courseCode: "CSE1001", slot: "A1", time: "09:00 - 09:50" }));
  });

  it("throws typed errors for missing CSRF and empty semesters", () => {
    expect(() => extractCsrf("<html></html>")).toThrow(VtopError);
    expect(() => parseSemesters('<select id="semesterSubId"></select>')).toThrow(VtopError);
  });
});
