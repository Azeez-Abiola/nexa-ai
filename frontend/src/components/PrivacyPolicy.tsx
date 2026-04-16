import React, { useState } from "react";
import { FiX } from "react-icons/fi";
import styles from "./PrivacyPolicy.module.css";

interface PrivacyPolicyProps {
  isOpen?: boolean;
  onClose?: () => void;
  type?: "user" | "admin";
  /** Light panel for login / marketing; default dark (admin). */
  variant?: "dark" | "light";
}

const userPolicyContent = (
  <>
    <section className={styles.section}>
      <h3>1. What We Collect</h3>
      <p>
        When you use Nexa AI, we collect:
      </p>
      <ul>
        <li>Your account information (name, email, business unit)</li>
        <li>Your conversations and queries with the chatbot</li>
        <li>Usage patterns and interaction history</li>
      </ul>
    </section>

    <section className={styles.section}>
      <h3>2. How We Use Your Data</h3>
      <p>
        Your data is used to:
      </p>
      <ul>
        <li>Provide you with accurate information from company documents</li>
        <li>Improve the AI assistant's responses</li>
        <li>Maintain security and prevent misuse</li>
        <li>Comply with legal and regulatory requirements</li>
      </ul>
    </section>

    <section className={styles.section}>
      <h3>3. AI Disclaimer</h3>
      <p>
        Nexa AI uses artificial intelligence to answer your questions. Please note:
      </p>
      <ul>
        <li>AI responses may not be 100% accurate - always verify important information</li>
        <li>The system learns from company documents but has knowledge limitations</li>
        <li>For critical decisions, contact HR, Management, or relevant departments</li>
        <li>Do not rely solely on AI responses for policy interpretation</li>
      </ul>
    </section>

    <section className={styles.section}>
      <h3>4. Your Data Rights</h3>
      <p>You have the right to:</p>
      <ul>
        <li>Access your personal data</li>
        <li>Request data deletion (subject to legal requirements)</li>
        <li>Request a copy of your conversation history</li>
        <li>Contact us with privacy concerns</li>
      </ul>
    </section>

    <section className={styles.section}>
      <h3>5. Data Security</h3>
      <p>
        Your data is protected with:
      </p>
      <ul>
        <li>Encryption in transit and at rest</li>
        <li>Secure access controls</li>
        <li>Regular security audits</li>
        <li>Compliance with data protection regulations</li>
      </ul>
    </section>

    <section className={styles.section}>
      <h3>6. Contact Us</h3>
      <p>
        For privacy questions or concerns, please contact the IT or HR department.
        We're committed to protecting your personal information.
      </p>
    </section>
  </>
);

const adminPolicyContent = (
  <>
    <section className={styles.section}>
      <h3>1. Data Handling & Security</h3>
      <p>
        All user data and uploaded documents are handled with the highest level of security and confidentiality. 
        Your information is:
      </p>
      <ul>
        <li>Encrypted in transit and at rest</li>
        <li>Stored securely in our GDPR-compliant servers</li>
        <li>Never shared with third parties without your explicit consent</li>
        <li>Accessible only to authorized team members for operational purposes</li>
      </ul>
    </section>

    <section className={styles.section}>
      <h3>2. Use of Uploaded Documents</h3>
      <p>
        When you upload documents to Nexa AI, they are processed for the following purposes:
      </p>
      <ul>
        <li>Indexing and searching within your organization's knowledge base</li>
        <li>Enabling AI-powered responses to employee queries</li>
        <li>Improving system accuracy and relevance over time</li>
        <li>Compliance and audit trail maintenance</li>
      </ul>
      <p className={styles.emphasis}>
        Documents are stored within your organization's instance and are not used to train
        public or third-party AI models.
      </p>
    </section>

    <section className={styles.section}>
      <h3>3. AI & Artificial Intelligence Disclaimer</h3>
      <p>
        Nexa AI utilizes advanced AI technology to provide intelligent responses to user queries.
        Please be aware:
      </p>
      <ul>
        <li>
          AI responses are generated based on your uploaded documents and may not be 100% accurate
        </li>
        <li>Always verify critical information with official company sources</li>
        <li>AI models have knowledge cutoff dates and may not reflect recent policy updates</li>
        <li>Users are responsible for ensuring their queries return contextually relevant information</li>
        <li>
          The AI system is designed to assist but does not replace official HR, Legal, or Management decisions
        </li>
      </ul>
    </section>

    <section className={styles.section}>
      <h3>4. User Rights</h3>
      <p>As a user of Nexa AI, you have the right to:</p>
      <ul>
        <li>Access your personal data stored in the system</li>
        <li>Request deletion of personal information (subject to legal requirements)</li>
        <li>Opt-out of data collection for improvement purposes</li>
        <li>Request a copy of all data associated with your account</li>
      </ul>
    </section>

    <section className={styles.section}>
      <h3>5. Data Retention</h3>
      <p>
        Uploaded documents and conversation histories are retained for as long as your account is active.
        Upon account deletion, all associated data will be securely deleted within 30 days, unless
        retention is required by legal or compliance obligations.
      </p>
    </section>

    <section className={styles.section}>
      <h3>6. Questions or Concerns</h3>
      <p>
        If you have any questions about our data handling practices or privacy policy, please contact
        the IT or HR department. Your privacy and data security are our top priorities.
      </p>
    </section>
  </>
);

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({
  isOpen = false,
  onClose,
  type = "user",
  variant = "dark"
}) => {
  const [open, setOpen] = useState(isOpen);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleOpen = () => {
    setOpen(true);
  };

  if (!open) {
    return (
      <button className={styles.privacyLink} onClick={handleOpen}>
        Privacy Policy
      </button>
    );
  }

  return (
    <div
      className={`${styles.modalBackdrop} ${variant === "light" ? styles.modalBackdropLight : ""}`}
      onClick={handleClose}
    >
      <div
        className={`${styles.modal} ${variant === "light" ? styles.modalLight : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {type === "admin" ? "Data Information Policy & Privacy Notice" : "Privacy Policy"}
          </h2>
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className={styles.modalContent}>
          {type === "admin" ? adminPolicyContent : userPolicyContent}
          <p className={styles.footer}>
            <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.closeActionBtn} onClick={handleClose}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export const PrivacyPolicyFooter: React.FC<{ type?: "user" | "admin" }> = ({ type = "user" }) => {
  const [showPolicy, setShowPolicy] = useState(false);

  return (
    <>
      <footer className={styles.footer_}>
        <div className={styles.footerContent}>
          <p className={styles.copyright}>© {new Date().getFullYear()} Nexa AI. All rights reserved.</p>
          <div className={styles.poweredBy1879}>
            <img src="/1879-22.png" alt="" width={14} height={14} className={styles.poweredBy1879Logo} />
            <span>Powered by 1879 Tech Hub</span>
          </div>
        </div>
      </footer>
      {showPolicy && (
        <PrivacyPolicy isOpen={showPolicy} onClose={() => setShowPolicy(false)} type={type} />
      )}
    </>
  );
};
