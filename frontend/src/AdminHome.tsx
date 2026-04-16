import React, { useState, useEffect } from "react";
import styles from "./styles/home.module.css";
import { PrivacyPolicyFooter } from "./components/PrivacyPolicy";

interface AdminHomeProps {
  onEnter?: () => void;
  admin?: { fullName: string; businessUnit: string; email: string } | null;
}

export const AdminHome: React.FC<AdminHomeProps> = ({ onEnter, admin }) => {
  const titleText = admin ? `Welcome to ${admin.businessUnit} Admin Portal` : "Welcome to Nexa AI Admin Portal";
  const bodyText =
    admin 
      ? `Manage ${admin.businessUnit} knowledge base, documents, and administrator settings from your dashboard.`
      : "Manage your knowledge base, documents, and administrator settings from your dashboard.";

  const [displayedTitle, setDisplayedTitle] = useState("");
  const [displayedBody, setDisplayedBody] = useState("");
  const [stage, setStage] = useState<"title" | "body" | "done">("title");

  const titleSpeed = 45;
  const bodySpeed = 20;
  const pauseBetween = 250;

  // Typing animation for title
  useEffect(() => {
    if (stage !== "title") return;

    if (displayedTitle.length < titleText.length) {
      const timeout = setTimeout(() => {
        setDisplayedTitle(titleText.slice(0, displayedTitle.length + 1));
      }, titleSpeed);

      return () => clearTimeout(timeout);
    } else {
      // Title complete, move to body after pause
      const timeout = setTimeout(() => {
        setStage("body");
      }, pauseBetween);

      return () => clearTimeout(timeout);
    }
  }, [displayedTitle, stage, titleSpeed, pauseBetween, titleText]);

  // Typing animation for body
  useEffect(() => {
    if (stage !== "body") return;

    if (displayedBody.length < bodyText.length) {
      const timeout = setTimeout(() => {
        setDisplayedBody(bodyText.slice(0, displayedBody.length + 1));
      }, bodySpeed);

      return () => clearTimeout(timeout);
    } else {
      // Body complete, move to done stage
      const timeout = setTimeout(() => {
        setStage("done");
      }, pauseBetween);

      return () => clearTimeout(timeout);
    }
  }, [displayedBody, stage, bodySpeed, pauseBetween, bodyText]);

  return (
    <div className={styles.homeContainer}>
      <div className={styles.logoContainer}>
        <img src="/1879-22.png" alt="Nexa AI Logo" style={{ width: "60px", height: "60px", objectFit: "contain" }} />
      </div>

      {/* Avatar and Text Section - Side by side */}
      <div className={styles.mainContent}>
        {/* Avatar Section */}
        <div className={styles.avatarSection}>
          <img 
            src={localStorage.getItem("nexa-avatar") || "/avatar-1.png"} 
            alt="Avatar" 
            className={styles.centralAvatarImage}
          />
        </div>

        {/* Text and CTA Section */}
        <div className={styles.textSection}>
          <div className={styles.textContent}>
            <h1 className={styles.title}>
              <div className="flex items-center gap-4 mb-2">
                <img src="/1879-22.png" alt="1879 Logo" className="w-12 h-12 object-contain" />
                <span>{displayedTitle}</span>
                {stage !== "done" && stage === "title" && (
                  <span className={styles.cursor} />
                )}
              </div>
            </h1>
            {stage !== "title" && (
              <p className={styles.description}>
                {displayedBody}
                {stage === "body" && <span className={styles.cursor} />}
              </p>
            )}
            {stage === "done" && (
              <div className={`${styles.cta} ${styles.revealed}`}>
                <button
                  className={styles.ctaButton}
                  onClick={onEnter}
                >
                  Access Admin Portal
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PrivacyPolicyFooter type="admin" />
    </div>
  );
};
