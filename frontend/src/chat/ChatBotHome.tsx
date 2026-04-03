import { BiPaperPlane } from "react-icons/bi";
import classes from "./chatbot.module.css";
import logo from "/logo.png";
import LastChat from "./LastChat";

const ChatBotHome = ({ onChangeTab }: { onChangeTab: (tab: string) => void }) => {
  return (
    <div className={classes.chatbotHome}>
      <img src={logo} alt="ufl logo" className={classes.messageListLogo} />

      <h2
        className={classes.chatbotHomeTitle}
        style={{ fontWeight: 600, color: "white", fontSize: "1.5rem" }}
      >
        Hello{" "}
        <span style={{ color: "#ED0000" }}>
          there
        </span>
        , <br /> How can I help?
      </h2>

      <div className={classes.chatbotRecentMessage}>
        <h3 className={classes.chatbotRecentMessageTitle}>Recent message</h3>

        <LastChat
          onClickLastChat={() => onChangeTab("messages")}
          showBorder={false}
        />
      </div>

      <button
        className={classes.chatbotSendMessage}
        onClick={() => onChangeTab("messages")}
      >
        <div className={classes.chatbotSendMessageText}>Send a message</div>

        <BiPaperPlane className={classes.chatbotSendMessageIcon} />
      </button>
    </div>
  );
};

export default ChatBotHome;
