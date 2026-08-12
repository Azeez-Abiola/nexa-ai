import { useCallback, useEffect, useState } from "react";

/** The install event Chromium fires; not in the DOM lib because it is not standardised. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = {
  /** Chromium has offered an install prompt we can trigger from our own button. */
  canPrompt: boolean;
  /** Already running as an installed app, so there is nothing left to install. */
  isInstalled: boolean;
  /** Safari supports installing but exposes no API for it, so the UI has to explain it by hand. */
  needsManualInstructions: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS uses a non-standard navigator flag rather than the display-mode media query.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return window.matchMedia?.("(display-mode: standalone)").matches || iosStandalone;
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Chrome and Edge both include "Safari" in their UA, so they have to be excluded.
  return /safari/i.test(ua) && !/chrome|chromium|crios|edg|android/i.test(ua);
}

/**
 * Wraps the install flow, which differs by browser more than anything else on the web.
 * Chromium hands us an event we can fire from our own button; Safari has no equivalent and
 * requires the user to go through the share menu, so all we can do there is tell them how.
 */
export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(detectStandalone);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Suppress the browser's own mini-infobar so the page's button is the single
      // obvious way in, rather than competing with a banner.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use: once prompted, Chromium will not let it fire again.
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return {
    canPrompt: Boolean(deferred) && !isInstalled,
    isInstalled,
    needsManualInstructions: !isInstalled && !deferred && isSafari(),
    promptInstall,
  };
}
