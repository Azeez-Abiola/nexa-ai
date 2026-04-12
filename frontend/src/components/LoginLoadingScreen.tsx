import React from "react";
import styles from "./LoginLoadingScreen.module.css";

interface LoginLoadingScreenProps {
  userType?: "user" | "admin";
}

const LoginLoadingScreen: React.FC<LoginLoadingScreenProps> = ({ userType = "user" }) => {
  return (
    <div className={styles.container}>
      {/* Sidebar skeleton */}
      <div className={styles.sidebarSkeleton}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoPlaceholder}>
            <div className={styles.logoCircle} />
            <div className={styles.logoBar} />
          </div>
        </div>
        <div className={styles.newChatBtn}>
          <div className={styles.shimmerBar} style={{ width: '100%', height: 44, borderRadius: 12 }} />
        </div>
        <div className={styles.sidebarItems}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className={styles.sidebarItem}>
              <div className={styles.shimmerBar} style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0 }} />
              <div className={styles.shimmerBar} style={{ width: `${60 + Math.random() * 30}%`, height: 14, borderRadius: 8 }} />
            </div>
          ))}
        </div>
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarItem}>
            <div className={styles.shimmerCircle} />
            <div style={{ flex: 1 }}>
              <div className={styles.shimmerBar} style={{ width: '70%', height: 12, borderRadius: 6, marginBottom: 6 }} />
              <div className={styles.shimmerBar} style={{ width: '50%', height: 10, borderRadius: 6 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className={styles.mainSkeleton}>
        {/* Header */}
        <div className={styles.mainHeader}>
          <div className={styles.shimmerBar} style={{ width: 120, height: 20, borderRadius: 8 }} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className={styles.shimmerBar} style={{ width: 100, height: 32, borderRadius: 8 }} />
            <div className={styles.shimmerCircle} />
          </div>
        </div>

        {/* Chat content area */}
        <div className={styles.mainContent}>
          <div className={styles.chatArea}>
            {/* Greeting skeleton */}
            <div className={styles.greetingBlock}>
              <div className={styles.shimmerBar} style={{ width: 280, height: 32, borderRadius: 10, marginBottom: 12 }} />
              <div className={styles.shimmerBar} style={{ width: 200, height: 16, borderRadius: 8 }} />
            </div>

            {/* Suggestion cards skeleton */}
            <div className={styles.suggestionGrid}>
              {[1,2,3,4].map(i => (
                <div key={i} className={styles.suggestionCard}>
                  <div className={styles.shimmerBar} style={{ width: '80%', height: 14, borderRadius: 6, marginBottom: 10 }} />
                  <div className={styles.shimmerBar} style={{ width: '60%', height: 11, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Input field skeleton */}
          <div className={styles.inputSkeleton}>
            <div className={styles.shimmerBar} style={{ width: '100%', height: 52, borderRadius: 16 }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginLoadingScreen;
