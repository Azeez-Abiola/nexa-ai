import React, { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import styles from "./chatbot.module.css";

interface Message {
  role: "user" | "assistant";
  content: string;
  id?: string;
}

interface ChatBotMessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export const ChatBotMessageList: React.FC<ChatBotMessageListProps> = ({
  messages,
  isLoading = false
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2>Welcome to Nexa AI</h2>
        <p>Ask me about company documents, policies, procedures, and guidelines.</p>
        <div className={styles.suggestedQuestions}>
          <p className={styles.suggestedLabel}>Try asking about:</p>
          <ul>
            <li>Work hours and flexible arrangements</li>
            <li>Leave policies and vacation benefits</li>
            <li>HSE and safety procedures</li>
            <li>Code of conduct and compliance</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatBotMessageList}>
      {messages.map((msg, idx) => (
        <ChatMessage
          key={msg.id || `msg-${idx}`}
          role={msg.role}
          content={msg.content}
        />
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
};
