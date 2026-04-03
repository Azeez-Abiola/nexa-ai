import React from "react";
import { motion } from "framer-motion";
import styles from "./LoginLoadingScreen.module.css";
import logo from "/logo.png";

interface LoginLoadingScreenProps {
  userType?: "user" | "admin";
}

const LoginLoadingScreen: React.FC<LoginLoadingScreenProps> = ({ userType = "user" }) => {
  const containerVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const logoVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1
    }
  };

  const rotatingDotVariants = {
    animate: {
      rotate: 360
    }
  };

  return (
    <motion.div
      className={styles.container}
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className={styles.content}>
        <motion.div 
          className={styles.logoWrapper} 
          variants={logoVariants}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <img 
            src={logo}
            alt="Nexa AI Logo" 
            className={styles.logo}
          />
          
          <motion.div
            className={styles.rotatingDot}
            variants={rotatingDotVariants}
            animate="animate"
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LoginLoadingScreen;
