import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { VtopClient } from "./client";
import { loginToVtop } from "./login";
import { fetchAllTimetables } from "./timetable";

config();

const username = process.env.VTOP_USERNAME;
const password = process.env.VTOP_PASSWORD;
const runLive = Boolean(username && password);

describe.runIf(runLive)("live VTOP timetable sync", () => {
  it(
    "logs in with env credentials and prints fetched timetables",
    async () => {
      expect(username).toBeTruthy();
      expect(password).toBeTruthy();

      const statuses: string[] = [];
      const client = new VtopClient();
      const login = await loginToVtop(client, {
        username: username!,
        password: password!,
        maxCaptchaAttempts: 6,
        maxCaptchaPageAttempts: 8,
        onStatus: (status) => statuses.push(status),
      });

      const timetables = await fetchAllTimetables(client, login.session, {
        onStatus: (status) => statuses.push(status),
      });

      expect(timetables.length).toBeGreaterThan(0);
      for (const timetable of timetables) {
        expect(timetable.semester.id).toBeTruthy();
        expect(timetable.semester.name).toBeTruthy();
        expect(timetable.courses.length + timetable.events.length).toBeGreaterThan(0);
      }

      const summary = timetables
        .map((timetable) => {
          const courses = timetable.courses
            .slice(0, 12)
            .map((course) => `  ${course.code} ${course.title}${course.slot ? ` [${course.slot}]` : ""}`)
            .join("\n");
          const events = timetable.events
            .slice(0, 12)
            .map((event) => `  ${event.day} ${event.time} ${event.courseCode} ${event.venue}`)
            .join("\n");
          return [`${timetable.semester.name} (${timetable.semester.id})`, "courses:", courses || "  none", "events:", events || "  none"].join("\n");
        })
        .join("\n\n");

      console.info(`\nVTOP timetable summary\n${summary}`);
      expect(statuses.length).toBeGreaterThan(0);
    },
    120_000,
  );
});

describe.skipIf(runLive)("live VTOP timetable sync", () => {
  it("requires VTOP_USERNAME and VTOP_PASSWORD in .env", () => {
    expect(username && password, "set VTOP_USERNAME and VTOP_PASSWORD in .env").toBeTruthy();
  });
});
