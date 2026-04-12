import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  BiPaperPlane, BiPencil, BiHomeAlt, BiHistory, BiLibrary, BiGridAlt,
  BiUserCircle, BiCog, BiMessageSquareAdd, BiSearch, BiImage, BiCodeBlock,
  BiBoltCircle, BiShareAlt, BiHelpCircle, BiChevronDown, BiSidebar,
  BiUpArrowAlt, BiMessageRounded, BiPlus, BiDotsHorizontalRounded,
  BiPaperclip, BiMicrophone, BiMoon, BiSun
} from "react-icons/bi";
import { MdPushPin, MdAutoAwesome } from "react-icons/md";
import { FiLogOut, FiDownload, FiTrash2, FiExternalLink } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import { Admin } from "./Admin";
import { Login } from "./Login";
import { Home } from "./Home";
import NewLandingPage from "./landing";
import { AcceptInvite } from "./AcceptInvite";
import SuperAdminMain from "./super-admin/SuperAdminMain";
import SuperAdminLogin from "./super-admin/pages/SuperAdminLogin";
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
    const savedToken = localStorage.getItem("nexa-token");
    return !!savedToken;
  });
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("nexa-user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("nexa-token"));
  const [isLoading, setIsLoading] = useState(() => {
    // Only show loading screen if user IS authenticated (need to hydrate state)
    // or if auth is actively in progress (OAuth callback)
    const savedToken = localStorage.getItem("nexa-token");
    const authInProgress = localStorage.getItem("authInProgress");
    if (authInProgress === "true") return true;
    // If there's a token, we need to load user data — show loading
    // If there's NO token, we're unauthenticated — go straight to landing (no loading)
    return !!savedToken;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const [suggestions, setSuggestions] = useState<{ title: string; category: string; prompt: string }[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('nexa-theme') as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('nexa-theme', newTheme);
  };
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isHomeRecentCollapsed, setIsHomeRecentCollapsed] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLElement>(null);
  const isAdminPage = location.pathname.startsWith('/admin');
  const isSuperAdminPage = location.pathname.startsWith('/super-admin');
  const isChatPage = location.pathname === '/user-chat';
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

  useEffect(() => {
    const initApp = async () => {
      const savedToken = localStorage.getItem("nexa-token");
      const savedUser = localStorage.getItem("nexa-user");

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);

        // Set axios default header
        axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;

        const userData = JSON.parse(savedUser);
        if (userData.tenantColor) {
          document.documentElement.style.setProperty('--brand-color', userData.tenantColor);
        }

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
            // Redirect authenticated users to /user-chat if they're on / or /login
            if (window.location.pathname === "/" || window.location.pathname === "/login") {
              window.history.replaceState(null, "", "/user-chat");
            }
            loadConversations(savedToken);
          } else {
            // If admin, we don't force redirect on load anymore
            // The navbar will provide access to the control panel
            setIsConversationsLoading(false);
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
    } else if (isSuperAdminPage) {
      document.title = "Nexa AI - Control Panel";
    } else if (isChatPage) {
      document.title = "Nexa AI - Chat";
    } else if (location.pathname === "/login") {
      document.title = "Nexa AI - Sign In";
    } else {
      document.title = "Nexa AI";
    }
  }, [isAdminPage, isSuperAdminPage, isChatPage, location.pathname]);

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

  // Fetch suggestions based on business unit
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!user?.businessUnit || !isAuthenticated) return;

      try {
        setIsSuggestionsLoading(true);
        const { data } = await axios.get(`/api/v1/chat/suggestions?businessUnit=${encodeURIComponent(user.businessUnit)}`);
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
        // Fallback suggestions
        setSuggestions([
          { category: "Strategy", title: "Develop a market expansion plan for our business unit", prompt: "Help me create a market expansion plan..." },
          { category: "Efficiency", title: "Identify bottlenecks in our current workflow", prompt: "Analyze our workflow and identify bottlenecks..." },
          { category: "Innovation", title: "Suggest 3 new features for our primary product", prompt: "Give me 3 innovative feature ideas..." }
        ]);
      } finally {
        setIsSuggestionsLoading(false);
      }
    };

    fetchSuggestions();
  }, [user?.businessUnit, isAuthenticated]);

  async function loadConversations(authToken: string) {
    setIsConversationsLoading(true);
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

  const handleLogin = async (authToken: string, authUser: any) => {
    localStorage.setItem("nexa-token", authToken);
    localStorage.setItem("nexa-user", JSON.stringify(authUser));
    setToken(authToken);
    setUser(authUser);
    setIsAuthenticated(true);

    // Role-based redirection
    if (authUser.businessUnit === 'SUPERADMIN') {
      window.location.href = "/super-admin/dashboard";
    } else if (authUser.isAdmin) {
      window.location.href = "/admin/dashboard";
    } else {
      window.history.pushState(null, "", "/user-chat");
      setIsConversationsLoading(true);
      axios.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
      await loadConversations(authToken);
    }
  };

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("nexa-token");
    localStorage.removeItem("nexa-user");
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
    setConversations([]);
    setCurrentConversation(null);
    delete axios.defaults.headers.common["Authorization"];
    setLogoutConfirmOpen(false);
    // Navigate back to the landing page
    window.history.replaceState(null, "", "/");
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

  const startVoiceRecording = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          setInput(prev => prev + (prev ? ' ' : '') + event.results[i][0].transcript);
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
    // Reset inputs so same file can be selected again if removed
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !token) return;

    // Clear input and attachments immediately
    setInput("");
    setAttachedFiles([]);

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

  // ─── Route-based rendering (independent of main app auth) ───

  // Handle Super Admin routing separately (has its own auth flow)
  if (isSuperAdminPage) {
    if (location.pathname === '/super-admin/login') {
      return <SuperAdminLogin />;
    }
    return <SuperAdminMain theme={theme} toggleTheme={toggleTheme} />;
  }

  // Handle Business Admin routing separately
  if (isAdminPage) {
    return <SuperAdminMain theme={theme} toggleTheme={toggleTheme} />; // We'll update this component to handle /admin vs /super-admin
  }

  // Invite acceptance page — always public, no auth required
  if (location.pathname === "/accept-invite") {
    return <AcceptInvite />;
  }

  // If user is visiting the old admin URL, redirect to new one
  if (isAdminPage) {
    window.location.href = "/admin/dashboard";
    return null;
  }

  // ─── Main app loading / auth flow ───

  // Show loading spinner only while hydrating authenticated state
  if (isLoading && isAuthenticated) {
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

  // If authenticated and still loading conversations on chat page, show loading screen
  if (isAuthenticated && isConversationsLoading && isChatPage) {
    return <LoginLoadingScreen userType="user" />;
  }

  // /login — always shows login form; redirects to /user-chat if already authenticated
  if (location.pathname === "/login") {
    if (isAuthenticated) {
      window.history.replaceState(null, "", "/user-chat");
      // fall through to chat rendering below
    } else {
      return <Login onLoginSuccess={handleLogin} />;
    }
  }

  // / — always shows the landing page (homepage)
  if (location.pathname === "/") {
    if (isAuthenticated) {
      // Authenticated user visiting homepage — redirect to chat
      window.history.replaceState(null, "", "/user-chat");
      // fall through to chat rendering below
    } else {
      return <NewLandingPage />;
    }
  }

  // /user-chat — requires authentication
  if (location.pathname === "/user-chat") {
    if (!isAuthenticated) {
      window.history.replaceState(null, "", "/login");
      return <Login onLoginSuccess={handleLogin} />;
    }
    // Authenticated — render chat interface below
  }

  // Any other unmatched route for unauthenticated users → landing page
  if (!isAuthenticated) {
    return <NewLandingPage />;
  }

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <>
      {isLoading && <LoginLoadingScreen userType={isAdminPage ? "admin" : "user"} />}
      <div className={`ufl-root ${theme === 'dark' ? 'dark-theme' : ''}`}>
        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-header-main">
            <div className="sidebar-logo">
              <div className="logo-icon-wrapper">
                <img src="/1879-22.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <span className="logo-text">Nexa</span>
            </div>
          </div>

          <div className="new-chat-container">
            <button className="new-chat-btn-v2" onClick={handleNewChat}>
              <BiPlus size={20} />
              <span>New Chat</span>
              <span className="shortcut-key">⌥ N</span>
            </button>
          </div>

          <div className="sidebar-conversations-v2">
            <div
              className="sidebar-section-label retractable"
              onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
            >
              <span>Recent</span>
              <BiChevronDown style={{ transform: isHistoryCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </div>
            {!isHistoryCollapsed && (
              conversations.length === 0 ? (
                <div className="sidebar-empty">No conversations yet</div>
              ) : (
                (() => {
                  const sorted = [...conversations].sort((a, b) => {
                    const aPinned = pinnedConversations.has(a._id);
                    const bPinned = pinnedConversations.has(b._id);
                    if (aPinned !== bPinned) return aPinned ? -1 : 1;
                    return 0;
                  });
                  // Only show top 7 or so, with a "Show more"
                  return (
                    <>
                      <AnimatePresence initial={false}>
                        {sorted.slice(0, 10).map((conv) => (
                          <motion.div
                            layout
                            key={conv._id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className={`sidebar-conversation-v2 ${currentConversation?._id === conv._id ? "active" : ""
                              } ${pinnedConversations.has(conv._id) ? "pinned" : ""}`}
                            onClick={() => {
                              setCurrentConversation(conv);
                              if (window.innerWidth <= 768) setSidebarOpen(false);
                            }}
                          >
                            {pinnedConversations.has(conv._id) && (
                              <MdPushPin size={16} className="pin-active-icon mr-2 flex-shrink-0" />
                            )}
                            <div className="conv-title-v2">{conv.title}</div>
                            <button
                              className="conv-menu-btn visible"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === conv._id ? null : conv._id);
                              }}
                            >
                              <BiDotsHorizontalRounded size={18} />
                            </button>
                            {activeMenuId === conv._id && (
                              <div className="conv-dropdown">
                                <button onClick={(e) => {
                                  handlePinConversation(conv._id, e as any);
                                  setActiveMenuId(null);
                                }}>
                                  {pinnedConversations.has(conv._id) ? "Unpin" : "Pin"}
                                </button>
                                <button onClick={(e) => {
                                  handleContextMenuDelete(conv._id, e as any);
                                  setActiveMenuId(null);
                                }}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </>
                  );
                })())
            )}
            {!isHistoryCollapsed && conversations.length > 10 && (
              <div className="show-more-btn">
                <BiChevronDown size={18} />
                <span>Show more</span>
              </div>
            )}
          </div>

          <div className="sidebar-footer-actions">
            <button className="theme-toggle-btn" onClick={toggleTheme}>
              {theme === 'light' ? <BiMoon size={18} /> : <BiSun size={18} />}
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
            <button className="sidebar-logout-btn" onClick={() => setLogoutConfirmOpen(true)}>
              <FiLogOut size={18} />
              <span>Logout</span>
            </button>
          </div>

          <div className="user-profile-v2">
            <div className="user-avatar-v2">
              {userInitials || "U"}
            </div>
            <div className="user-info-v2">
              <div className="user-email-v2">{user?.email}</div>
            </div>
            <BiChevronDown size={18} />
          </div>
        </aside>

        <main className="chat-layout" onClick={() => {
          if (sidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 768) {
            setSidebarOpen(false);
          }
        }}>
          <header className="chat-header-v2">
            <div className="header-left-v2">
              {/* Sidebar toggle removed per user request */}
            </div>
            <div className="header-brand-v2">
              <span className="brand-name-v2" style={{ color: '#111827' }}>Nexa</span>
            </div>
            <div className="header-actions-v2">
              <button className="header-action-btn-v2">
                <BiHelpCircle size={18} />
                <span>Help</span>
              </button>
            </div>
          </header>

          <section className="chat-content-v2">
            {!currentConversation?.messages.length && !loading ? (
              <div className="chat-home-v2">
                <div className="home-greeting-wrapper-v2">
                  <h2 className="welcome-name-v2">Welcome, {user?.fullName?.split(' ')[0] || 'there'}!</h2>
                  <h1 className="home-greeting-v2">
                    How can <span className="red-accent">Nexa</span> help you today?
                  </h1>
                </div>

                <div className="suggestion-cards-top">
                  {suggestions.slice(0, 3).map((s, i) => (
                    <div key={i} className="suggestion-card-v2" onClick={() => {
                      setInput(s.prompt);
                    }}>
                      <div className="suggestion-icon-wrapper">
                        {i === 0 ? <BiBoltCircle size={24} color="var(--brand-color, #ed0000)" /> :
                          i === 1 ? <BiCodeBlock size={24} color="var(--brand-color, #ed0000)" /> :
                            <BiSearch size={24} color="var(--brand-color, #ed0000)" />}
                      </div>
                      <div className="suggestion-content-text">
                        <div className="suggestion-category">{s.category}</div>
                        <div className="suggestion-title">{s.title}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="main-input-container-v2">
                  {/* Attached Files Preview */}
                  {attachedFiles.length > 0 && (
                    <div className="attached-files-preview">
                      {attachedFiles.map((file, i) => (
                        <div key={i} className="attached-file-chip">
                          <span className="file-name">{file.name}</span>
                          <button className="remove-file-btn" onClick={() => removeAttachedFile(i)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Border Drawing Animation SVG */}
                  <svg className="border-beam-svg" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="transparent" />
                        <stop offset="50%" stopColor="var(--brand-color, #ed0000)" />
                        <stop offset="100%" stopColor="#ff7b7b" />
                      </linearGradient>
                    </defs>
                    <rect
                      className="border-beam-rect"
                      x="0" y="0" rx="20" ry="20"
                      width="100%" height="100%"
                      stroke="url(#beamGradient)"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <textarea
                    className="main-textarea-v2"
                    placeholder="How can Nexa help you today?"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                  />
                  <div className="input-footer-v2">
                    <div className="input-toolbar-icons">
                      <input
                        type="file"
                        ref={imageInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        multiple
                        onChange={handleFileAttach}
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="*"
                        multiple
                        onChange={handleFileAttach}
                      />
                      <button className="input-tool-btn" onClick={() => imageInputRef.current?.click()} title="Add image">
                        <BiPlus />
                      </button>
                      <button className="input-tool-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">
                        <BiPaperclip />
                      </button>
                      <button
                        className={`input-tool-btn ${isRecording ? 'recording' : ''}`}
                        onClick={startVoiceRecording}
                        title="Voice record"
                      >
                        <BiMicrophone style={{ color: isRecording ? 'var(--brand-color, #ed0000)' : 'inherit' }} />
                      </button>
                    </div>
                    <button
                      className="send-btn-v2"
                      onClick={handleSend}
                      disabled={!input.trim() || loading}
                    >
                      <BiUpArrowAlt size={24} />
                    </button>
                  </div>
                </div>

                <p className="collaborate-text-v2">Collaborate with Nexa using documents, images and more</p>

                <div className="recent-chats-section-v2">
                  <div
                    className="section-header-v2 clickable"
                    onClick={() => setIsHomeRecentCollapsed(!isHomeRecentCollapsed)}
                  >
                    <BiHistory size={18} />
                    <span>Your Recent chats</span>
                    <BiChevronDown size={18} style={{ transform: isHomeRecentCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </div>
                  {!isHomeRecentCollapsed && (
                    <div className="recent-cards-v2">
                      {conversations.slice(0, 3).map((conv, idx) => (
                        <div key={conv._id} className="recent-card-v2" onClick={() => setCurrentConversation(conv)}>
                          <BiMessageRounded size={18} color="var(--brand-color, #ed0000)" />
                          <div className="recent-card-title-v2">{conv.title}</div>
                          <div className="recent-card-time-v2">{idx === 0 ? "recent" : "earlier"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="messages-container-v2" ref={messagesContainerRef}>
                {currentConversation?.messages.map((m, idx) => (
                  <div key={idx} className={`message-row-v2 ${m.role}`}>
                    <div className="message-avatar-v2">
                      {m.role === 'assistant' ? (
                        <img src="/avatar-1.png" alt="Nexa" className="bot-avatar-img" />
                      ) : null}
                    </div>
                    <div className="message-bubble-v2">
                      {m.content.split("\n").map((line, lIdx) => (
                        <p key={lIdx}>{parseMarkdown(line)}</p>
                      ))}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="message-row-v2 assistant">
                    <div className="message-avatar-v2">
                      <BiBoltCircle size={18} />
                    </div>
                    <div className="message-content-v2">
                      <div className="typing-v2">
                        <span className="dot-v2"></span>
                        <span className="dot-v2"></span>
                        <span className="dot-v2"></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </section>

          {(currentConversation?.messages.length > 0 || loading) && (
            <footer className="footer-input-v2">
              <div className="footer-input-container-v2">
                <button className="footer-tool-btn"><BiPlus /></button>
                <button className="footer-tool-btn"><BiPaperclip /></button>
                <button className="footer-tool-btn"><BiMicrophone /></button>
                <textarea
                  className="footer-textarea-v2"
                  placeholder="Send a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className="footer-send-btn-v2"
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                >
                  <BiUpArrowAlt size={20} />
                </button>
              </div>
              <p className="footer-disclaimer-v2">Nexa may display inaccurate info, so please double check the response</p>
            </footer>
          )}
        </main>

        {/* Modals */}
        {logoutConfirmOpen && (
          <div className="modal-overlay-v2">
            <div className="modal-card-v2">
              <div className="modal-header-v2">
                <h3>Sign Out</h3>
                <p>Are you sure you want to sign out of your Nexa account?</p>
              </div>
              <div className="modal-footer-v2">
                <button className="modal-btn-v2 secondary" onClick={() => setLogoutConfirmOpen(false)}>Cancel</button>
                <button className="modal-btn-v2 primary danger" onClick={confirmLogout}>Sign Out</button>
              </div>
            </div>
          </div>
        )}

        {deleteConfirmOpen && (
          <div className="modal-overlay-v2">
            <div className="modal-card-v2">
              <div className="modal-header-v2">
                <h3>Delete Conversation</h3>
                <p>This action cannot be undone. All messages in this chat will be permanently removed.</p>
              </div>
              <div className="modal-footer-v2">
                <button className="modal-btn-v2 secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancel</button>
                <button className="modal-btn-v2 primary danger" onClick={confirmDeleteConversation}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {editModalOpen && (
          <div className="modal-overlay-v2">
            <div className="modal-card-v2">
              <div className="modal-header-v2">
                <h3>Edit Message</h3>
                <p>Updating this message will regenerate the AI response.</p>
              </div>
              <textarea
                className="modal-textarea-v2"
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
              />
              <div className="modal-footer-v2">
                <button className="modal-btn-v2 secondary" onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button className="modal-btn-v2 primary" onClick={handleSaveEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        )}

        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

        .ufl-root {
          display: flex;
          height: 100dvh;
          background: #fdfdfd;
          color: #111827;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow: hidden;
        }

        /* Custom Brand Scrollbar */
        *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        *::-webkit-scrollbar-thumb {
          background: var(--brand-color, #ed0000)20;
          border-radius: 10px;
        }
        *::-webkit-scrollbar-thumb:hover {
          background: var(--brand-color, #ed0000)50;
        }

        /* Sidebar V2 */
        .sidebar {
          width: 280px;
          background: #f3f4f6;
          display: flex;
          flex-direction: column;
          padding: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-right: 1px solid #e5e7eb;
          z-index: 50;
        }

        .sidebar-header-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 4px 24px;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-icon-wrapper {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .logo-text {
          font-weight: 600;
          font-size: 16px;
          color: var(--brand-color, #ed0000);
        }

        .sidebar-toggle-btn {
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sidebar-toggle-btn:hover {
          background: #e5e7eb;
          color: #111827;
        }

        .new-chat-container {
          padding-bottom: 24px;
        }

        .new-chat-btn-v2 {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: #fdfdfd;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          color: #111827;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .new-chat-btn-v2:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .shortcut-key {
          margin-left: auto;
          font-size: 12px;
          color: #9ca3af;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
        }

        .sidebar-conversations-v2 {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 16px;
        }

        .sidebar-section-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 12px;
          padding: 0 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-section-label.retractable {
          cursor: pointer;
          user-select: none;
        }

        .sidebar-section-label.retractable:hover, .section-header-v2.clickable:hover {
          color: var(--brand-color, #ed0000);
        }

        .section-header-v2.clickable {
          cursor: pointer;
          user-select: none;
        }

        .sidebar-conversation-v2 {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 8px;
          color: #4b5563;
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 4px;
          transition: all 0.2s;
          position: relative;
        }

        .sidebar-conversation-v2:hover {
          background: #e5e7eb;
        }

        .sidebar-conversation-v2.active {
          background: #e5e7eb;
          color: var(--brand-color, #ed0000);
          font-weight: 500;
        }

        .conv-menu-btn {
          opacity: 1;
          margin-left: auto;
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .conv-menu-btn:hover {
          background: #d1d5db;
          color: var(--brand-color, #ed0000);
        }

        .conv-dropdown {
          position: absolute;
          right: 8px;
          top: 36px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 100;
          display: flex;
          flex-direction: column;
          min-width: 120px;
          overflow: hidden;
        }

        .conv-dropdown button {
          padding: 10px 14px;
          text-align: left;
          border: none;
          background: transparent;
          font-size: 13px;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
        }

        .conv-dropdown button:hover {
          background: #f3f4f6;
          color: var(--brand-color, #ed0000);
        }

        .conv-icon {
          flex-shrink: 0;
          color: #9ca3af;
        }

        .conv-title-v2 {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .show-more-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          color: #6b7280;
          font-size: 13px;
          cursor: pointer;
        }

        .sidebar-footer-v2 {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .upgrade-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        .upgrade-content h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 4px;
        }

        .upgrade-content p {
          font-size: 12px;
          color: #6b7280;
          margin: 0 0 12px;
        }

        .upgrade-btn {
          width: 100%;
          padding: 8px;
          background: #111827;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .upgrade-btn:hover {
          background: #1f2937;
        }

        .user-profile-v2 {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          background: white;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          cursor: pointer;
        }

        .user-avatar-v2 {
          width: 28px;
          height: 28px;
          background: #111827;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .user-info-v2 {
          flex: 1;
          overflow: hidden;
        }

        .user-email-v2 {
          font-size: 12px;
          color: #111827;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Main Chat Area */
        .chat-layout {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          overflow: hidden;
          position: relative;
        }

        .chat-header-v2 {
          height: 64px;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #f3f4f6;
          background: #ffffff;
        }

        .header-brand-v2 {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--brand-color, #ed0000);
          cursor: pointer;
        }

        .brand-name-v2 {
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .plan-badge {
          font-size: 11px;
          color: #6b7280;
          margin-left: 4px;
        }

        .header-actions-v2 {
          display: flex;
          gap: 12px;
        }

        .header-action-btn-v2 {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: white;
          font-size: 13px;
          font-weight: 500;
          color: #4b5563;
          cursor: pointer;
        }

        .header-action-btn-v2:hover {
          background: #f9fafb;
        }

        /* Chat content */
        .chat-content-v2 {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 24px;
        }

        .chat-home-v2 {
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 60px;
          text-align: center;
        }

        .home-badge-v2 {
          background: #f3f4f6;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 24px;
        }

        .home-badge-v2 a {
          color: #111827;
          font-weight: 600;
          text-decoration: underline;
        }

        .home-greeting-wrapper-v2 {
          text-align: center;
          margin-bottom: 32px;
          animation: fadeInDown 0.8s ease-out;
        }

        .welcome-name-v2 {
          font-size: 18px;
          color: #6b7280;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .home-greeting-v2 {
          font-size: 38px;
          font-weight: 700;
          margin: 0;
          color: #111827;
          background: linear-gradient(135deg, #111827 0%, var(--brand-color, #ed0000) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .red-accent {
          color: var(--brand-color, #ed0000);
        }

        .suggestion-cards-top {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          width: 100%;
          margin-bottom: 32px;
        }

        .suggestion-card-v2 {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px;
          text-align: left;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }

        .suggestion-icon-wrapper {
          background: #fff5f5;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .suggestion-card-v2:hover {
          transform: translateY(-4px);
          border-color: var(--brand-color, #ed0000);
          box-shadow: 0 10px 15px -3px rgba(237, 0, 0, 0.1);
          background: #fffafa;
        }

        .suggestion-category {
          font-size: 11px;
          font-weight: 700;
          color: var(--brand-color, #ed0000);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        .suggestion-title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          line-height: 1.4;
        }

        .main-input-container-v2 {
          width: 100%;
          background: #ffffff;
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          margin-bottom: 16px;
          position: relative;
          z-index: 1;
        }

        .border-beam-svg {
          position: absolute;
          inset: -1px;
          width: calc(100% + 2px);
          height: calc(100% + 2px);
          pointer-events: none;
          z-index: 0;
          overflow: visible;
        }

        .border-beam-rect {
          fill: none;
          stroke-width: 2.5;
          stroke-dasharray: 300 2000;
          stroke-dashoffset: 0;
          animation: drawBeam 12s linear infinite;
          stroke-linecap: round;
        }

        @keyframes drawBeam {
          to {
            stroke-dashoffset: -2300;
          }
        }

        .conv-icon-container {
          position: relative;
          display: flex;
          align-items: center;
          margin-right: 12px;
          flex-shrink: 0;
        }

        .pin-indicator-icon-absolute {
          position: absolute;
          left: -14px;
          top: 0;
          color: var(--brand-color, #ed0000);
          animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3) rotate(-45deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        .pin-active-icon {
          color: var(--brand-color, #ed0000);
          margin-left: 8px;
          flex-shrink: 0;
        }

        .sidebar-footer-actions {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .dark-theme .sidebar-footer-actions {
          border-top-color: #333;
        }

        .theme-toggle-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          color: #4b5563;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .theme-toggle-btn:hover {
          background: #f3f4f6;
          border-radius: 10px;
        }

        /* DARK THEME (Grey/Dark Grey) */
        .dark-theme.ufl-root {
          background: #1a1a1a;
        }

        .dark-theme .sidebar {
          background: #1a1a1a;
          border-right-color: #333;
        }

        .dark-theme .chat-area-v2 {
          background: #242424;
        }

        .dark-theme .home-greeting-v2 {
          color: #f9fafb;
          background: none;
          -webkit-text-fill-color: initial;
        }

        .dark-theme .welcome-name-v2 {
          color: #9ca3af;
        }

        .dark-theme .suggestion-card-v2 {
          background: #2a2a2a;
          border-color: #3f3f3f;
        }

        .dark-theme .suggestion-title {
          color: #e5e7eb;
        }

        .dark-theme .main-input-container-v2 {
          background: #2a2a2a;
          border-color: #3f3f3f;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }

        .dark-theme .main-textarea-v2 {
          color: #f9fafb;
        }

        .dark-theme .sidebar-conversation-v2 {
          color: #9ca3af;
        }

        .dark-theme .sidebar-conversation-v2:hover {
          background: #333;
        }

        .dark-theme .sidebar-conversation-v2.active {
          background: #333;
          color: #f9fafb;
        }

        .dark-theme .logo-text {
          color: #f9fafb;
        }

        .dark-theme .new-chat-btn-v2 {
          background: #333;
          color: #f9fafb;
          border-color: #444;
        }

        .dark-theme .theme-toggle-btn {
          color: #9ca3af;
        }

        .dark-theme .sidebar-logout-btn {
          color: var(--brand-color, #ed0000);
        }

        .dark-theme .theme-toggle-btn:hover,
        .dark-theme .sidebar-logout-btn:hover {
          background: #333;
        }

        .dark-theme .modal-card-v2 {
          background: #242424;
          color: #f9fafb;
        }

        .dark-theme .modal-header-v2 h3 {
          color: #ffffff;
        }

        .dark-theme .modal-header-v2 p {
          color: #9ca3af;
        }
        
        .dark-theme .chat-header-v2 {
          background: #1a1a1a;
          border-bottom-color: #333;
        }

        .dark-theme .chat-layout {
          background: #1a1a1a;
        }

        .dark-theme .home-view-v2 {
          background: #1a1a1a;
          color: #f9fafb;
        }

        .dark-theme .recent-chats-section-v2 {
          border-top-color: #333;
        }

        .dark-theme .section-header-v2 {
          color: #9ca3af;
        }

        .dark-theme .recent-card-v2 {
          background: #2a2a2a;
          border-color: #3f3f3f;
        }

        .dark-theme .recent-card-title-v2 {
          color: #e5e7eb;
        }

        .dark-theme .collaborate-text-v2 {
          color: #9ca3af;
        }

        .dark-theme .user-profile-v2 {
          background: #2a2a2a;
          border-color: #3f3f3f;
          color: #f9fafb;
        }

        .dark-theme .user-email-v2 {
          color: #9ca3af;
        }

        .dark-theme .upgrade-card {
          background: #2a2a2a;
          border-color: #3f3f3f;
        }

        .dark-theme .upgrade-content h3 {
          color: #f9fafb;
        }

        .dark-theme .upgrade-content p {
          color: #9ca3af;
        }

        .dark-theme .upgrade-btn {
          background: #333;
          color: #f9fafb;
        }

        .dark-theme .footer-input-v2 {
          background: linear-gradient(180deg, transparent 0%, #1a1a1a 40%);
        }

        .dark-theme .footer-input-container-v2 {
          background: #2a2a2a;
          border-color: #3f3f3f;
        }

        .dark-theme .footer-textarea-v2 {
          background: transparent;
          color: #f9fafb;
        }

        .attached-files-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
          padding: 8px;
          border-bottom: 1px solid #f3f4f6;
        }

        .attached-file-chip {
          background: #f3f4f6;
          padding: 4px 10px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #4b5563;
        }

        .remove-file-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          padding: 0;
        }

        .remove-file-btn:hover {
          color: var(--brand-color, #ed0000);
        }

        .input-tool-btn.recording {
          background: #fee2e2;
          border-radius: 50%;
          animation: pulseRecording 1.5s infinite;
        }

        @keyframes pulseRecording {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(237, 0, 0, 0.4); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(237, 0, 0, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(237, 0, 0, 0); }
        }

        .input-toolbar-v2 {
          display: flex;
          margin-bottom: 12px;
        }

        .tool-icons-v2 {
          display: flex;
          gap: 12px;
          color: #9ca3af;
        }

        .main-textarea-v2 {
          width: 100%;
          border: none;
          resize: none;
          outline: none;
          font-size: 16px;
          color: #111827;
          background: transparent;
          min-height: 80px;
        }

        .input-footer-v2 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
        }

        .sidebar-logout-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          color: var(--brand-color, #ed0000);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 8px;
        }

        .sidebar-logout-btn:hover {
          background: rgba(237, 0, 0, 0.05);
          border-radius: 10px;
        }

        .send-btn-v2 {
          background: #f3f4f6;
          color: #9ca3af;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .send-btn-v2:not(:disabled) {
          background: var(--brand-color, #ed0000);
          color: white;
        }

        .input-tool-btn, .footer-tool-btn {
          background: transparent;
          border: none;
          color: #6b7280;
          font-size: 18px;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .input-tool-btn:hover, .footer-tool-btn:hover {
          background: #f3f4f6;
          color: var(--brand-color, #ed0000);
        }

        .input-toolbar-icons {
          display: flex;
          gap: 4px;
        }

        .collaborate-text-v2 {
          font-size: 13px;
          color: #9ca3af;
          margin-bottom: 40px;
        }

        .quick-actions-v2 {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          margin-bottom: 60px;
        }

        .quick-action-btn-v2 {
          padding: 8px 16px;
          border-radius: 20px;
          border: 1.5px dashed #e5e7eb;
          background: white;
          color: #4b5563;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quick-action-btn-v2:hover {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .recent-chats-section-v2 {
          width: 100%;
        }

        .section-header-v2 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 20px;
          cursor: pointer;
        }

        .recent-cards-v2 {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
          width: 100%;
        }

        .recent-card-v2 {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .recent-card-v2:hover {
          border-color: #d1d5db;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .recent-card-title-v2 {
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          height: 40px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .recent-card-time-v2 {
          font-size: 12px;
          color: #9ca3af;
        }

        /* Message view */
        .messages-container-v2 {
          flex: 1;
          overflow-y: auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 24px;
          padding-bottom: 220px;
          scroll-behavior: smooth;
        }

        .message-row-v2 {
          display: flex;
          gap: 12px;
          max-width: min(75%, 850px);
          animation: messageIn 0.3s ease-out forwards;
        }

        .message-row-v2.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .message-row-v2.assistant {
          align-self: flex-start;
        }

        .message-avatar-v2 {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
          overflow: hidden;
        }
        
        .bot-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .message-row-v2.user .message-avatar-v2 {
          background: #111827;
          color: white;
        }

        .message-row-v2.assistant .message-avatar-v2 {
          background: #f3f4f6;
        }

        .message-bubble-v2 {
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 15px;
          line-height: 1.5;
          position: relative;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .message-row-v2.user .message-bubble-v2 {
          background: var(--brand-color, #ed0000);
          color: white;
          border-bottom-right-radius: 2px;
        }

        .message-row-v2.assistant .message-bubble-v2 {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          color: #111827;
          border-bottom-left-radius: 2px;
        }

        .message-bubble-v2 p {
          margin: 0 0 8px;
        }

        .message-bubble-v2 p:last-child {
          margin-bottom: 0;
        }

        /* Dark Mode */
        .dark-theme .message-row-v2.assistant .message-bubble-v2 {
          background: #2a2a2a;
          border-color: #3f3f3f;
          color: #e5e7eb;
        }

        .dark-theme .message-row-v2.assistant .message-avatar-v2 {
          background: #333;
        }

        .typing-v2 {
          display: flex;
          gap: 4px;
          padding: 8px 0;
        }

        .dot-v2 {
          width: 6px;
          height: 6px;
          background: #9ca3af;
          border-radius: 50%;
          animation: dot-loading 1.4s infinite;
        }

        @keyframes dot-loading {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        .footer-input-v2 {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 24px;
          background: linear-gradient(180deg, transparent 0%, white 40%);
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 10;
        }

        .footer-input-container-v2 {
          width: 100%;
          max-width: 800px;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 24px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
          transition: all 0.2s;
        }

        .footer-input-container-v2:focus-within {
          border-color: var(--brand-color, #ed0000);
          box-shadow: 0 0 0 4px rgba(237, 0, 0, 0.05);
        }

        .footer-textarea-v2 {
          flex: 1;
          border: none;
          resize: none;
          outline: none;
          padding: 8px 0;
          font-size: 15px;
          max-height: 200px;
        }

        .footer-send-btn-v2 {
          background: var(--brand-color, #ed0000);
          color: white;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .footer-disclaimer-v2 {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 12px;
        }

        /* Sidebar toggle from header */
        .sidebar-toggle-btn-header {
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          margin-right: 12px;
        }

        /* Modal V2 */
        .modal-overlay-v2 {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: modalFadeIn 0.2s ease-out;
        }

        .modal-card-v2 {
          background: white;
          border-radius: 20px;
          padding: 32px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .modal-card-v2 h3 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 12px;
          color: #111827;
        }

        .modal-card-v2 p {
          font-size: 15px;
          color: #6b7280;
          line-height: 1.5;
          margin-bottom: 24px;
        }

        .modal-footer-v2 {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .modal-btn-v2 {
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .modal-btn-v2.primary {
          background: #111827;
          color: white;
        }

        .modal-btn-v2.primary.danger {
          background: var(--brand-color, #ed0000);
        }

        .modal-btn-v2.secondary {
          background: #f3f4f6;
          color: #4b5563;
        }

        .modal-btn-v2:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .modal-textarea-v2 {
          width: 100%;
          min-height: 120px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 20px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          outline: none;
        }

        .modal-textarea-v2:focus {
          border-color: var(--brand-color, #ed0000);
          box-shadow: 0 0 0 2px rgba(237, 0, 0, 0.1);
        }

        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @media (max-width: 768px) {
          .sidebar-toggle-btn-header {
            display: flex;
          }
          .header-actions-v2 {
            display: none;
          }
          .home-greeting-v2 {
            font-size: 24px;
          }
          .recent-cards-v2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      </div>
    </>
  );
};
