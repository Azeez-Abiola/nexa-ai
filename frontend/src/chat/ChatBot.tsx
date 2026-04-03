import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BiChevronDown } from "react-icons/bi";
import { BsChatDots } from "react-icons/bs";

import Conditional from "../components/Conditional";
import classes from "./chatbot.module.css";

import { ChatBotMessageSection, ChatBotTabButtons } from ".";
import ChatBotHome from "./ChatBotHome";
import Portal from "../components/Portal";

const TAB_CATEGORIES = {
  HOME: "home",
  MESSAGES: "messages"
};

const ChatBot = () => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_CATEGORIES.HOME);

  return (
    <div className={classes.chatbotContainer}>
      <AnimatePresence>
        {isModalOpen && (
          <Portal>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={classes.chatbotOverlay}
              onClick={() => setModalOpen(false)}
            />

            <motion.div
              key="content"
              initial={{ y: 80, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={classes.chatbotContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={classes.chatbotContentMain}>
                <Conditional isVisible={activeTab === TAB_CATEGORIES.HOME}>
                  <ChatBotHome onChangeTab={setActiveTab} />
                </Conditional>

                <Conditional isVisible={activeTab === TAB_CATEGORIES.MESSAGES}>
                  <ChatBotMessageSection />
                </Conditional>
              </div>

              <ChatBotTabButtons onChangeTab={setActiveTab} activeTab={activeTab} />
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      <Conditional isVisible={!isModalOpen}>
        <div
          className={classes.chatbotButtonContainer}
          style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 1000 }}
        >
          <motion.button
            className={classes.chatbotButton}
            initial={{ scale: 0 }}
            whileTap={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            onClick={() => setModalOpen((previous) => !previous)}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            title="Chat with us"
          >
            <BsChatDots className={classes.chatbotButtonText} />
          </motion.button>
        </div>
      </Conditional>
    </div>
  );
};

export default ChatBot;
