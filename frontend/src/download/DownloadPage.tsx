import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BiDownload } from "react-icons/bi";
import { FaApple, FaWindows, FaAndroid } from "react-icons/fa";
import { MdPhoneIphone } from "react-icons/md";
import { RELEASES, PLATFORM_ORDER, detectPlatform, type PlatformId, type Release } from "./releases";
import styles from "./download.module.css";

const ICONS: Record<PlatformId, JSX.Element> = {
  mac: <FaApple size={30} />,
  windows: <FaWindows size={28} />,
  android: <FaAndroid size={29} />,
  ios: <MdPhoneIphone size={30} />,
};

function PlatformCard({ release, detected }: { release: Release; detected: boolean }) {
  const isStoreLink = release.id === "ios";
  const label = isStoreLink ? "Get it on the App Store" : `Download for ${release.name}`;

  return (
    <div className={`${styles.card} ${detected ? styles.cardDetected : ""}`}>
      <span className={styles.cardIcon}>{ICONS[release.id]}</span>
      <h2 className={styles.cardName}>
        {release.name}
        {detected ? <span className={styles.detectedTag}>Your device</span> : null}
      </h2>
      <p className={styles.requirement}>{release.requirement}</p>
      {release.note ? <p className={styles.note}>{release.note}</p> : null}

      {release.url ? (
        <>
          {release.version || release.size ? (
            <span className={styles.meta}>
              {[release.version, release.size].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          <a
            className={styles.button}
            href={release.url}
            // Store links leave the site; direct downloads should not open a blank tab.
            {...(isStoreLink
              ? { target: "_blank", rel: "noopener noreferrer" }
              : { download: true })}
          >
            <BiDownload size={18} />
            {label}
          </a>
        </>
      ) : (
        // Deliberately not a dead link. A button that does nothing when clicked is worse
        // than one that plainly says the build is not ready.
        <span className={styles.buttonDisabled}>Coming soon</span>
      )}
    </div>
  );
}

export default function DownloadPage() {
  const detected = useMemo(detectPlatform, []);

  // Put the visitor's own platform first, keeping the rest in their usual order. Everyone
  // still sees every option, since people often download for a different machine.
  const ordered = useMemo(() => {
    if (!detected) return PLATFORM_ORDER;
    return [detected, ...PLATFORM_ORDER.filter((id) => id !== detected)];
  }, [detected]);

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <img src="/avatar-1.png" alt="" className={styles.brandMark} />
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
          The same assistant, your conversations in sync, wherever you are. Pick your platform to
          get started.
        </p>
      </header>

      <main className={styles.grid}>
        {ordered.map((id) => (
          <PlatformCard key={id} release={RELEASES[id]} detected={id === detected} />
        ))}
      </main>

      <footer className={styles.footnote}>
        Nexa also runs in any modern browser with nothing to install, at{" "}
        <Link to="/user-chat">nexa in your browser</Link>. You will need your work account to sign
        in on any device.
      </footer>
    </div>
  );
}
