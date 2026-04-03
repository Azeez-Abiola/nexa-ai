import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { BiPaperPlane, BiPencil } from "react-icons/bi";
import { MdPushPin } from "react-icons/md";
import { FiLogOut, FiDownload, FiTrash2 } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import { Admin } from "./Admin";
import { Login } from "./Login";
import { Home } from "./Home";
import NewLandingPage from "./landing";
import { AcceptInvite } from "./AcceptInvite";
import { parseMarkdown } from "./utils/parseMarkdown";
import LoginLoadingScreen from "./components/LoginLoadingScreen";
import { exportConversationToDocx, exportConversationToPdf, generateExportFilename } from "./utils/chatExport";

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
  fullName: string;
  businessUnit: string;
}

type View = "chat" | "admin";

export const App: React.FC = () => {
  const location = useLocation();
  // Track when loading started for minimum 3 second display
  const loadingStartTimeRef = useRef<number | null>(null);

  // Initialize auth states from localStorage to prevent flash
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const savedToken = localStorage.getItem("token");
    return !!savedToken;
  });
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(() => {
    // Show loading screen if authenticated or auth is in progress
    const savedToken = localStorage.getItem("token");
    const authInProgress = localStorage.getItem("authInProgress");
    return !savedToken || authInProgress === "true";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(() => {
    // Show Landing if user is not authenticated
    const savedToken = localStorage.getItem("token");
    return !savedToken;
  });
  const [showHome, setShowHome] = useState(() => {
    // Don't show Home initially, show Landing first
    return false;
  });
  const [isConversationsLoading, setIsConversationsLoading] = useState(() => {
    // If authenticated, we need to load conversations
    const savedToken = localStorage.getItem("token");
    return !!savedToken;
  });
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [regeneratingMessageIndex, setRegeneratingMessageIndex] = useState<number | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuConversation, setContextMenuConversation] = useState<string | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [pinnedConversations, setPinnedConversations] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("pinnedConversations");
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });
  // Admin is a separate page at /admin
  const [view, setView] = useState<View>("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLElement>(null);
  const isAdminPage = typeof window !== "undefined" && (window.location.pathname === "/admin" || window.location.pathname === "/admin" || window.location.pathname.includes('/admin'));
  const userInitials = user
    ? `${user.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || ""}`
    : "";

  // Helper function to scroll to bottom with multiple RAF attempts
  const scrollToBottom = (force: boolean = false) => {
    if (!messagesContainerRef.current) return;

    const attemptScroll = (attempt: number = 0) => {
      if (!messagesContainerRef.current) return;
      
      const { scrollHeight, scrollTop, clientHeight } = messagesContainerRef.current;
      
      // Only scroll if we haven't already (or force is true)
      if (force || scrollTop + clientHeight < scrollHeight - 10) {
        messagesContainerRef.current.scrollTop = scrollHeight;
      }

      // Retry a few times to ensure we capture the final scroll height
      if (attempt < 3) {
        requestAnimationFrame(() => attemptScroll(attempt + 1));
      }
    };

    // Start with a small delay, then use RAF
    setTimeout(() => {
      requestAnimationFrame(() => attemptScroll(0));
    }, 50);
  };

  // Check if backend is healthy (connected to MongoDB)
  const waitForBackend = async (maxRetries: number = 10): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get("/health", { timeout: 2000 });
        if (response.status === 200) {
          console.log("Backend is ready");
          return true;
        }
      } catch (error) {
        console.log(`Backend not ready (attempt ${i + 1}/${maxRetries}), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    console.error("Backend failed to become ready");
    return false;
  };

  // Initialize auth from localStorage
  useEffect(() => {
    const initApp = async () => {
      const savedToken = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
        
        // Set axios default header
        axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
        
        // Wait for backend to be ready before loading conversations
        const backendReady = await waitForBackend();
        if (backendReady) {
          // If this token belongs to an admin, don't load user conversations here
          const isAdmin = (() => {
            try {
              const payload = JSON.parse(atob(savedToken.split('.')[1]));
              return !!payload.isAdmin;
            } catch (e) {
              return false;
            }
          })();
          if (!isAdmin) {
            loadingStartTimeRef.current = Date.now();
            loadConversations(savedToken);
          } else {
            // If admin, ensure we're on admin page
            setIsConversationsLoading(false);
            if (!window.location.pathname.includes('/admin')) {
              window.location.href = '/nexa-ai/admin';
            }
          }
        } else {
          console.error("Could not connect to backend");
          setIsConversationsLoading(false);
        }
      } else {
        setIsConversationsLoading(false);
      }
      setIsLoading(false);
    };

    initApp();
  }, []);

  // Update document title based on page view
  useEffect(() => {
    if (isAdminPage) {
      document.title = "Nexa AI - Admin";
    } else {
      document.title = "Nexa AI - User";
    }
  }, [isAdminPage]);

  // Scroll to bottom when messages change or conversation changes
  useEffect(() => {
    scrollToBottom(true);
  }, [currentConversation?._id, currentConversation?.messages.length]);

  // Persist pinned conversations to localStorage
  useEffect(() => {
    localStorage.setItem("pinnedConversations", JSON.stringify(Array.from(pinnedConversations)));
  }, [pinnedConversations]);

  // Persist current conversation ID to localStorage
  useEffect(() => {
    if (currentConversation?._id) {
      localStorage.setItem("lastConversationId", currentConversation._id);
    }
  }, [currentConversation?._id]);

  const loadConversations = async (authToken: string) => {
    try {
      const { data } = await axios.get<{ conversations: Conversation[] }>(
        "/api/v1/conversations",
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setConversations(data.conversations);
      
      if (data.conversations.length > 0) {
        // Try to restore the last viewed conversation
        const savedConversationId = localStorage.getItem("lastConversationId");
        const lastConversation = savedConversationId
          ? data.conversations.find(c => c._id === savedConversationId)
          : null;
        
        // Use the last viewed conversation if it still exists, otherwise use the first one
        setCurrentConversation(lastConversation || data.conversations[0]);
      }
    } catch (error) {
      console.error("Load conversations error:", error);
    } finally {
      // Ensure loading state displays for at least 3 seconds
      const elapsedTime = Date.now() - (loadingStartTimeRef.current || Date.now());
      const remainingTime = Math.max(0, 3000 - elapsedTime);
      
      if (remainingTime > 0) {
        setTimeout(() => {
          setIsConversationsLoading(false);
          // Scroll after loading is complete
          setTimeout(() => scrollToBottom(true), 100);
        }, remainingTime);
      } else {
        setIsConversationsLoading(false);
        // Scroll after loading is complete
        setTimeout(() => scrollToBottom(true), 100);
      }
    }
  };

  const handleLogin = async (authToken: string, authUser: User) => {
    loadingStartTimeRef.current = Date.now();
    setToken(authToken);
    setUser(authUser);
    setIsAuthenticated(true);
    setIsConversationsLoading(true);
    axios.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
    await loadConversations(authToken);
  };

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
    setConversations([]);
    setCurrentConversation(null);
    delete axios.defaults.headers.common["Authorization"];
    setLogoutConfirmOpen(false);
  };

  const handleExportAsDocx = async () => {
    if (!currentConversation?.messages) return;
    const messages = currentConversation.messages.map((m) => ({
      id: crypto.randomUUID?.() ?? String(Date.now()),
      role: m.role,
      message: m.content,
      createdAt: m.timestamp || new Date(),
    }));
    await exportConversationToDocx(messages, generateExportFilename("docx"));
  };

  const handleExportAsPdf = async () => {
    if (!currentConversation?.messages) return;
    const messages = currentConversation.messages.map((m) => ({
      id: crypto.randomUUID?.() ?? String(Date.now()),
      role: m.role,
      message: m.content,
      createdAt: m.timestamp || new Date(),
    }));
    await exportConversationToPdf(messages, generateExportFilename("pdf"));
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

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToDelete(convId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return;

    try {
      await axios.delete(`/api/v1/conversations/${conversationToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const updated = conversations.filter((c) => c._id !== conversationToDelete);
      setConversations(updated);
      
      // If the deleted conversation was selected, switch to the first remaining one
      if (currentConversation?._id === conversationToDelete) {
        setCurrentConversation(updated.length > 0 ? updated[0] : null);
      }

      setDeleteConfirmOpen(false);
      setConversationToDelete(null);
      setContextMenuOpen(false);
      setContextMenuConversation(null);
    } catch (error) {
      console.error("Delete conversation error:", error);
      alert("Failed to delete conversation");
    }
  };

  const handleConversationMenu = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenuConversation(contextMenuConversation === convId ? null : convId);
    setContextMenuOpen(contextMenuConversation !== convId);
  };

  const handleRenameConversation = (convId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingConversationId(convId);
    setRenamingTitle(currentTitle);
    setContextMenuOpen(false);
  };

  const confirmRenameConversation = async () => {
    if (!renamingConversationId || !renamingTitle.trim() || !token) return;

    try {
      await axios.put(
        `/api/v1/conversations/${renamingConversationId}`,
        { title: renamingTitle.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated = conversations.map((c) =>
        c._id === renamingConversationId ? { ...c, title: renamingTitle.trim() } : c
      );
      setConversations(updated);

      if (currentConversation?._id === renamingConversationId) {
        setCurrentConversation({ ...currentConversation, title: renamingTitle.trim() });
      }

      setRenamingConversationId(null);
      setRenamingTitle("");
    } catch (error) {
      console.error("Rename conversation error:", error);
      alert("Failed to rename conversation");
    }
  };

  const handleContextMenuDelete = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToDelete(convId);
    setDeleteConfirmOpen(true);
    setContextMenuOpen(false);
    setContextMenuConversation(null);
  };

  const handlePinConversation = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = new Set(pinnedConversations);
    if (newPinned.has(convId)) {
      newPinned.delete(convId);
    } else {
      newPinned.add(convId);
    }
    setPinnedConversations(newPinned);
    setContextMenuOpen(false);
    setContextMenuConversation(null);
  };

  const handleEditMessage = (index: number, content: string) => {
    setEditingMessageIndex(index);
    setEditingContent(content);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!currentConversation || editingMessageIndex === null || !editingContent.trim() || !token) return;

    try {
      setLoading(true);
      setEditModalOpen(false); // Close modal immediately when loading starts
      // Set regeneratingMessageIndex to show loading on the AI response that will be regenerated
      setRegeneratingMessageIndex(editingMessageIndex + 1);
      const { data } = await axios.post<{
        userMessage: Message;
        assistantMessage: Message;
        conversation: Conversation;
      }>(
        `/api/v1/conversations/${currentConversation._id}/message/${editingMessageIndex}/edit`,
        { content: editingContent.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCurrentConversation(data.conversation);
      setConversations(
        conversations.map((c) =>
          c._id === data.conversation._id ? data.conversation : c
        )
      );
    } catch (error) {
      console.error("Edit message error:", error);
      alert("Failed to edit message");
    } finally {
      setEditModalOpen(false);
      setEditingMessageIndex(null);
      setEditingContent("");
      setRegeneratingMessageIndex(null);
      setLoading(false);
    }
  };

  // Helper function to stream AI response
  const streamResponse = async (conversationId: string, userContent: string): Promise<Conversation | null> => {
    const response = await fetch(
      `/api/v1/conversations/${conversationId}/message-stream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: userContent }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";
    let finalConversation: Conversation | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Process complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.done) {
                // Capture final conversation data from server
                if (data.conversation) {
                  finalConversation = data.conversation;
                }
                return finalConversation;
              }

              if (data.error) {
                throw new Error(data.error);
              }

              fullResponse = data.fullResponse || "";

              // Update current conversation with the streaming response
              setCurrentConversation((prev) => {
                if (!prev) return prev;

                const lastMsg = prev.messages[prev.messages.length - 1];
                if (lastMsg && lastMsg.role === "assistant") {
                  // Update existing assistant message
                  const updated = { ...prev };
                  updated.messages = [...prev.messages];
                  updated.messages[updated.messages.length - 1] = {
                    ...lastMsg,
                    content: fullResponse,
                  };
                  return updated;
                } else {
                  // Add new assistant message
                  return {
                    ...prev,
                    messages: [
                      ...prev.messages,
                      {
                        role: "assistant" as const,
                        content: fullResponse,
                        timestamp: new Date(),
                      },
                    ],
                  };
                }
              });

              // Scroll to show the streaming response
              scrollToBottom(false);
            } catch (error) {
              console.error("Error parsing stream data:", error);
            }
          }
        }

        // Keep incomplete line in buffer
        buffer = lines[lines.length - 1];
      }
    } finally {
      reader.releaseLock();
    }

    return finalConversation;
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !token) return;

    // Clear input immediately
    setInput("");

    // If no conversation exists, create one first
    if (!currentConversation) {
      const createData = await axios.post<{ conversation: Conversation }>(
        "/api/v1/conversations",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentConversation(createData.data.conversation);
      setConversations([createData.data.conversation, ...conversations]);
      
      // Add user message to local state immediately
      const userMsg: Message = { role: "user", content: trimmed, timestamp: new Date() };
      const updatedConv = { ...createData.data.conversation, messages: [userMsg] };
      setCurrentConversation(updatedConv);
      setLoading(true);

      // Stream AI response
      try {
        const finalConversation = await streamResponse(createData.data.conversation._id, trimmed);
        
        // Use the final conversation data from the stream response
        if (finalConversation) {
          setCurrentConversation(finalConversation);
          setConversations((prev) =>
            prev.map((c) => (c._id === finalConversation._id ? finalConversation : c))
          );
        }
      } catch (error) {
        console.error("Send message error:", error);
        alert("Error sending message. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Add user message to local state immediately
    const userMsg: Message = { role: "user", content: trimmed, timestamp: new Date() };
    const updatedConv = { ...currentConversation, messages: [...currentConversation.messages, userMsg] };
    setCurrentConversation(updatedConv);
    setLoading(true);

    // Stream AI response
    try {
      const finalConversation = await streamResponse(currentConversation._id, trimmed);
      
      // Use the final conversation data from the stream response
      if (finalConversation) {
        setCurrentConversation(finalConversation);
        setConversations((prev) =>
          prev.map((c) => (c._id === finalConversation._id ? finalConversation : c))
        );
      }
    } catch (error) {
      console.error("Send message error:", error);
      alert("Error sending message. Please try again.");
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

  if (isLoading) {
    return (
      <div style={{
        width: "100%",
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", color: "#333", marginBottom: "10px", fontFamily: "Georgia, serif" }}>Loading...</div>
        </div>
      </div>
    );
  }

  // If authenticated and still loading conversations, show loading screen
  if (isAuthenticated && isConversationsLoading) {
    return <LoginLoadingScreen userType="user" />;
  }

  // Invite acceptance page — always public, no auth required
  if (location.pathname === "/accept-invite") {
    return <AcceptInvite />;
  }

  // If user is visiting the admin URL, render Admin immediately (public page)
  if (isAdminPage) {
    return (
      <div style={{ height: "100dvh", background: "#ffffff" }}>
        <Admin />
      </div>
    );
  }

  // If user is visiting the login URL and not authenticated, show Login component
  if (!isAuthenticated && location.pathname === "/login") {
    return <Login onLoginSuccess={handleLogin} />;
  }

  // Show landing page if user is not authenticated and hasn't clicked to view home
  if (isAuthenticated === false && isLoading === false && showLanding) {
    return <NewLandingPage />;
  }

  // Show home page if user is not authenticated and explicitly wants to see it
  if (isAuthenticated === false && isLoading === false && showHome) {
    return (
      <Home
        onEnter={() => setShowHome(false)}
        user={user}
      />
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <>
      {isLoading && <LoginLoadingScreen userType={isAdminPage ? "admin" : "user"} />}
      <div className="ufl-root">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={() => {
            handleNewChat();
            if (window.innerWidth <= 768) setSidebarOpen(false);
          }}>
            + New chat
          </button>
        </div>

        <div className="sidebar-conversations">
          <div className="sidebar-conversations-label">Conversations</div>
          {conversations.length === 0 ? (
            <div className="sidebar-empty">No conversations yet</div>
          ) : (
            (() => {
              const sorted = [...conversations].sort((a, b) => {
                const aPinned = pinnedConversations.has(a._id);
                const bPinned = pinnedConversations.has(b._id);
                if (aPinned !== bPinned) return aPinned ? -1 : 1;
                return 0;
              });
              return sorted.map((conv) => (
              <div
                key={conv._id}
                className={`sidebar-conversation ${
                  currentConversation?._id === conv._id ? "active" : ""
                } ${pinnedConversations.has(conv._id) ? "pinned" : ""}`}
                onClick={() => {
                  setCurrentConversation(conv);
                  if (window.innerWidth <= 768) setSidebarOpen(false);
                }}
              >
                <div className="conv-main">
                  {renamingConversationId === conv._id ? (
                    <input
                      type="text"
                      className="rename-input"
                      value={renamingTitle}
                      onChange={(e) => setRenamingTitle(e.target.value)}
                      onBlur={confirmRenameConversation}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRenameConversation();
                        if (e.key === 'Escape') {
                          setRenamingConversationId(null);
                          setRenamingTitle("");
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <div className="conv-title" title={conv.title}>
                        {pinnedConversations.has(conv._id) && <MdPushPin className="pin-icon" size={14} />}
                        {conv.title}
                      </div>
                      <div className="conv-date">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </div>
                    </>
                  )}
                </div>
                <div
                  className="conv-menu-container"
                  onMouseEnter={() => setContextMenuOpen(true)}
                  onMouseLeave={() => {
                    setContextMenuOpen(false);
                    setContextMenuConversation(null);
                  }}
                >
                  <button
                    className="conv-menu-btn"
                    onClick={(e) => handleConversationMenu(conv._id, e)}
                    title="More options"
                  >
                    ...
                  </button>
                  {contextMenuOpen && contextMenuConversation === conv._id && (
                    <div className="context-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="context-menu-item"
                        onClick={(e) => handlePinConversation(conv._id, e)}
                      >
                        <MdPushPin size={16} />
                        {pinnedConversations.has(conv._id) ? "Unpin chat" : "Pin chat"}
                      </button>
                      <button 
                        className="context-menu-item delete"
                        onClick={(e) => handleContextMenuDelete(conv._id, e)}
                      >
                        <FiTrash2 size={16} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
            })()
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">
              {user?.fullName}
            </div>
            <div className="user-email">{user?.businessUnit}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <FiLogOut className="logout-btn-icon" />
            Logout
          </button>
        </div>
      </aside>

      <main className="chat-layout" onClick={() => {
        if (sidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 768) {
          setSidebarOpen(false);
        }
      }}>
        <header className="chat-header">
          <button className="hamburger-btn" onClick={toggleSidebar}>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          <div className="chat-header-left">
            <div className="chat-title">{user?.businessUnit} GPT</div>
            <div className="chat-subtitle">Ask anything about {user?.businessUnit} documents and guidelines</div>
          </div>
          <div className="chat-header-right">
            <div className="header-user-info">
              <div className="header-user-name">{user?.fullName}</div>
              <div className="header-user-email">{user?.email}</div>
            </div>
            <button className={`header-tab active`}>Chat</button>
          </div>
        </header>

        <>

            <section className="chat-messages" ref={messagesContainerRef}>
              {!currentConversation?.messages.length && !loading ? (
                <div className="chat-empty-state">
                  <div className="empty-logo">
                    <img src="/avatar-1.png" alt="Nexa AI" />
                  </div>
                  <h1 className="empty-title">What's on your mind today?</h1>
                  <p className="empty-subtitle">Ask anything about {user?.businessUnit} company documents, policies, procedures, and guidelines</p>
                </div>
              ) : (
                <>
                  {currentConversation?.messages.map((m, idx) => (
                    <div key={idx}>
                      {regeneratingMessageIndex === idx ? (
                        <div className="message-row assistant">
                          <div className="bubble typing">
                            <span className="dot"></span>
                            <span className="dot"></span>
                            <span className="dot"></span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`message-row ${
                            m.role === "assistant" ? "assistant" : "user"
                          }`}
                        >
                          {m.role === "user" && (
                            <div className="avatar">
                              <span className="avatar-user">{userInitials || "U"}</span>
                            </div>
                          )}
                          <div className="bubble">
                            {m.content.split("\n").map((line, lineIdx) => (
                              <p key={lineIdx}>{parseMarkdown(line)}</p>
                            ))}
                          </div>
                          {m.role === "user" && (
                            <div className="message-actions">
                              <button
                                className="message-action-btn"
                                onClick={() => handleEditMessage(idx, m.content)}
                                title="Edit message"
                              >
                                <BiPencil size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
              {loading && (
                <div className="message-row assistant">
                  <div className="bubble typing">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
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
                {user?.businessUnit} GPT may not always be accurate. Verify critical information
                with HR or Compliance.
              </div>
            </footer>
          </>
      </main>

      <style>{`
        .hamburger-btn {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          margin-right: 10px;
          z-index: 1002;
        }

        .hamburger-line {
          width: 24px;
          height: 3px;
          background: #333;
          border-radius: 2px;
          transition: all 0.3s;
        }

        .sidebar-conversations {
          flex: 1;
          overflow-y: auto;
          padding: 10px 0;
          border-bottom: 1px solid #e0e0e0;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
        }

        .sidebar-conversations-label {
          font-size: 12px;
          font-weight: 600;
          color: #999;
          padding: 10px 12px;
          text-transform: uppercase;
          font-family: Georgia, serif;
        }

        .sidebar-empty {
          padding: 20px 12px;
          text-align: center;
          color: #999;
          font-size: 13px;
          font-family: Georgia, serif;
        }

        .sidebar-conversation {
          padding: 12px;
          margin: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          position: relative;
        }

        .sidebar-conversation:hover {
          background: #f5f5f5;
        }

        .sidebar-conversation.active {
          background: #e8e8ff;
        }

        .sidebar-conversation.pinned {
          background: #fff5e6;
          border-left: 3px solid #ed0000;
        }

        .sidebar-conversation.pinned.active {
          background: #ffeccc;
        }

        .sidebar-conversation.pinned:hover {
          background: #fff9f0;
        }

        .conv-main {
          flex: 1;
          min-width: 0;
        }

        .conv-title {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: Georgia, serif;
        }

        .pin-icon {
          font-size: 12px;
          flex-shrink: 0;
        }

        .conv-date {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
          font-family: Georgia, serif;
        }

        .conv-menu-btn {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          color: #999;
          font-size: 18px;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          opacity: 1;
          font-weight: bold;
        }

        .sidebar-conversation:hover .conv-menu-btn {
          background: #f0f0f0;
          color: #ed0000;
        }

        .conv-menu-container:hover .conv-menu-btn {
          background: #f0f0f0;
          color: #ed0000;
        }

        .conv-menu-btn:active {
          background: #e0e0e0;
        }

        .conv-menu-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .context-menu-dropdown {
          position: absolute;
          right: 0;
          top: 100%;
          margin-top: 4px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 140px;
          z-index: 1000;
          animation: slideDown 0.15s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: transparent;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          color: #333;
          transition: background 0.15s;
          font-family: Georgia, serif;
        }

        .context-menu-item:first-child {
          border-radius: 6px 6px 0 0;
        }

        .context-menu-item:last-child {
          border-radius: 0 0 6px 6px;
        }

        .context-menu-item:hover {
          background: #f5f5f5;
        }

        .context-menu-item.delete {
          color: #d32f2f;
        }

        .context-menu-item.delete:hover {
          background: #ffebee;
        }

        .rename-input {
          width: 100%;
          padding: 6px 8px;
          border: 2px solid #ed0000;
          border-radius: 4px;
          font-size: 13px;
          font-family: Georgia, serif;
          outline: none;
          background: white;
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
          font-family: Georgia, serif;
        }

        .user-email {
          font-size: 12px;
          color: #999;
          font-family: Georgia, serif;
          margin-top: 2px;
        }

        .logout-btn {
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, #d92322 0%, #b81a19 100%);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 12px;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 2px 4px rgba(217, 35, 34, 0.2);
        }

        .logout-btn-icon {
          font-size: 16px;
          display: flex;
          align-items: center;
        }

        .logout-btn:hover {
          background: linear-gradient(135deg, #a91a19 0%, #8f1615 100%);
          box-shadow: 0 4px 8px rgba(217, 35, 34, 0.3);
          transform: translateY(-2px);
        }

        .logout-btn:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(217, 35, 34, 0.2);
        }

        .chat-header {
          padding: 16px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid #e0e0e0;
          background: white;
        }

        .chat-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          font-family: Georgia, serif;
        }

        .chat-subtitle {
          font-size: 12px;
          color: #999;
          font-family: Georgia, serif;
        }

        .header-user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .header-user-name {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          font-family: Georgia, serif;
        }

        .header-user-email {
          font-size: 12px;
          color: #999;
          font-family: Georgia, serif;
        }

        .chat-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
        }

        .empty-title {
          font-size: 24px;
          font-weight: 600;
          color: #333;
          margin: 0 0 12px 0;
          font-family: Georgia, serif;
        }

        .empty-subtitle {
          font-size: 14px;
          color: #999;
          margin: 0;
          max-width: 400px;
          font-family: Georgia, serif;
        }

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .ufl-root {
            width: 100%;
            height: 100dvh;
            position: relative;
            overflow: hidden;
          }

          .hamburger-btn {
            display: flex;
          }

          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 260px;
            height: 100dvh;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            z-index: 1001;
          }

          .sidebar.sidebar-open {
            transform: translateX(0);
          }

          .chat-layout {
            flex: 1;
            width: 100%;
          }

          .chat-header {
            padding: 12px 16px;
            display: flex;
            align-items: center;
          }

          .chat-title {
            font-size: 18px;
            font-family: Georgia, serif;
          }

          .chat-subtitle {
            font-size: 12px;
            font-family: Georgia, serif;
          }

          .message-row {
            padding: 10px 16px;
          }

          .avatar {
            min-width: 32px;
          }

          .bubble {
            max-width: 85%;
            font-size: 14px;
          }

          .chat-textarea {
            min-height: 40px;
            font-size: 16px;
          }
        }

        @media (max-width: 480px) {
          .chat-header {
            padding: 10px 12px;
          }

          .chat-title {
            font-size: 16px;
            font-family: Georgia, serif;
          }

          .chat-subtitle {
            font-size: 11px;
            font-family: Georgia, serif;
          }

          .chat-messages {
            padding: 8px 0;
          }

          .message-row {
            padding: 8px 12px;
            gap: 8px;
          }

          .avatar {
            min-width: 28px;
            width: 28px;
            height: 28px;
          }

          .bubble {
            max-width: 90%;
            font-size: 13px;
            padding: 8px 10px;
          }

          .chat-input-wrapper {
            padding: 10px 10px 12px;
          }

          .chat-textarea {
            min-height: 36px;
            font-size: 15px;
            padding: 8px;
          }

          .send-btn {
            padding: 8px 12px;
            font-size: 12px;
          }

          .chat-actions-bar {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            background: linear-gradient(135deg, rgba(237, 0, 0, 0.08) 0%, rgba(237, 0, 0, 0.04) 100%);
            border-bottom: 1px solid rgba(237, 0, 0, 0.15);
            flex-wrap: wrap;
            align-items: center;
            backdrop-filter: blur(10px);
          }

          .export-btn {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            padding: 0.7rem 1.2rem;
            background: linear-gradient(135deg, #ED0000 0%, #c70000 100%);
            border: none;
            color: white;
            border-radius: 8px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
            box-shadow: 0 2px 8px rgba(237, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
            white-space: nowrap;
          }

          .export-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.2);
            transition: left 0.3s ease;
            z-index: 0;
          }

          .export-btn:hover::before {
            left: 100%;
          }

          .export-btn:hover {
            background: linear-gradient(135deg, #ff1a1a 0%, #ed0000 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(237, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.15);
          }

          .export-btn:active {
            transform: translateY(0);
            box-shadow: 0 1px 4px rgba(237, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.1);
          }

          .export-btn svg {
            flex-shrink: 0;
            position: relative;
            z-index: 1;
            transition: transform 0.3s ease;
          }

          .export-btn:hover svg {
            transform: scale(1.1) rotate(5deg);
          }

          .export-btn span {
            position: relative;
            z-index: 1;
          }
        }
      `}</style>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="delete-modal-backdrop">
          <div className="delete-modal-card">
            <h3>Delete Conversation?</h3>
            <p>Are you sure you want to delete this conversation? This action cannot be undone.</p>
            <div className="delete-modal-actions">
              <button
                className="delete-modal-cancel"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setConversationToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                className="delete-modal-confirm"
                onClick={confirmDeleteConversation}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div className="delete-modal-backdrop">
          <div className="delete-modal-card">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout? You will need to login again to access this application.</p>
            <div className="delete-modal-actions">
              <button
                className="delete-modal-cancel"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="delete-modal-confirm"
                onClick={confirmLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Message Modal */}
      {editModalOpen && (
        <div className="edit-modal-backdrop">
          <div className="edit-modal-card">
            <h3>Edit Message</h3>
            <textarea
              className="edit-message-textarea"
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              placeholder="Enter your message..."
            />
            <div className="edit-modal-actions">
              <button
                className="edit-modal-cancel"
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingMessageIndex(null);
                  setEditingContent("");
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="edit-modal-save"
                onClick={handleSaveEdit}
                disabled={loading}
              >
                {loading ? "Loading response" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}


      <style>{`
        .delete-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .delete-modal-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          font-family: Georgia, "Times New Roman", serif;
        }

        .delete-modal-card h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          color: #333;
        }

        .delete-modal-card p {
          margin: 0 0 20px 0;
          font-size: 14px;
          color: #666;
          line-height: 1.5;
        }

        .delete-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .delete-modal-cancel {
          padding: 10px 20px;
          border: 1px solid #d0d0d0;
          background: white;
          color: #333;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .delete-modal-cancel:hover {
          background: #f5f5f5;
        }

        .delete-modal-confirm {
          padding: 10px 20px;
          border: none;
          background: #d32f2f;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .delete-modal-confirm:hover {
          background: #b71c1c;
        }

        .edit-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .edit-modal-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          font-family: Georgia, "Times New Roman", serif;
        }

        .edit-modal-card h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          color: #333;
        }

        .edit-message-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #d0d0d0;
          border-radius: 6px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          resize: vertical;
          min-height: 120px;
          max-height: 300px;
          margin-bottom: 16px;
          color: #333;
          line-height: 1.5;
        }

        .edit-message-textarea:focus {
          outline: none;
          border-color: #22c55e;
          box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.1);
        }

        .edit-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .edit-modal-cancel {
          padding: 10px 20px;
          border: 1px solid #d0d0d0;
          background: white;
          color: #333;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .edit-modal-cancel:hover {
          background: #f5f5f5;
        }

        .edit-modal-save {
          padding: 10px 20px;
          border: none;
          background: #22c55e;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .edit-modal-save:hover {
          background: #16a34a;
        }
      `}</style>
      </div>
    </>
  );
};
