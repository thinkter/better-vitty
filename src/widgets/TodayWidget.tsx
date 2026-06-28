import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { DAY_ORDER, selectCurrentNext } from "../lib/timetableModel";
import type { WidgetSnapshot, WidgetEvent } from "./widgetSnapshot";

interface TodayWidgetProps {
  readonly snapshot: WidgetSnapshot | null;
  readonly widthDp: number;
  readonly heightDp: number;
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function todayKey(): (typeof DAY_ORDER)[number] {
  const jsDay = new Date().getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return DAY_ORDER[idx] ?? "MON";
}

interface EventRowProps {
  readonly ev: WidgetEvent;
  readonly status: "current" | "past" | "future" | "next";
  readonly isLast: boolean;
}

function EventRow({ ev, status, isLast }: EventRowProps) {
  const dim = status === "past";
  const active = status === "current";
  const codeColor = dim ? "#555" : "#ffffff";
  const timeColor = dim ? "#555" : "#ffffff";
  const metaColor = dim ? "#444" : "#888888";
  const prefix = active ? "> " : "  ";

  return (
    <FlexWidget
      style={{
        flexDirection: "column",
        width: "match_parent",
        backgroundColor: active ? "#0d0d0d" : "#000000",
        paddingHorizontal: 0,
        paddingVertical: 4,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#111111",
      }}
    >
      <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
        <TextWidget
          text={prefix}
          style={{ color: active ? "#ffffff" : "#333333", fontSize: 11, fontFamily: "monospace", width: 16 }}
        />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={ev.time}
            style={{ color: timeColor, fontSize: 11, fontFamily: "monospace", width: "match_parent" }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", marginTop: 1 }}>
        <TextWidget
          text={"  "}
          style={{ color: "#000000", fontSize: 11, fontFamily: "monospace", width: 16 }}
        />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={ev.code}
            style={{ color: codeColor, fontSize: 12, fontFamily: "monospace", fontWeight: "bold", width: "match_parent" }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>
      {ev.title ? (
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", marginTop: 1 }}>
          <TextWidget
            text={"  "}
            style={{ color: "#000000", fontSize: 10, fontFamily: "monospace", width: 16 }}
          />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text={ev.title}
              style={{ color: metaColor, fontSize: 10, fontFamily: "monospace", width: "match_parent" }}
              truncate="END"
              maxLines={1}
            />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

export function TodayWidget({ snapshot, heightDp }: TodayWidgetProps) {
  const today = todayKey();
  const now = nowMinutes();
  const events: readonly WidgetEvent[] = snapshot?.week[today] ?? [];
  const semesterName = snapshot?.semesterName ?? "";

  const maxRows = Math.max(1, Math.floor((heightDp - 36) / 52));

  const { currentIndex, nextIndex } = selectCurrentNext(
    events.map((e) => ({
      day: today,
      kind: e.kind,
      time: e.time,
      slot: "",
      courseCode: e.code,
      venue: e.venue,
      raw: "",
    })),
    now,
  );

  function statusFor(i: number): "current" | "past" | "future" | "next" {
    if (i === currentIndex) return "current";
    const ev = events[i]!;
    if (ev.startMinutes !== null && ev.startMinutes < now && i !== currentIndex) return "past";
    if (i === nextIndex) return "next";
    return "future";
  }

  const shown = events.slice(0, maxRows);
  const overflow = events.length - shown.length;

  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: "#000000",
        flexDirection: "column",
        padding: 12,
      }}
      clickAction="OPEN_APP"
    >
      <FlexWidget
        style={{
          flexDirection: "row",
          width: "match_parent",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <TextWidget
          text="better-vitty"
          style={{ color: "#888888", fontSize: 11, fontFamily: "monospace" }}
        />
        <FlexWidget style={{ flexDirection: "column", alignItems: "flex-end" }}>
          <TextWidget
            text={today}
            style={{ color: "#ffffff", fontSize: 11, fontFamily: "monospace" }}
          />
          {semesterName ? (
            <TextWidget
              text={semesterName}
              style={{ color: "#444444", fontSize: 9, fontFamily: "monospace" }}
              truncate="END"
              maxLines={1}
            />
          ) : null}
        </FlexWidget>
      </FlexWidget>

      {events.length === 0 ? (
        <TextWidget
          text="no classes today."
          style={{ color: "#2a2a2a", fontSize: 12, fontFamily: "monospace" }}
        />
      ) : (
        <FlexWidget style={{ flexDirection: "column", width: "match_parent", flex: 1 }}>
          {shown.map((ev, i) => (
            <EventRow
              key={`${ev.code}:${ev.time}:${i}`}
              ev={ev}
              status={statusFor(i)}
              isLast={i === shown.length - 1 && overflow === 0}
            />
          ))}
          {overflow > 0 ? (
            <TextWidget
              text={`  +${overflow} more`}
              style={{ color: "#2a2a2a", fontSize: 10, fontFamily: "monospace", marginTop: 4 }}
            />
          ) : null}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
