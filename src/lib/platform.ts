const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
const hasTouch =
  typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 0;
const smallScreen =
  typeof window !== "undefined" &&
  Math.min(window.screen?.width ?? 0, window.screen?.height ?? 0) < 900;

// Android WebView normally includes "Android" in the UA, but some builds
// customize it. A touch screen with phone-sized display is the same reader
// layout, so use that as a fallback.
export const IS_ANDROID =
  /Android/i.test(userAgent) || (hasTouch && smallScreen);
