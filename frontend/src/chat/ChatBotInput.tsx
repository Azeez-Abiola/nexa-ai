import React, { useState } from "react";
import { BiPaperPlane } from "react-icons/bi";
import classes from "./chatbot.module.css";

interface ChatBotInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

const ChatBotInput: React.FC<ChatBotInputProps> = ({
  onSendMessage,
  disabled = false
}) => {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={classes.messageListInputForm}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask me anything"
        className={classes.messageListInput}
        disabled={disabled}
      />
      <button
        type="submit"
        className={
          disabled
            ? `${classes.messageListInputButton} ${classes.messageListInputButtonDisabled}`
            : classes.messageListInputButton
        }
        disabled={disabled || !message.trim()}
      >
        <BiPaperPlane />
      </button>
    </form>
  );
};

export default ChatBotInput;
