import { BiChevronRight, BiChat } from "react-icons/bi";
import classes from "./chatbot.module.css";

interface LastChatProps {
  onClickLastChat: () => void;
  showBorder?: boolean;
}

const LastChat = ({ onClickLastChat, showBorder = true }: LastChatProps) => {
  const lastMessage = localStorage.getItem("ufl_last_chat_message");

  return (
    <div
      className={`${classes.lastChatContainer} ${
        showBorder ? classes.lastChatContentBordered : ""
      }`}
    >
      <div className={classes.lastChatContent}>
        <div className={classes.lastChatContentIcon}>
          <BiChat size={24} className={classes.lastChatContentIconText} />
        </div>

        <div className={classes.lastChatContentDetails}>
          <p className={classes.lastChatContentTitle}>
            {lastMessage ? "Continue chatting" : "No recent messages"}
          </p>
          <p className={classes.lastChatContentDescription}>
            {lastMessage || "Tap here to start a new conversation"}
          </p>
        </div>

        <button
          onClick={onClickLastChat}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center"
          }}
        >
          <BiChevronRight className={classes.lastChatContentChevron} />
        </button>
      </div>
    </div>
  );
};

export default LastChat;
