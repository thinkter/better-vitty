import { describe, expect, it } from "vitest";
import { VtopError } from "../../src/vtop/errors";
import { extractCsrf, parseSemesters, parseTimetableHtml, tryExtractCsrf } from "../../src/vtop/parser";

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
      <td>Monday</td><td>Theory</td><td>09:00 - 09:50</td><td>A1</td><td>CSE1001 - Computer Networks</td><td>ABC123 - East Wing</td>
    </tr>
  </table>
`;

const GRID_TIMETABLE_HTML = `
  <table id="timeTableStyle">
    <tr>
      <td rowspan="2">THEORY</td><td>Start</td><td>08:00</td><td>09:00</td><td>10:00</td><td>11:00</td><td>12:00</td><td>-</td><td>Lunch</td><td>14:00</td>
    </tr>
    <tr>
      <td>End</td><td>08:50</td><td>09:50</td><td>10:50</td><td>11:50</td><td>12:50</td><td>-</td><td>Lunch</td><td>14:50</td>
    </tr>
    <tr>
      <td rowspan="2">LAB</td><td>Start</td><td>08:00</td><td>08:51</td><td>09:51</td><td>10:41</td>
    </tr>
    <tr>
      <td>End</td><td>08:50</td><td>09:40</td><td>10:40</td><td>11:30</td>
    </tr>
    <tr>
      <td rowspan="2">MON</td><td>THEORY</td>
      <!-- <td>thymeleaf-comment-should-not-be-parsed</td> -->
      <td>A1</td><td>F1</td><td>D1</td><td>TB1</td><td>TG1</td><td>-</td><td>Lunch</td><td>A2-BCSE205L-TH-PRP220-ALL</td>
    </tr>
    <tr>
      <td>LAB</td><td>L7-BMAT202P-LO-PRP450-ALL</td><td>L8-BMAT202P-LO-PRP450-ALL</td><td>L9-BCSE204P-LO-Academic Block 5-Room 42-ALL</td>
    </tr>
    <tr>
      <td rowspan="2">TUE</td><td>THEORY</td><td>B2-BMAT202L-TH-PRP219-ALL</td>
    </tr>
    <tr>
      <td>LAB</td><td>L29-BECE204P-LO-PRP322-ALL</td>
    </tr>
  </table>
`;

const SEPARATED_GRID_TIMETABLE_HTML = `
  <table>
    <tr>
      <td>MON</td>
      <td>A1</td>
      <td>BCSE100L - Operating Systems</td>
      <td>F1</td>
      <td>BCSE101L - Computer Networks</td>
      <td>A2</td>
      <td>BCSE205L - Computer Architecture and Organization</td>
      <td>F2</td>
      <td>BCSE204L - Design and Analysis of Algorithms</td>
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
    expect(parsed.events).toContainEqual(expect.objectContaining({ day: "Monday", kind: "Theory", courseCode: "CSE1001", slot: "A1", time: "09:00 - 09:50", venue: "ABC123 - East Wing" }));
    expect(parsed.events).toHaveLength(1);
  });

  it("parses every populated class cell from VTOP timetable grid rows", () => {
    const parsed = parseTimetableHtml(GRID_TIMETABLE_HTML);

    expect(parsed.events).toEqual([
      expect.objectContaining({ day: "MON", kind: "Theory", courseCode: "BCSE205L", slot: "A2", venue: "PRP220", time: "14:00 - 14:50" }),
      expect.objectContaining({ day: "MON", kind: "Lab", courseCode: "BMAT202P", slot: "L7", venue: "PRP450", time: "08:00 - 08:50" }),
      expect.objectContaining({ day: "MON", kind: "Lab", courseCode: "BMAT202P", slot: "L8", venue: "PRP450", time: "08:51 - 09:40" }),
      expect.objectContaining({ day: "MON", kind: "Lab", courseCode: "BCSE204P", slot: "L9", venue: "Academic Block 5-Room 42", time: "09:51 - 10:40" }),
      expect.objectContaining({ day: "TUE", kind: "Theory", courseCode: "BMAT202L", slot: "B2", venue: "PRP219", time: "08:00 - 08:50" }),
      expect.objectContaining({ day: "TUE", kind: "Lab", courseCode: "BECE204P", slot: "L29", venue: "PRP322", time: "08:00 - 08:50" }),
    ]);
    expect(parsed.events).toHaveLength(6);
  });

  it("keeps every separated course cell in a day row and pairs it with the nearest slot", () => {
    const parsed = parseTimetableHtml(SEPARATED_GRID_TIMETABLE_HTML);

    expect(parsed.events).toEqual([
      expect.objectContaining({ day: "MON", courseCode: "BCSE100L", slot: "A1", venue: "" }),
      expect.objectContaining({ day: "MON", courseCode: "BCSE101L", slot: "F1", venue: "" }),
      expect.objectContaining({ day: "MON", courseCode: "BCSE205L", slot: "A2", venue: "" }),
      expect.objectContaining({ day: "MON", courseCode: "BCSE204L", slot: "F2", venue: "" }),
    ]);
    expect(parsed.events).toHaveLength(4);
  });

  it("throws typed errors for missing CSRF and empty semesters", () => {
    expect(() => extractCsrf("<html></html>")).toThrow(VtopError);
    expect(() => parseSemesters('<select id="semesterSubId"></select>')).toThrow(VtopError);
  });

  it("extracts CSRF tokens from VTOP input, meta, and script variants", () => {
    expect(tryExtractCsrf('<input value=abc123 name="_csrf">')).toBe("abc123");
    expect(tryExtractCsrf('<meta content="def456" name="_csrf">')).toBe("def456");
    expect(tryExtractCsrf("<script>const csrfToken = 'ghi789';</script>")).toBe("ghi789");
  });
});
