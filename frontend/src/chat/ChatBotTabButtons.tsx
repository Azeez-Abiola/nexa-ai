import { BsHouse, BsChat } from "react-icons/bs";
import classes from "./chatbot.module.css";

interface ChatBotTabButtonsProps {
  onChangeTab: (tab: string) => void;
  activeTab: string;
}

const TAB_CATEGORIES = {
  HOME: "home",
  MESSAGES: "messages"
};

const ChatBotTabButtons = ({ onChangeTab, activeTab }: ChatBotTabButtonsProps) => {
  return (
    <div className={classes.chatbotTabButtonsContainer}>
      <button
        className={classes.chatbotTabButtonsItem}
        onClick={() => onChangeTab(TAB_CATEGORIES.HOME)}
      >
        <BsHouse className={classes.chatbotTabButtonsIcon} />
        <p className={classes.chatbotTabButtonsLabel}>Home</p>
      </button>

      <button
        className={classes.chatbotTabButtonsItem}
        onClick={() => onChangeTab(TAB_CATEGORIES.MESSAGES)}
      >
        <BsChat className={classes.chatbotTabButtonsIcon} />
        <p className={classes.chatbotTabButtonsLabel}>Messages</p>
      </button>
    </div>
  );
};

export default ChatBotTabButtons;
