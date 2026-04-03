import React, { useState, useEffect } from "react";
import styles from "./styles/home.module.css";
import { PrivacyPolicyFooter } from "./components/PrivacyPolicy";
import ChatBot from "./chat/ChatBot";

interface HomeProps {
  onEnter?: () => void;
  user?: { fullName: string; businessUnit: string; email: string } | null;
}

export const Home: React.FC<HomeProps> = ({ onEnter, user }) => {
  const titleText = user ? `Welcome to ${user.businessUnit} GPT` : "Welcome to Nexa AI";
  const bodyText =
    user 
      ? `Your smart assistant for quick, accurate answers to everything you need to know about ${user.businessUnit} documents and guidelines.`
      : "Your smart assistant for quick, accurate answers to everything you need to know about Nexa AI.";

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
        <img src="/logo.png" alt="Nexa AI Logo" style={{ width: "60px", height: "60px", objectFit: "contain" }} />
      </div>

      {/* Avatar and Text Section - Side by side */}
      <div className={styles.mainContent}>
        {/* Avatar Section */}
        <div className={styles.avatarSection}>
          <img 
            src="/avatar-1.png" 
            alt="Avatar" 
            className={styles.centralAvatarImage}
          />
        </div>

        {/* Text and CTA Section */}
        <div className={styles.textSection}>
          <div className={styles.textContent}>
            <h1 className={styles.title}>
              {displayedTitle}
              {stage !== "done" && stage === "title" && (
                <span className={styles.cursor} />
              )}
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
                  Start Chatting
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ChatBot Component */}
      <ChatBot />

      {/* Privacy Policy Footer */}
      <PrivacyPolicyFooter type="user" />
    </div>
  );
};
