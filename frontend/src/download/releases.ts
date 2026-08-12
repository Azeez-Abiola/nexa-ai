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
  /**
   * How to install the web app on this platform. Shown whenever there is no native build,
   * which today is everywhere: Nexa installs as a PWA, and the steps genuinely differ per
   * browser, so there is no single instruction that would be correct for everyone.
   */
  install: string[];
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
    install: [
      "Open nexa in Chrome or Edge.",
      "Click the install icon in the address bar, or the browser menu, then Install Nexa.",
      "In Safari 17 or later, use File then Add to Dock.",
    ],
  },
  windows: {
    id: "windows",
    name: "Windows",
    requirement: "Windows 10 or later, 64-bit",
    url: null,
    install: [
      "Open nexa in Chrome or Edge.",
      "Click the install icon in the address bar, or the browser menu, then Install Nexa.",
      "It appears in the Start menu and can be pinned to the taskbar.",
    ],
  },
  android: {
    id: "android",
    name: "Android",
    requirement: "Android 8.0 or later",
    url: null,
    install: [
      "Open nexa in Chrome.",
      "Tap the menu, then Add to Home screen or Install app.",
      "Nexa then opens full screen, like any other app.",
    ],
  },
  ios: {
    id: "ios",
    name: "iPhone & iPad",
    requirement: "iOS 15 or later",
    url: null,
    note: "Safari is required. Chrome on iPhone cannot install web apps, which is Apple's restriction rather than ours.",
    install: [
      "Open nexa in Safari.",
      "Tap the Share button, then Add to Home Screen.",
      "Tap Add, and Nexa appears alongside your other apps.",
    ],
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
