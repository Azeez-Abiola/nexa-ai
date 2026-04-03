import React from "react";
import { motion } from "framer-motion";
import styles from "./chatbot.module.css";

const TypingIndicator: React.FC = () => {
  const containerVariants = {
    start: { opacity: 1 },
    end: { opacity: 1 }
  };

  const dotVariants = {
    start: { y: 0, opacity: 0.6 },
    end: { y: -10, opacity: 1 }
  };

  return (
    <motion.div
      className={styles.typingIndicator}
      variants={containerVariants}
      initial="start"
      animate="end"
    >
      <motion.span
        variants={dotVariants}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
      />
      <motion.span
        variants={dotVariants}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          repeatType: "reverse",
          delay: 0.2
        }}
      />
      <motion.span
        variants={dotVariants}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          repeatType: "reverse",
          delay: 0.4
        }}
      />
    </motion.div>
  );
};

export default TypingIndicator;
