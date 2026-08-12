export type PlatformId = "mac" | "windows" | "android" | "ios";

export type Release = {
  id: PlatformId;
  name: string;
  /** Shown under the name, e.g. "macOS 12 or later". */
  requirement: string;
  /**
   * Direct download for desktop and Android, store listing for iOS.
   * Null means the build does not exist yet and the card renders as coming soon.
   */
  url: string | null;
  /** Displayed beside the button once a build exists. */
  version?: string;
  size?: string;
  /** Extra guidance shown only on this platform's card, e.g. how to allow an APK install. */
  note?: string;
};

/**
 * The single place to update when a build ships. Everything on the download page reads
 * from here, so publishing a release is a URL edit rather than a page rewrite.
 *
 * iOS is the odd one out and always will be: Apple does not allow installing an app from
 * a website, so that entry points at an App Store or TestFlight listing rather than a file.
 */
export const RELEASES: Record<PlatformId, Release> = {
  mac: {
    id: "mac",
    name: "macOS",
    requirement: "macOS 12 Monterey or later",
    url: null,
    note: "Universal build for both Apple Silicon and Intel Macs.",
  },
  windows: {
    id: "windows",
    name: "Windows",
    requirement: "Windows 10 or later, 64-bit",
    url: null,
  },
  android: {
    id: "android",
    name: "Android",
    requirement: "Android 8.0 or later",
    url: null,
    note: "Installing outside the Play Store means allowing installs from your browser when Android asks.",
  },
  ios: {
    id: "ios",
    name: "iPhone & iPad",
    requirement: "iOS 15 or later",
    url: null,
    note: "Apple only allows app installs through the App Store, so this one opens the store listing.",
  },
};

/** Order the cards are shown in when nothing is detected. */
export const PLATFORM_ORDER: PlatformId[] = ["mac", "windows", "android", "ios"];

/**
 * Best guess at the visitor's platform so their download is the one under their thumb.
 * Only ever reorders and highlights: every platform stays reachable, because people
 * routinely download the installer for a different machine than the one they browse on.
 */
export function detectPlatform(): PlatformId | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";

  if (/android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac and is only distinguishable by having a touchscreen.
  if (/iphone|ipod/i.test(ua)) return "ios";
  if (/ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/macintosh|mac os x/i.test(ua)) return "mac";
  if (/windows/i.test(ua)) return "windows";
  return null;
}
