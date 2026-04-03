import React, { useState, useEffect } from "react";
import axios from "axios";
import { BiPaperPlane } from "react-icons/bi";
import { Admin } from "./Admin";
import { Login } from "./Login";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Conversation {
  _id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

type View = "chat" | "admin";

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("chat");

  // Initialize auth from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
      
      // Set axios default header
      axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
      
      // Load conversations
      loadConversations(savedToken);
    }
  }, []);

  const loadConversations = async (authToken: string) => {
    try {
      const { data } = await axios.get<{ conversations: Conversation[] }>(
        "/api/v1/conversations",
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setConversations(data.conversations);
      
      if (data.conversations.length > 0) {
        setCurrentConversation(data.conversations[0]);
      }
    } catch (error) {
      console.error("Load conversations error:", error);
    }
  };

  const handleLogin = async (authToken: string, authUser: User) => {
    setToken(authToken);
    setUser(authUser);
    setIsAuthenticated(true);
    axios.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
    await loadConversations(authToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
    setConversations([]);
    setCurrentConversation(null);
    delete axios.defaults.headers.common["Authorization"];
  };

  const handleNewChat = async () => {
    if (!token) return;

    try {
      const { data } = await axios.post<{ conversation: Conversation }>(
        "/api/v1/conversations",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setConversations([data.conversation, ...conversations]);
      setCurrentConversation(data.conversation);
      setInput("");
    } catch (error) {
      console.error("Create conversation error:", error);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !currentConversation || !token) return;

    setInput("");
    setLoading(true);

    try {
      const { data } = await axios.post<{
        userMessage: Message;
        assistantMessage: Message;
        conversation: Conversation;
      }>(
        `/api/v1/conversations/${currentConversation._id}/message`,
        { content: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCurrentConversation(data.conversation);
      setConversations(
        conversations.map((c) =>
          c._id === data.conversation._id ? data.conversation : c
        )
      );
    } catch (error) {
      console.error("Send message error:", error);
      alert("Error sending message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="ufl-root">
      <aside className="sidebar">
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={handleNewChat}>
            + New chat
          </button>
        </div>

        <div className="sidebar-conversations">
          <div className="sidebar-conversations-label">Conversations</div>
          {conversations.length === 0 ? (
            <div className="sidebar-empty">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv._id}
                className={`sidebar-conversation ${
                  currentConversation?._id === conv._id ? "active" : ""
                }`}
                onClick={() => setCurrentConversation(conv)}
              >
                <div className="conv-title">{conv.title}</div>
                <div className="conv-date">
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
          <div className="brand">
            <div className="brand-logo">U</div>
            <div className="brand-text">
              <span className="brand-name">Nexa AI</span>
              <span className="brand-sub">Internal assistant</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="chat-layout">
        <header className="chat-header">
          <div className="chat-header-left">
            <div className="chat-title">Nexa AI</div>
            <div className="chat-subtitle">
              {view === "chat"
                ? "Ask anything about UFL documents and guidelines"
                : "Admin · Manage documents and knowledge base"}
            </div>
          </div>
          <div className="chat-header-right">
            <button
              className={`header-tab ${view === "chat" ? "active" : ""}`}
              onClick={() => setView("chat")}
            >
              Chat
            </button>
            <button
              className={`header-tab ${view === "admin" ? "active" : ""}`}
              onClick={() => setView("admin")}
            >
              Admin
            </button>
          </div>
        </header>

        {view === "chat" ? (
          <>
            <section className="chat-messages">
              {currentConversation?.messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`message-row ${
                    m.role === "assistant" ? "assistant" : "user"
                  }`}
                >
                  <div className="avatar">
                    {m.role === "assistant" ? (
                      <span className="avatar-assistant">U</span>
                    ) : (
                      <span className="avatar-user">Y</span>
                    )}
                  </div>
                  <div className="bubble">
                    {m.content.split("\n").map((line, lineIdx) => (
                      <p key={lineIdx}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="message-row assistant">
                  <div className="avatar">
                    <span className="avatar-assistant">U</span>
                  </div>
                  <div className="bubble typing">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              )}
            </section>

            <footer className="chat-input-wrapper">
              <div className="chat-input-inner">
                <textarea
                  rows={1}
                  className="chat-input"
                  placeholder="Send a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="send-btn"
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                >
                  <BiPaperPlane size={20} />
                </button>
              </div>
              <div className="chat-hint">
                Nexa AI may not always be accurate. Verify critical information
                with HR or Compliance.
              </div>
            </footer>
          </>
        ) : (
          <section className="admin-wrapper">
            <Admin />
          </section>
        )}
      </main>

      <style>{`
        .sidebar-conversations {
          flex: 1;
          overflow-y: auto;
          padding: 10px 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .sidebar-conversations-label {
          font-size: 12px;
          font-weight: 600;
          color: #999;
          padding: 10px 12px;
          text-transform: uppercase;
        }

        .sidebar-empty {
          padding: 20px 12px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }

        .sidebar-conversation {
          padding: 12px;
          margin: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .sidebar-conversation:hover {
          background: #f5f5f5;
        }

        .sidebar-conversation.active {
          background: #e8e8ff;
        }

        .conv-title {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conv-date {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }

        .user-info {
          margin-bottom: 12px;
          padding: 0 0 12px 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .user-name {
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .user-email {
          font-size: 12px;
          color: #999;
          margin-top: 2px;
        }

        .logout-btn {
          width: 100%;
          padding: 10px;
          background: #d92322;
          border: 2px solid #ffffff;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: #ffffff;
          margin-bottom: 12px;
          transition: opacity 0.2s;
        }

        .logout-btn:hover {
          opacity: 0.9;
        }

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .sidebar-conversations {
            max-height: 150px;
          }

          .sidebar-conversation {
            padding: 10px;
            margin: 2px 6px;
          }

          .conv-title {
            font-size: 13px;
          }

          .conv-date {
            font-size: 11px;
          }

          .logout-btn {
            padding: 8px;
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .sidebar-conversations {
            max-height: 120px;
          }

          .sidebar-conversations-label {
            font-size: 11px;
            padding: 8px 10px;
          }

          .sidebar-conversation {
            padding: 8px;
            margin: 2px 4px;
          }

          .conv-title {
            font-size: 12px;
          }

          .conv-date {
            display: none;
          }

          .user-info {
            padding: 0;
            margin-bottom: 8px;
            border: none;
          }

          .user-name {
            font-size: 13px;
          }

          .user-email {
            font-size: 11px;
          }

          .logout-btn {
            padding: 6px;
            font-size: 11px;
            margin-bottom: 8px;
          }
        }
      `}</style>
    </div>
  );
};
