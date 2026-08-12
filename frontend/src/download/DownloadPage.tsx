import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BiDownload, BiCheckCircle } from "react-icons/bi";
import { FaApple, FaWindows, FaAndroid } from "react-icons/fa";
import { MdPhoneIphone } from "react-icons/md";
import { RELEASES, PLATFORM_ORDER, detectPlatform, type PlatformId, type Release } from "./releases";
import { useInstallPrompt } from "./useInstallPrompt";
import styles from "./download.module.css";

const ICONS: Record<PlatformId, JSX.Element> = {
  mac: <FaApple size={30} />,
  windows: <FaWindows size={28} />,
  android: <FaAndroid size={29} />,
  ios: <MdPhoneIphone size={30} />,
};

function PlatformCard({
  release,
  detected,
  canPrompt,
  onInstall,
}: {
  release: Release;
  detected: boolean;
  canPrompt: boolean;
  onInstall: () => void;
}) {
  return (
    <div className={`${styles.card} ${detected ? styles.cardDetected : ""}`}>
      <span className={styles.cardIcon}>{ICONS[release.id]}</span>
      <h2 className={styles.cardName}>
        {release.name}
        {detected ? <span className={styles.detectedTag}>Your device</span> : null}
      </h2>
      <p className={styles.requirement}>{release.requirement}</p>

      {release.url ? (
        <>
          {release.version || release.size ? (
            <span className={styles.meta}>{[release.version, release.size].filter(Boolean).join(" · ")}</span>
          ) : null}
          <a className={styles.button} href={release.url} download>
            <BiDownload size={18} />
            Download for {release.name}
          </a>
        </>
      ) : (
        <>
          <ol className={styles.steps}>
            {release.install.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {release.note ? <p className={styles.note}>{release.note}</p> : null}
          {/* Only the visitor's own platform can be installed from here, and only where the
              browser actually offers it. Showing the button elsewhere would promise something
              that cannot work on the machine they are reading this on. */}
          {detected && canPrompt ? (
            <button type="button" className={styles.button} onClick={onInstall}>
              <BiDownload size={18} />
              Install Nexa
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function DownloadPage() {
  const detected = useMemo(detectPlatform, []);
  const { canPrompt, isInstalled, promptInstall } = useInstallPrompt();

  // The visitor's own platform goes first, but everything stays visible, since people
  // regularly set up a different device from the one they are browsing on.
  const ordered = useMemo(() => {
    if (!detected) return PLATFORM_ORDER;
    return [detected, ...PLATFORM_ORDER.filter((id) => id !== detected)];
  }, [detected]);

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <img src="/icons/icon-192.png" alt="" className={styles.brandMark} />
          Nexa
        </Link>
        <Link to="/user-chat" className={styles.navLink}>
          Open in browser
        </Link>
      </nav>

      <header className={styles.hero}>
        <img src="/avatar-1.png" alt="Nexa" className={styles.heroAvatar} />
        <h1 className={styles.title}>Get Nexa on every device</h1>
        <p className={styles.subtitle}>
          Install Nexa on your Mac, PC, or phone and it opens like any other app, in its own
          window, with your conversations already there. Nothing to download from a store.
        </p>

        {isInstalled ? (
          <p className={styles.installed}>
            <BiCheckCircle size={18} />
            Nexa is installed on this device
          </p>
        ) : canPrompt ? (
          <button type="button" className={styles.heroButton} onClick={() => void promptInstall()}>
            <BiDownload size={19} />
            Install Nexa
          </button>
        ) : null}
      </header>

      <main className={styles.grid}>
        {ordered.map((id) => (
          <PlatformCard
            key={id}
            release={RELEASES[id]}
            detected={id === detected}
            canPrompt={canPrompt}
            onInstall={() => void promptInstall()}
          />
        ))}
      </main>

      <footer className={styles.footnote}>
        Nexa also runs in any modern browser with nothing installed, at{" "}
        <Link to="/user-chat">nexa in your browser</Link>. Installing simply gives it its own
        window and icon. You will need your work account to sign in on any device.
      </footer>
    </div>
  );
}
