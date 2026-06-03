import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

const BASE_PHONE_WIDTH = 390;
const MIN_PHONE_SCALE = 0.88;
const MAX_PHONE_SCALE = 1.08;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function scaled(value: number, width: number): number {
  return Math.round(value * clamp(width / BASE_PHONE_WIDTH, MIN_PHONE_SCALE, MAX_PHONE_SCALE));
}

export function usePhoneMetrics() {
  const { width, fontScale } = useWindowDimensions();

  return useMemo(() => {
    const compact = width < 360;
    const roomy = width >= 430;

    return {
      width,
      compact,
      roomy,
      fontMultiplier: Math.min(fontScale, 1.15),
      gutter: compact ? 16 : scaled(20, width),
      headerTop: compact ? 8 : 10,
      headerBottom: compact ? 10 : 12,
      headerGap: compact ? 8 : 10,
      brandFont: compact ? 14 : scaled(15, width),
      actionFont: compact ? 11 : 12,
      captionFont: compact ? 10 : 11,
      tabFont: compact ? 11 : 12,
      dayTabFont: compact ? 11 : 12,
      dayTabPaddingY: compact ? 10 : 12,
      eventTimeFont: compact ? 12 : 13,
      eventCodeFont: compact ? 13 : 14,
      eventBodyFont: compact ? 12 : 13,
      eventMetaFont: compact ? 11 : 12,
      eventTitleLineHeight: compact ? 18 : 20,
      eventPaddingY: compact ? 14 : roomy ? 20 : 18,
      eventGap: compact ? 3 : 4,
      scheduleTop: compact ? 16 : 20,
      scheduleBottom: compact ? 32 : 40,
      bottomTabPaddingY: compact ? 12 : 14,
      bottomTabSafeGap: compact ? 8 : 10,
      minTouchSize: 44,
    };
  }, [fontScale, width]);
}
