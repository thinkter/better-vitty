import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { readWidgetSnapshot } from "./widgetSnapshot";
import { TodayWidget } from "./TodayWidget";

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, widgetAction, renderWidget } = props;
  const { width, height } = widgetInfo;

  switch (widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      const snapshot = await readWidgetSnapshot();
      renderWidget(
        <TodayWidget snapshot={snapshot} widthDp={width} heightDp={height} />,
      );
      break;
    }
    case "WIDGET_CLICK":
    case "WIDGET_DELETED":
      break;
    default:
      break;
  }
}
