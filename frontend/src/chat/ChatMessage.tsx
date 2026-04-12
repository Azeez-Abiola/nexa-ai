import { JSX } from "react";
import { motion } from "framer-motion";
import { getRelativeTime } from "../utils/lib";
import { parseMarkdown } from "../utils/parseMarkdown";

import classes from "./chatbot.module.css";
import logo from "/1879-22.png";

interface Message {
  id: string;
  message: string;
  createdAt: string | number | Date;
}

export const UacnMessage = ({ message }: { message: Message }): JSX.Element => {
  return (
    <motion.div
      key={message.id}
      initial={{ transform: "translateX(-100%)" }}
      animate={{ transform: "translateX(0)" }}
      className={classes.messageListItem}
    >
      <div className={classes.messageListItemIcon}>
        <img src={logo} alt="ufl logo" className={classes.messageListLogo} />
      </div>

      <div className={classes.messageSuperFlex}>
        <div
          className={classes.messageListItemWrapper}
          style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}
        >
          {parseMarkdown(message.message)}
        </div>

        <div className={classes.messageListItemDetails}>
          Assistant - {getRelativeTime(message.createdAt)}
        </div>
      </div>
    </motion.div>
  );
};

export const UserMessage = ({ message }: { message: Message }): JSX.Element => {
  return (
    <motion.div
      key={message.id}
      initial={{ transform: "translateX(100%)" }}
      animate={{ transform: "translateX(0)" }}
      className={classes.messageListUserItem}
    >
      <div
        className={classes.messageListUserItemWrapper}
        style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}
      >
        {message.message}
      </div>

      <div className={classes.messageListUserItemDetails}>
        {getRelativeTime(message.createdAt)}
      </div>
    </motion.div>
  );
};

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  id?: string;
}

export const ChatMessage = ({ role, content, id }: ChatMessageProps): JSX.Element => {
  const message: Message = {
    id: id || `msg-${Date.now()}`,
    message: content,
    createdAt: new Date()
  };

  return role === "user" ? (
    <UserMessage message={message} />
  ) : (
    <UacnMessage message={message} />
  );
};
