import React, { useCallback, useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { BsInfoCircle } from "react-icons/bs";
import axios from "axios";

import classes from "./chatbot.module.css";
import logo from "/1879-22.png";
import Conditional from "../components/Conditional";
import ChatBotInput from "./ChatBotInput";
import { UacnMessage, UserMessage } from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";

interface Message {
  id: string;
  role: "user" | "assistant";
  message: string;
  createdAt: Date | string;
}

const ENQUIRY_TAGS = [
  { label: "General Enquiry", command: "General Enquiry" },
  { label: "Store Locations", command: "Store Locations" },
  { label: "Become a partner", command: "Become a partner" },
  { label: "Investor relations", command: "Investor relations" }
];

const INITIAL_CHAT_DETAILS: Message = {
  id: "initial",
  role: "assistant",
  message:
    "Welcome to the Nexa AI Assistant. Let me know how I can help you today!",
  createdAt: new Date()
};

const ChatBotMessageSection = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [conversationId] = useState(() => {
    const stored = sessionStorage.getItem("ufl_conversation_id");
    if (stored) return stored;
    const newId = `conv_${Date.now()}`;
    sessionStorage.setItem("ufl_conversation_id", newId);
    return newId;
  });

  const messageListContentRef = useRef<HTMLDivElement | null>(null);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = localStorage.getItem(`ufl_chat_${conversationId}`);
        if (stored) {
          setMessages(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };

    if (messages.length === 0) {
      loadHistory();
    }
  }, [conversationId]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(
        `ufl_chat_${conversationId}`,
        JSON.stringify(messages)
      );
    }
  }, [messages, conversationId]);

  // Auto-scroll to bottom - with delay to ensure DOM is rendered
  useEffect(() => {
    const scrollTimer = setTimeout(() => {
      if (messageListContentRef.current) {
        messageListContentRef.current.scrollTop = messageListContentRef.current.scrollHeight;
      }
    }, 0);
    
    return () => clearTimeout(scrollTimer);
  }, [messages, isBotTyping]);

  const onSubmit = useCallback(
    async (message: string) => {
      try {
        const newUserMessage: Message = {
          id: crypto.randomUUID?.() ?? String(Date.now()),
          createdAt: new Date(),
          message,
          role: "user"
        };

        setMessages((prev) => [...prev, newUserMessage]);
        setIsBotTyping(true);

        // Save last chat message for home screen
        localStorage.setItem("ufl_last_chat_message", message);

        // Determine the backend URL dynamically
        const getBackendUrl = () => {
          const isDev = typeof window !== 'undefined' && window.location.hostname === '0.0.0.0';
          return isDev ? '' : '/nexa-ai';
        };

        // Create assistant message placeholder for streaming
        const assistantMessageId = crypto.randomUUID?.() ?? String(Date.now());
        const assistantMessage: Message = {
          id: assistantMessageId,
          createdAt: new Date(),
          role: "assistant",
          message: ""
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Use streaming endpoint for real-time response
        const response = await fetch(`${getBackendUrl()}/api/v1/chat/public/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: messages
              .map((msg) => ({
                role: msg.role,
                content: msg.message
              }))
              .concat({ role: "user", content: message })
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let streamedText = "";

        if (!reader) {
          throw new Error("Response body is not readable");
        }

        // Read stream and accumulate chunks
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

          for (const line of lines) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));

              if (data.type === "chunk") {
                // Accumulate chunks
                streamedText += data.content;

                // Update message with streaming text
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, message: streamedText }
                      : msg
                  )
                );
              } else if (data.type === "context") {
                // Show context info (optional)
                console.log("[Chat] Context:", data.content);
              } else if (data.type === "error") {
                // Handle error
                streamedText = data.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, message: data.content }
                      : msg
                  )
                );
              } else if (data.type === "done") {
                // Stream completed
                console.log("[Chat] Stream completed");
              }
            } catch (e) {
              console.error("[Chat] Error parsing SSE data:", e);
            }
          }
        }
      } catch (error) {
        console.error(error);
        const errorMsg: Message = {
          id: crypto.randomUUID?.() ?? String(Date.now()),
          createdAt: new Date(),
          role: "assistant",
          message: "Something went wrong, please try again!"
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsBotTyping(false);
      }
    },
    [messages]
  );

  return (
    <div className={classes.messageListContainer}>
      <div className={classes.messageListContainerHeader}>
        <div className={classes.messageListContainerHeaderLabel}>
          <img src={logo} alt="ufl logo" className={classes.messageListLogo} />
        </div>
      </div>

      <div className={classes.messageListContent} ref={messageListContentRef}>
        <div className={classes.messageListBanner}>
          <div className={classes.messageListBannerTitle}>
            We are here to assist you. You can also send us an email -
            info@uacngpt.com
          </div>

          <BsInfoCircle className={classes.messageListBannerIcon} />
        </div>

        <UacnMessage message={INITIAL_CHAT_DETAILS} />

        <Conditional isVisible={messages.length === 0 && !isBotTyping}>
          <motion.div
            initial={{ transform: "translateX(100%)" }}
            animate={{ transform: "translateX(0)" }}
            className={classes.messageListEnquiryContainerWrapper}
          >
            <div className={classes.messageListEnquiryContainer}>
              {ENQUIRY_TAGS.map((tag) => (
                <button
                  className={classes.messageListEnquiry}
                  key={tag.label}
                  onClick={() => onSubmit(tag.command)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </motion.div>
        </Conditional>

        {messages.map((message) => (
          <div key={message.id}>
            <Conditional isVisible={message.role === "assistant"}>
              <UacnMessage message={message} />
            </Conditional>

            <Conditional isVisible={message.role !== "assistant"}>
              <UserMessage message={message} />
            </Conditional>
          </div>
        ))}

        <Conditional isVisible={isBotTyping}>
          <TypingIndicator />
        </Conditional>
      </div>

      <div className={classes.messageListInputContainer}>
        <ChatBotInput onSendMessage={onSubmit} disabled={isBotTyping} />
      </div>
    </div>
  );
};

export default ChatBotMessageSection;
