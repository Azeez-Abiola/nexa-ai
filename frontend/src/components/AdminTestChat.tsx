import React, { useState, useRef, useEffect, useCallback } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AdminTestChatProps {
  adminToken: string;
  businessUnit: string;
  theme: "dark" | "light";
}

const AdminTestChat: React.FC<AdminTestChatProps> = ({ adminToken, businessUnit, theme }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDark = theme === "dark";

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  const initConversation = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const data = await res.json();
      return data.conversation._id;
    } catch (err: any) {
      setError(err.message || "Could not start a conversation.");
      return null;
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setError(null);
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: trimmed, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setStreamingText("");

    try {
      let convId = conversationId;
      if (!convId) {
        convId = await initConversation();
        if (!convId) { setLoading(false); return; }
        setConversationId(convId);
      }

      const apiBase = (import.meta as any).env?.VITE_API_URL || "";
      const response = await fetch(`${apiBase}/api/v1/conversations/${convId}/message-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ content: trimmed, model: "gpt" }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              // Final conversation object — extract assistant message
              const finalConv = data.conversation;
              const lastMsg = finalConv?.messages?.[finalConv.messages.length - 1];
              if (lastMsg?.role === "assistant") {
                full = lastMsg.content;
              }
            } else if (data.fullResponse !== undefined) {
              full = data.fullResponse;
              setStreamingText(full);
            } else if (data.status) {
              setStreamingText(`⏳ ${data.status}`);
            }
          } catch { /* skip malformed */ }
        }
        buffer = lines[lines.length - 1];
      }

      reader.releaseLock();
      setStreamingText("");
      if (full) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: full, timestamp: new Date() },
        ]);
      }
    } catch (err: any) {
      setStreamingText("");
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    setConversationId(null);
    setStreamingText("");
    setError(null);
    // Start a new conversation on next send
  };

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const bg = isDark ? "#0f0f0f" : "#f9fafb";
  const cardBg = isDark ? "rgba(255,255,255,0.05)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb";
  const textColor = isDark ? "#f3f4f6" : "#111827";
  const subText = isDark ? "#9ca3af" : "#6b7280";
  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6";
  const userBubbleBg = isDark ? "#27272a" : "#18181b";
  const aiBubbleBg = isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, background: bg, borderRadius: 12, overflow: "hidden", border: `1px solid ${border}` }}>
      {/* Header bar */}
      <div style={{
        padding: "14px 20px",
        background: isDark ? "rgba(237,0,0,0.08)" : "rgba(237,0,0,0.04)",
        borderBottom: `1px solid ${isDark ? "rgba(237,0,0,0.2)" : "rgba(237,0,0,0.12)"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#fff" : "#111" }}>
              Test Nexa AI
            </div>
            <div style={{ fontSize: 11, color: subText }}>
              Scoped to <strong style={{ color: "#ed0000" }}>{businessUnit}</strong> · Admin session
            </div>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          disabled={messages.length === 0 && !conversationId}
          style={{
            fontSize: 12, fontWeight: 600, color: subText, background: "transparent",
            border: `1px solid ${border}`, borderRadius: 6, padding: "4px 10px",
            cursor: "pointer", opacity: messages.length === 0 ? 0.4 : 1, transition: "opacity 0.2s"
          }}
        >
          Clear chat
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && !streamingText && (
          <div style={{ textAlign: "center", padding: "40px 0", color: subText }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: textColor }}>Ask Nexa anything</div>
            <div style={{ fontSize: 12 }}>
              Test how the AI responds to your employees' questions.<br />
              Uses your <strong>{businessUnit}</strong> knowledge base.
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <div key={idx} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
              {!isUser && (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#ed0000",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0
                }}>N</div>
              )}
              <div style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: isUser ? userBubbleBg : aiBubbleBg,
                color: isUser ? "#fff" : textColor,
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                boxShadow: isUser ? "0 2px 8px rgba(237,0,0,0.25)" : "none"
              }}>
                {msg.content}
              </div>
              {isUser && (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: textColor, fontWeight: 700, flexShrink: 0
                }}>A</div>
              )}
            </div>
          );
        })}

        {/* Streaming response */}
        {(loading || streamingText) && (
          <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-end", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: "#ed0000",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0
            }}>N</div>
            <div style={{
              maxWidth: "75%", padding: "10px 14px",
              borderRadius: "16px 16px 16px 4px",
              background: aiBubbleBg, color: textColor, fontSize: 13, lineHeight: 1.6
            }}>
              {streamingText || (
                <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ed0000", animation: "pulse 1s ease-in-out infinite" }} />
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ed0000", animation: "pulse 1s ease-in-out 0.2s infinite" }} />
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ed0000", animation: "pulse 1s ease-in-out 0.4s infinite" }} />
                  <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 12
          }}>
            ⚠️ {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: "12px 16px", borderTop: `1px solid ${border}`,
        background: cardBg, display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); autoGrow(e.target); }}
          onKeyDown={handleKeyDown}
          placeholder={`Ask a question as an employee of ${businessUnit}…`}
          disabled={loading}
          rows={1}
          style={{
            flex: 1, resize: "none", borderRadius: 10, padding: "10px 14px",
            background: inputBg, border: `1px solid ${border}`,
            color: textColor, fontSize: 13, fontFamily: "inherit",
            outline: "none", lineHeight: 1.5, maxHeight: 160,
            overflowY: "auto", transition: "border-color 0.2s",
            opacity: loading ? 0.6 : 1
          }}
          onFocus={(e) => (e.target.style.borderColor = "#ed0000")}
          onBlur={(e) => (e.target.style.borderColor = border)}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            padding: "10px 18px", borderRadius: 10,
            background: "linear-gradient(135deg, #ed0000, #c41e3a)",
            color: "#fff", border: "none", fontSize: 13, fontWeight: 700,
            cursor: (!input.trim() || loading) ? "not-allowed" : "pointer",
            opacity: (!input.trim() || loading) ? 0.5 : 1,
            transition: "opacity 0.2s, transform 0.15s",
            flexShrink: 0, height: 40
          }}
          onMouseEnter={(e) => { if (!loading && input.trim()) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default AdminTestChat;
