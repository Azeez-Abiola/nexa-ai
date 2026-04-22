import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  BiPaperPlane, BiPencil, BiHomeAlt, BiHistory, BiLibrary, BiGridAlt,
  BiUserCircle, BiCog, BiMessageSquareAdd, BiSearch, BiImage, BiCodeBlock,
  BiBoltCircle, BiShareAlt, BiHelpCircle, BiChevronDown,
  BiUpArrowAlt, BiMessageRounded, BiPlus, BiDotsHorizontalRounded,
  BiPaperclip, BiMicrophone, BiMoon, BiSun, BiCamera, BiCopy
} from "react-icons/bi";
import { MdPushPin, MdAutoAwesome } from "react-icons/md";
import { FiLogOut, FiDownload, FiTrash2, FiExternalLink } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { ChatGptStyleMenuIcon } from "./components/ChatGptStyleMenuIcon";
import { WebcamCaptureModal } from "./components/WebcamCaptureModal";
import { UserChatProfile } from "./UserChatProfile";
import { Admin } from "./Admin";
import { Login } from "./Login";
import { Home } from "./Home";
import NewLandingPage from "./landing";
import ContactPage from "./landing/ContactPage";
import PrivacyPage from "./landing/PrivacyPage";
import TermsPage from "./landing/TermsPage";
import { AcceptInvite } from "./AcceptInvite";
import { AcceptEmployeeInvite } from "./AcceptEmployeeInvite";
import SuperAdminMain from "./super-admin/SuperAdminMain";
import SuperAdminLogin from "./super-admin/pages/SuperAdminLogin";
import { parseMarkdown } from "./utils/parseMarkdown";
import LoginLoadingScreen from "./components/LoginLoadingScreen";
import { exportConversationToDocx, exportConversationToPdf, generateExportFilename } from "./utils/chatExport";
import { hexToHslSpace, DEFAULT_RING_HSL, normalizeHexToRrggbb } from "./lib/brandCss";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessageSource {
  documentId: string;
  title: string;
  documentType: string;
  version?: number;
  url?: string;
}

interface GeneratedDocument {
  url: string;
  filename: string;
  documentType: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  sources?: MessageSource[];
  generatedDocument?: GeneratedDocument;
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
  grade?: string;
  tenantLabel?: string;
  tenantContactEmail?: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantLogo?: string;
  tenantColor?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
}

type View = "chat" | "admin";

/** Document types for the chat “Files” picker (images use Camera / Photos). */
const CHAT_DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.ppt,.pptx,.ppt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function applyTenantBrandFromSession(tenantColor: string | undefined) {
  const brandHex = normalizeHexToRrggbb(tenantColor);
  document.documentElement.style.setProperty("--brand-color", brandHex);
  const ring = tenantColor?.trim() ? hexToHslSpace(brandHex) : DEFAULT_RING_HSL;
  document.documentElement.style.setProperty("--ring", ring);
  document.documentElement.style.setProperty("--sidebar-ring", ring);
  document.documentElement.style.setProperty("--primary", ring);
  if (tenantColor?.trim()) {
    document.documentElement.style.setProperty("--accent", ring);
    document.documentElement.style.setProperty("--accent-foreground", "0 0% 100%");
  } else {
    document.documentElement.style.setProperty("--accent", "0 85% 38%");
    document.documentElement.style.setProperty("--accent-foreground", "0 0% 100%");
  }
}

function resolveTenantLogoUrl(logo: string | undefined | null): string | null {
  if (!logo || !String(logo).trim()) return null;
  const s = String(logo).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const path = s.replace(/^\/logos\//, "");
  return base ? `${base}/logos/${path}` : `/logos/${path}`;
}

function buildUserChatHelpFaqs(orgDisplay: string) {
  const org = orgDisplay.trim();
  const here = org ? ` at ${org}` : "";
  return [
    {
      q: `What can Nexa help me with${here}?`,
      a: `You can ask everyday work questions, brainstorm, summarize text you paste or attach, and get suggestions. When it helps, Nexa may also use information your company has chosen to make available to the assistant.`,
    },
    {
      q: `How do I change my name or password?`,
      a: `Tap your name at the bottom of the sidebar to open Profile. From there you can update your display name and change your password.`,
    },
    {
      q: `What should I know about privacy?`,
      a: `Avoid sharing passwords, bank details, or highly personal information in chat. Your employer sets its own rules for workplace tools—if you are unsure what is appropriate, ask your manager or use Contact support below.`,
    },
  ];
}

export const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [conversationsHasMore, setConversationsHasMore] = useState(false);
  const [conversationsOffset, setConversationsOffset] = useState(0);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");

  // Textareas grow with their content (like ChatGPT/Claude) and reset cleanly after send.
  const autoGrowTextarea = (el: HTMLTextAreaElement | null, maxPx = 200) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxPx) + "px";
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  };
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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(() => localStorage.getItem("nexa-avatar") || "");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const attachMenuWrapRef = useRef<HTMLDivElement>(null);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAdminPage = location.pathname.startsWith('/admin');
  const isSuperAdminPage = location.pathname.startsWith('/super-admin');
  const isUserChatProfile = location.pathname === "/user-chat/profile";
  const isChatPage = location.pathname === "/user-chat";
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
        applyTenantBrandFromSession(userData.tenantColor);

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
            try {
              const { data } = await axios.get<{ user: User }>("/api/v1/auth/me");
              if (data?.user) {
                const merged = { ...userData, ...data.user };
                setUser(merged);
                localStorage.setItem("nexa-user", JSON.stringify(merged));
                applyTenantBrandFromSession(merged.tenantColor);
              }
            } catch {
              /* session still valid without refresh */
            }
            loadingStartTimeRef.current = Date.now();
            if (window.location.pathname === "/" || window.location.pathname === "/login") {
              window.history.replaceState(null, "", "/user-chat");
            }
            loadConversations(savedToken);
            if (!localStorage.getItem("nexa-avatar")) {
              setShowAvatarPicker(true);
            }
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
    } else if (isUserChatProfile) {
      document.title = "Nexa AI - Profile";
    } else if (isChatPage) {
      document.title = "Nexa AI - Chat";
    } else if (location.pathname === "/login") {
      document.title = "Nexa AI - Sign In";
    } else {
      document.title = "Nexa AI";
    }
  }, [isAdminPage, isSuperAdminPage, isChatPage, isUserChatProfile, location.pathname]);

  /** Employee chat + profile: keep CSS tokens aligned with BU branding (e.g. after GET /auth/me merge). */
  useEffect(() => {
    if (!isAuthenticated || !user || user.isAdmin === true) return;
    if (!isChatPage && !isUserChatProfile) return;
    applyTenantBrandFromSession(user.tenantColor);
  }, [isAuthenticated, user?.isAdmin, user?.tenantColor, user?.id, isChatPage, isUserChatProfile]);

  // Public/auth routes must never inherit a tenant's color — force the default red so a stale BU session
  // in localStorage can't bleed into the landing, login, invite-acceptance, or marketing sub-pages.
  useEffect(() => {
    const NEUTRAL_ROUTES = new Set([
      "/",
      "/login",
      "/super-admin/login",
      "/contact",
      "/privacy",
      "/terms",
      "/accept-invite",
      "/accept-employee-invite"
    ]);
    if (NEUTRAL_ROUTES.has(location.pathname)) applyTenantBrandFromSession(undefined);
  }, [location.pathname]);

  // Scroll to bottom when messages change or conversation changes
  useEffect(() => {
    scrollToBottom(true);
  }, [currentConversation?._id, currentConversation?.messages?.length]);

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
      const { data } = await axios.get<{ conversations: Conversation[]; total: number; hasMore: boolean }>(
        "/api/v1/conversations?limit=20&offset=0",
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setConversations(data.conversations);
      setConversationsHasMore(data.hasMore ?? false);
      setConversationsOffset(20);

      if (data.conversations.length > 0) {
        const savedConversationId = localStorage.getItem("lastConversationId");
        const lastConversation = savedConversationId
          ? data.conversations.find(c => c._id === savedConversationId)
          : null;
        setCurrentConversation(lastConversation || data.conversations[0]);
      }
    } catch (error) {
      console.error("Load conversations error:", error);
    } finally {
      const elapsedTime = Date.now() - (loadingStartTimeRef.current || Date.now());
      const remainingTime = Math.max(0, 3000 - elapsedTime);

      if (remainingTime > 0) {
        setTimeout(() => {
          setIsConversationsLoading(false);
          setTimeout(() => scrollToBottom(true), 100);
        }, remainingTime);
      } else {
        setIsConversationsLoading(false);
        setTimeout(() => scrollToBottom(true), 100);
      }
    }
  };

  async function loadMoreConversations() {
    if (!token || isLoadingMoreConversations || !conversationsHasMore) return;
    setIsLoadingMoreConversations(true);
    try {
      const { data } = await axios.get<{ conversations: Conversation[]; total: number; hasMore: boolean }>(
        `/api/v1/conversations?limit=20&offset=${conversationsOffset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConversations(prev => [...prev, ...data.conversations]);
      setConversationsHasMore(data.hasMore ?? false);
      setConversationsOffset(prev => prev + 20);
    } catch (error) {
      console.error("Load more conversations error:", error);
    } finally {
      setIsLoadingMoreConversations(false);
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
    } else if (authUser.isAdmin === true) {
      window.location.href = "/admin/dashboard";
    } else {
      window.history.pushState(null, "", "/user-chat");
      setIsConversationsLoading(true);
      axios.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
      applyTenantBrandFromSession(authUser.tenantColor);
      await loadConversations(authToken);
      if (!localStorage.getItem("nexa-avatar")) {
        setShowAvatarPicker(true);
      }
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
    setConversationsHasMore(false);
    setConversationsOffset(0);
    setCurrentConversation(null);
    delete axios.defaults.headers.common["Authorization"];
    setLogoutConfirmOpen(false);
    // `window.history.replaceState` bypasses React Router, so the neutral-route effect
    // keyed on `location.pathname` won't fire — reset brand inline to clear the BU color.
    applyTenantBrandFromSession(undefined);
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
    if (location.pathname === "/user-chat/profile") {
      navigate("/user-chat");
    }

    try {
      const { data } = await axios.post<{ conversation: Conversation }>(
        "/api/v1/conversations",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setConversations([data.conversation, ...conversations]);
      setCurrentConversation(data.conversation);
      setInput("");
      if (typeof window !== "undefined" && window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
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
        setCurrentConversation(null);
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
  const streamResponse = async (conversationId: string, userContent: string, files?: File[]): Promise<Conversation | null> => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const hasFiles = files && files.length > 0;

    let body: FormData | string;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (hasFiles) {
      const formData = new FormData();
      formData.append("message", userContent);
      files.forEach((f) => formData.append("files", f));
      body = formData;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ content: userContent });
    }

    const response = await fetch(
      `${apiBase}/api/v1/conversations/${conversationId}/message-stream`,
      { method: "POST", headers, body }
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
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
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
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          setInput(prev => prev + (prev ? ' ' : '') + event.results[i][0].transcript);
        }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files]);
      setAttachMenuOpen(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (photosInputRef.current) photosInputRef.current.value = "";
  };

  useEffect(() => {
    if (!attachMenuOpen) return;
    const onPointerDown = (ev: PointerEvent) => {
      const el = attachMenuWrapRef.current;
      if (el && !el.contains(ev.target as Node)) setAttachMenuOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setAttachMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [attachMenuOpen]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
    };
  }, []);

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const copyMessageText = async (text: string, messageIndex: number) => {
    const t = text.trim();
    if (!t || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(t);
      if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
      setCopiedMessageIndex(messageIndex);
      copyFeedbackTimerRef.current = setTimeout(() => {
        setCopiedMessageIndex(null);
        copyFeedbackTimerRef.current = null;
      }, 2000);
    } catch {
      // ignore
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    if (loading || !token) return;

    const filesToSend = [...attachedFiles];
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

      const fileLabel = filesToSend.length > 0 ? `\n📎 ${filesToSend.map(f => f.name).join(', ')}` : '';
      const userMsg: Message = { role: "user", content: (trimmed || '') + fileLabel, timestamp: new Date() };
      const updatedConv = { ...createData.data.conversation, messages: [userMsg] };
      setCurrentConversation(updatedConv);
      setLoading(true);

      // Stream AI response
      try {
        const finalConversation = await streamResponse(createData.data.conversation._id, trimmed, filesToSend);

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

    const fileLabel = filesToSend.length > 0 ? `\n📎 ${filesToSend.map(f => f.name).join(', ')}` : '';
    const userMsg: Message = { role: "user", content: (trimmed || '') + fileLabel, timestamp: new Date() };
    const updatedConv = { ...currentConversation, messages: [...currentConversation.messages, userMsg] };
    setCurrentConversation(updatedConv);
    setLoading(true);

    // Stream AI response
    try {
      const finalConversation = await streamResponse(currentConversation._id, trimmed, filesToSend);

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
  if (location.pathname === "/accept-employee-invite") {
    return <AcceptEmployeeInvite />;
  }

  if (location.pathname === "/contact") {
    return <ContactPage />;
  }
  if (location.pathname === "/privacy") {
    return <PrivacyPage />;
  }
  if (location.pathname === "/terms") {
    return <TermsPage />;
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

  // Skeleton loading inside the chat view handles this; no full-screen block needed.

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

  // /user-chat and /user-chat/profile — require authentication
  if (location.pathname === "/user-chat" || location.pathname === "/user-chat/profile") {
    if (!isAuthenticated) {
      window.history.replaceState(null, "", "/login");
      return <Login onLoginSuccess={handleLogin} />;
    }
    // Authenticated — render chat shell below
  }

  // Any other unmatched route for unauthenticated users → landing page
  if (!isAuthenticated) {
    return <NewLandingPage />;
  }

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const chatHeaderTenantLogoUrl = resolveTenantLogoUrl(user?.tenantLogo);

  const renderAttachPicker = (buttonClass: string) => (
    <div className="attach-menu-wrap" ref={attachMenuWrapRef}>
      <button
        type="button"
        className={buttonClass}
        title="Attach"
        aria-expanded={attachMenuOpen}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setAttachMenuOpen((o) => !o);
        }}
      >
        <BiPlus />
      </button>
      <AnimatePresence>
        {attachMenuOpen && (
          <motion.div
            role="menu"
            aria-label="Attachment options"
            className="attach-picker-popover"
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 440, damping: 32, mass: 0.65 }}
          >
            <button
              type="button"
              role="menuitem"
              className="attach-picker-item"
              onClick={() => {
                // Desktop: open an in-browser webcam modal so "Camera" actually opens the camera
                // instead of falling back to the OS file picker (the `capture=` attribute is ignored
                // on laptops). Mobile keeps the native capture flow which launches the device camera.
                const isDesktop =
                  typeof window !== "undefined" &&
                  window.matchMedia("(pointer: fine) and (hover: hover)").matches &&
                  !!navigator.mediaDevices?.getUserMedia;
                if (isDesktop) {
                  setAttachMenuOpen(false);
                  setWebcamOpen(true);
                } else {
                  cameraInputRef.current?.click();
                }
              }}
            >
              <span className="attach-picker-icon-circle">
                <BiCamera size={22} />
              </span>
              <span className="attach-picker-item-label">Camera</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="attach-picker-item"
              onClick={() => {
                photosInputRef.current?.click();
              }}
            >
              <span className="attach-picker-icon-circle">
                <BiImage size={22} />
              </span>
              <span className="attach-picker-item-label">Photos</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="attach-picker-item"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <span className="attach-picker-icon-circle">
                <BiPaperclip size={22} />
              </span>
              <span className="attach-picker-item-label">Files</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

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
                              // Jump back to the chat surface if the user is somewhere else
                              // (e.g. /user-chat/profile) — otherwise their click appears to do nothing.
                              if (location.pathname !== "/user-chat") navigate("/user-chat");
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
            {!isHistoryCollapsed && conversationsHasMore && (
              <button
                className="show-more-btn"
                onClick={loadMoreConversations}
                disabled={isLoadingMoreConversations}
              >
                <BiChevronDown size={18} />
                <span>{isLoadingMoreConversations ? "Loading..." : "Show more"}</span>
              </button>
            )}
          </div>

          <div className="sidebar-footer-actions">
            <button className="theme-toggle-btn" onClick={toggleTheme}>
              {theme === 'light' ? <BiMoon size={18} /> : <BiSun size={18} />}
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
            <button className="theme-toggle-btn" onClick={() => setShowAvatarPicker(true)}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  overflow: "hidden",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: "#f3f4f6",
                }}
              >
                <img
                  src={selectedAvatar || "/avatar-1.png"}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block" }}
                />
              </span>
              <span>Change AI avatar</span>
            </button>
            <button className="sidebar-logout-btn" onClick={() => setLogoutConfirmOpen(true)}>
              <FiLogOut size={18} />
              <span>Logout</span>
            </button>
          </div>

          <button
            type="button"
            className="user-profile-v2"
            onClick={() => {
              navigate("/user-chat/profile");
              if (typeof window !== "undefined" && window.innerWidth <= 768) {
                setSidebarOpen(false);
              }
            }}
            aria-label="Open profile settings"
          >
            <div className="user-avatar-v2">
              {userInitials || "U"}
            </div>
            <div className="user-info-v2">
              <div className="user-name-v2">{user?.fullName || "Account"}</div>
              <div className="user-email-v2">{user?.email}</div>
            </div>
          </button>
        </aside>

        {sidebarOpen ? (
          <div
            className="chat-sidebar-backdrop"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="chat-layout" onClick={() => {
          if (sidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 768) {
            setSidebarOpen(false);
          }
        }}>
          <header
            className="chat-header-v2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="header-left-v2">
              <button
                type="button"
                className="sidebar-toggle-btn-header"
                aria-label={sidebarOpen ? "Close conversation menu" : "Open conversation menu"}
                aria-expanded={sidebarOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSidebar();
                }}
              >
                <ChatGptStyleMenuIcon size={22} />
              </button>
            </div>
            <div
              className="header-brand-v2"
              aria-label={user?.tenantLabel || user?.businessUnit || "Nexa"}
            >
              {chatHeaderTenantLogoUrl ? (
                <img
                  src={chatHeaderTenantLogoUrl}
                  alt={user?.tenantLabel || user?.businessUnit || "Nexa"}
                  className="header-tenant-logo-v2"
                  width={36}
                  height={36}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
            </div>
            <div className="header-actions-v2">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="header-action-btn-v2" aria-label="Help and frequently asked questions">
                    <BiHelpCircle size={18} />
                    <span className="header-action-label-v2">Help</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className={cn(
                    "max-h-[min(70vh,28rem)] w-[min(calc(100vw-2rem),22rem)] overflow-y-auto rounded-xl p-0 shadow-lg",
                    theme === "dark"
                      ? "border border-[#3f3f3f] bg-[#2a2a2a] text-gray-100"
                      : "border border-slate-200 bg-white text-slate-900 shadow-md"
                  )}
                >
                  <DropdownMenuLabel
                    className={cn(
                      "px-3 py-2.5 text-xs font-bold uppercase tracking-wide",
                      theme === "dark" ? "text-gray-500" : "text-slate-500"
                    )}
                  >
                    {"Help & FAQ"}
                  </DropdownMenuLabel>
                  <div
                    className={cn(
                      "max-h-[min(52vh,20rem)] space-y-1.5 overflow-y-auto border-b px-2.5 pb-2.5",
                      theme === "dark" ? "border-[#3f3f3f]" : "border-slate-200"
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {user
                      ? buildUserChatHelpFaqs(user.tenantLabel || user.businessUnit || "").map((faq, i) => (
                          <details
                            key={i}
                            className={cn(
                              "group rounded-lg border px-2.5 py-2 text-left text-sm",
                              theme === "dark"
                                ? "border-[#3f3f3f] bg-[#1a1a1a]/90"
                                : "border-slate-200 bg-slate-50/90"
                            )}
                          >
                            <summary
                              className={cn(
                                "cursor-pointer list-none font-semibold outline-none [&::-webkit-details-marker]:hidden",
                                theme === "dark" ? "text-gray-100" : "text-slate-800"
                              )}
                            >
                              <span className="flex items-start justify-between gap-2">
                                <span className="min-w-0 flex-1 leading-snug">{faq.q}</span>
                                <BiChevronDown
                                  className={cn(
                                    "mt-0.5 h-4 w-4 shrink-0 transition-transform group-open:rotate-180",
                                    theme === "dark" ? "text-gray-500" : "text-slate-500"
                                  )}
                                />
                              </span>
                            </summary>
                            <p
                              className={cn(
                                "mt-2 border-t pt-2 text-xs leading-relaxed",
                                theme === "dark" ? "border-[#3f3f3f] text-gray-400" : "border-slate-200 text-slate-600"
                              )}
                            >
                              {faq.a}
                            </p>
                          </details>
                        ))
                      : null}
                  </div>
                  <div className={cn("p-2", theme === "dark" ? "" : "bg-white")}>
                    {user?.tenantContactEmail ? (
                      <DropdownMenuItem
                        asChild
                        className={cn(
                          "cursor-pointer rounded-lg font-bold",
                          theme === "dark" ? "focus:bg-[#333] focus:text-gray-100" : "text-slate-800 focus:bg-slate-100 focus:text-slate-900"
                        )}
                      >
                        <a
                          href={`mailto:${user.tenantContactEmail}?subject=${encodeURIComponent(`Nexa AI support — ${user.tenantLabel || user.businessUnit || ""}`)}&body=${encodeURIComponent(`Hi,\n\nI'm writing from Nexa AI (signed in as ${user.email}).\n\nPlease describe your question:\n\n`)}`}
                          className="flex w-full items-center justify-center gap-2 py-2.5"
                        >
                          Contact support
                        </a>
                      </DropdownMenuItem>
                    ) : (
                      <p
                        className={cn(
                          "px-2 py-2 text-center text-xs leading-relaxed",
                          theme === "dark" ? "text-gray-500" : "text-slate-600"
                        )}
                      >
                        Support email is not available here yet. Ask your manager or IT how to get help.
                      </p>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {isUserChatProfile && user ? (
            <UserChatProfile
              user={user}
              theme={theme}
              selectedAvatar={selectedAvatar}
              onAvatarChange={(path) => {
                setSelectedAvatar(path);
                localStorage.setItem("nexa-avatar", path);
              }}
              onUserUpdated={(next) => {
                setUser(next as User);
                localStorage.setItem("nexa-user", JSON.stringify(next));
              }}
              onBack={() => navigate("/user-chat")}
            />
          ) : (
          <>
          <section className="chat-content-v2">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handleFileAttach}
            />
            <input
              ref={photosInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleFileAttach}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={CHAT_DOCUMENT_ACCEPT}
              multiple
              style={{ display: "none" }}
              onChange={handleFileAttach}
            />
            {!(currentConversation?.messages?.length) && !loading ? (
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
                          {file.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(file)} alt="" className="attach-thumb" />
                          ) : null}
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
                    onChange={(e) => {
                      setInput(e.target.value);
                      autoGrowTextarea(e.target, 240);
                    }}
                    ref={(el) => {
                      if (el && !input) el.style.height = "";
                    }}
                    onKeyDown={handleKeyDown}
                    rows={3}
                  />
                  <div className="input-footer-v2">
                    <div className="input-toolbar-icons">
                      {renderAttachPicker("input-tool-btn")}
                      <div className={`voice-mic-frame-v2${isRecording ? " voice-mic-frame-v2--active" : ""}`}>
                        <button
                          className={`input-tool-btn ${isRecording ? 'recording' : ''}`}
                          onClick={startVoiceRecording}
                          title={isRecording ? "Stop dictation" : "Speak to type"}
                        >
                          <BiMicrophone style={{ color: isRecording ? 'var(--brand-color, #ed0000)' : 'inherit' }} />
                        </button>
                      </div>
                    </div>
                    <button
                      className="send-btn-v2"
                      onClick={handleSend}
                      disabled={(!input.trim() && attachedFiles.length === 0) || loading}
                    >
                      <BiUpArrowAlt size={24} />
                    </button>
                  </div>
                </div>

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

                <p className="footer-disclaimer-v2">
                  <img src="/1879-22.png" alt="" width={16} height={16} className="footer-disclaimer-logo-v2" />
                  <span>Powered by 1879 Tech Hub</span>
                </p>
              </div>
            ) : (
              <div className="messages-container-v2" ref={messagesContainerRef}>
                <div className="messages-thread-center-v2">
                  {(currentConversation?.messages ?? []).map((m, idx) => (
                    <div key={idx} className={`message-row-v2 ${m.role}`}>
                      {m.role === 'assistant' && (
                        <div className="message-avatar-v2">
                          <img src={selectedAvatar || "/avatar-1.png"} alt="Nexa" className="bot-avatar-img" />
                        </div>
                      )}
                      <div className="message-bubble-wrap-v2">
                        <div className="message-bubble-v2">
                          {m.imageUrls && m.imageUrls.length > 0 ? (
                            <div className="message-image-grid-v2">
                              {m.imageUrls.map((url, iIdx) => (
                                <a key={iIdx} href={url} target="_blank" rel="noreferrer">
                                  <img src={url} alt="Attached" className="message-image-v2" />
                                </a>
                              ))}
                            </div>
                          ) : null}
                          {m.content
                            ? m.content.split("\n").map((line, lIdx) => (
                                <p key={lIdx}>{parseMarkdown(line)}</p>
                              ))
                            : null}
                          {m.role === "assistant" && m.sources && m.sources.length > 0 ? (
                            <div className="message-sources-v2">
                              <span className="message-sources-label-v2">Sources</span>
                              {m.sources.map((s) => {
                                const content = (
                                  <>
                                    <span className="message-source-pill-icon-v2">
                                      <BiLibrary size={12} />
                                    </span>
                                    <span className="message-source-pill-title-v2">{s.title}</span>
                                    {typeof s.version === "number" && s.version > 0 ? (
                                      <span className="message-source-pill-version-v2">v{s.version}</span>
                                    ) : null}
                                  </>
                                );
                                return (
                                  <span
                                    key={s.documentId}
                                    className="message-source-pill-v2 message-source-pill-v2--static"
                                    title={`${s.title} (${s.documentType})`}
                                  >
                                    {content}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                          {m.role === "assistant" && m.generatedDocument ? (
                            <div className="generated-doc-download-v2">
                              <a
                                href={(() => {
                                  const u = m.generatedDocument!.url;
                                  if (u.startsWith("http://") || u.startsWith("https://")) return u;
                                  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
                                  return base ? `${base}${u}` : u;
                                })()}
                                download={m.generatedDocument.filename}
                                className="generated-doc-btn-v2"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                <span>{m.generatedDocument.filename}</span>
                              </a>
                            </div>
                          ) : null}
                        </div>
                        <div className="message-copy-stack-v2">
                          <button
                            type="button"
                            className="message-copy-btn-v2"
                            title="Copy message"
                            aria-label="Copy message"
                            onClick={() => void copyMessageText(m.content, idx)}
                          >
                            <BiCopy size={16} />
                          </button>
                          {copiedMessageIndex === idx ? (
                            <span className="message-copied-label-v2" role="status">
                              Copied
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="message-row-v2 assistant">
                      <div className="message-avatar-v2 message-avatar-thinking-v2">
                        <img src={selectedAvatar || "/avatar-1.png"} alt="Nexa" className="bot-avatar-img" />
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
              </div>
            )}
          </section>

          {((currentConversation?.messages?.length ?? 0) > 0 || loading) && (
            <footer className="footer-input-v2" onClick={(e) => e.stopPropagation()}>
              {attachedFiles.length > 0 && (
                <div className="footer-attached-preview">
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="attached-file-chip">
                      {file.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(file)} alt="" className="attach-thumb" />
                      ) : null}
                      <span className="file-name">{file.name}</span>
                      <button className="remove-file-btn" onClick={() => removeAttachedFile(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="footer-input-container-v2">
                {renderAttachPicker("footer-tool-btn")}
                <div className={`voice-mic-frame-v2${isRecording ? " voice-mic-frame-v2--active" : ""}`}>
                  <button
                    className={`footer-tool-btn ${isRecording ? 'recording' : ''}`}
                    onClick={startVoiceRecording}
                    title={isRecording ? "Stop dictation" : "Speak to type"}
                  >
                    <BiMicrophone style={{ color: isRecording ? 'var(--brand-color, #ed0000)' : 'inherit' }} />
                  </button>
                </div>
                <textarea
                  className="footer-textarea-v2"
                  placeholder="Send a message..."
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoGrowTextarea(e.target, 200);
                  }}
                  ref={(el) => {
                    if (el && !input) el.style.height = "";
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className="footer-send-btn-v2"
                  onClick={handleSend}
                  disabled={(!input.trim() && attachedFiles.length === 0) || loading}
                >
                  <BiUpArrowAlt size={20} />
                </button>
              </div>
              <p className="footer-disclaimer-v2">
                <img src="/1879-22.png" alt="" width={16} height={16} className="footer-disclaimer-logo-v2" />
                <span>Powered by 1879 Tech Hub</span>
              </p>
            </footer>
          )}
          </>
          )}
        </main>

        <WebcamCaptureModal
          open={webcamOpen}
          onClose={() => setWebcamOpen(false)}
          onCapture={(file) => setAttachedFiles((prev) => [...prev, file])}
        />

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

        {showAvatarPicker && (
          <div className="modal-overlay-v2" style={{ zIndex: 9999 }}>
            <div className="avatar-picker-modal">
              <div className="avatar-picker-header">
                <div className="avatar-picker-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <h3>Choose your AI avatar</h3>
                <p>Select the avatar you would like for your Nexa AI assistant.</p>
              </div>
              <div className="avatar-picker-grid">
                {["/avatar-1.png", "/avatar-2.png"].map((avatar) => (
                  <button
                    key={avatar}
                    className={`avatar-picker-option ${selectedAvatar === avatar ? "selected" : ""}`}
                    onClick={() => setSelectedAvatar(avatar)}
                  >
                    <img src={avatar} alt="AI avatar option" />
                    <span className="avatar-picker-label">{avatar === "/avatar-1.png" ? "Nexa" : "Nex"}</span>
                    {selectedAvatar === avatar && (
                      <div className="avatar-picker-check">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="avatar-picker-footer">
                <button
                  className="avatar-picker-confirm"
                  disabled={!selectedAvatar}
                  onClick={() => {
                    if (selectedAvatar) {
                      localStorage.setItem("nexa-avatar", selectedAvatar);
                      setShowAvatarPicker(false);
                    }
                  }}
                  style={{ background: `var(--brand-color, #ed0000)` }}
                >
                  Continue
                </button>
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
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
          border-right: 1px solid #e5e7eb;
          z-index: 50;
        }

        .chat-sidebar-backdrop {
          display: none;
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
          width: 100%;
          background: white;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          font: inherit;
          text-align: left;
          -webkit-tap-highlight-color: transparent;
        }

        .user-name-v2 {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dark-theme .user-name-v2 {
          color: #f9fafb;
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
          line-height: 1.4;
          margin-top: 2px;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: normal;
        }

        /* Main Chat Area */
        .chat-layout {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          overflow: hidden;
          position: relative;
          min-width: 0;
          min-height: 0;
        }

        .chat-header-v2 {
          height: 56px;
          padding: 0 16px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #f3f4f6;
          background: #ffffff;
          position: relative;
          z-index: 2;
        }

        @media (min-width: 640px) {
          .chat-header-v2 {
            height: 64px;
            padding: 0 24px;
          }
        }

        .header-left-v2 {
          display: flex;
          align-items: center;
          min-height: 44px;
          position: relative;
          z-index: 3;
        }

        .header-brand-v2 {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 0;
          color: var(--brand-color, #ed0000);
          cursor: pointer;
          pointer-events: none;
        }

        .header-tenant-logo-v2 {
          height: 40px;
          width: 40px;
          object-fit: contain;
          flex-shrink: 0;
          border-radius: 8px;
        }

        .brand-name-v2 {
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.02em;
          color: #111827;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: min(42vw, 200px);
        }

        @media (min-width: 640px) {
          .brand-name-v2 {
            max-width: min(36vw, 280px);
          }
        }

        .dark-theme .brand-name-v2 {
          color: #f9fafb;
        }

        .plan-badge {
          font-size: 11px;
          color: #6b7280;
          margin-left: 4px;
        }

        .header-actions-v2 {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
        }

        .header-action-label-v2 {
          display: inline;
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
          min-height: 40px;
        }

        .header-action-btn-v2:hover {
          background: #f9fafb;
        }

        /* Chat content */
        .chat-content-v2 {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          padding: 16px;
          min-height: 0;
        }

        @media (min-width: 640px) {
          .chat-content-v2 {
            padding: 24px;
          }
        }

        .chat-home-v2 {
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 24px;
          text-align: center;
        }

        @media (min-width: 640px) {
          .chat-home-v2 {
            padding-top: 48px;
          }
        }

        @media (min-width: 900px) {
          .chat-home-v2 {
            padding-top: 60px;
          }
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
          font-size: clamp(1.5rem, 5.5vw, 2.375rem);
          font-weight: 700;
          margin: 0;
          color: #111827;
          background: linear-gradient(135deg, #111827 0%, var(--brand-color, #ed0000) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1.15;
          padding: 0 4px;
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
          grid-template-columns: 1fr;
          gap: 12px;
          width: 100%;
          margin-bottom: 24px;
        }

        @media (min-width: 640px) {
          .suggestion-cards-top {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-bottom: 28px;
          }
        }

        @media (min-width: 900px) {
          .suggestion-cards-top {
            grid-template-columns: repeat(3, 1fr);
            margin-bottom: 32px;
          }
        }

        .suggestion-card-v2 {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
        }

        @media (min-width: 640px) {
          .suggestion-card-v2 {
            padding: 20px;
            gap: 16px;
          }
        }

        @media (min-width: 900px) {
          .suggestion-card-v2 {
            padding: 24px;
          }
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
          min-width: 0;
          background: #ffffff;
          border-radius: 16px;
          padding: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          margin-bottom: 12px;
          position: relative;
          z-index: 1;
        }

        @media (min-width: 640px) {
          .main-input-container-v2 {
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 16px;
          }
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

        .dark-theme .header-action-btn-v2 {
          background: #262626;
          border-color: #404040;
          color: #e5e7eb;
        }

        .dark-theme .header-action-btn-v2:hover {
          background: #333;
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
          background: #262626;
          border-color: #404040;
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

        .attach-thumb {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          object-fit: cover;
          flex-shrink: 0;
        }

        .footer-attached-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 8px 12px 0;
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
          min-width: 0;
          border: none;
          resize: none;
          outline: none;
          font-size: 16px;
          color: #111827;
          background: transparent;
          min-height: 72px;
        }

        @media (min-width: 640px) {
          .main-textarea-v2 {
            min-height: 80px;
          }
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

        .attach-menu-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .attach-picker-popover {
          position: absolute;
          bottom: calc(100% + 12px);
          left: 0;
          right: auto;
          min-width: min(224px, calc(100vw - 24px));
          max-width: calc(100vw - 24px);
          padding: 4px;
          background: #ffffff;
          border-radius: 18px;
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06);
          border: 1px solid rgba(226, 232, 240, 0.95);
          z-index: 200;
          transform-origin: bottom left;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .footer-input-container-v2 .attach-menu-wrap .attach-picker-popover {
          left: auto;
          right: 0;
          transform-origin: bottom right;
        }

        /* On phone-width screens, the popover should feel like a bottom sheet: full viewport width,
           pinned above the input, with the picker options comfortably tappable. */
        @media (max-width: 640px) {
          .attach-picker-popover {
            position: fixed;
            left: 12px;
            right: 12px;
            bottom: calc(env(safe-area-inset-bottom, 0px) + 92px);
            width: auto;
            min-width: 0;
            max-width: none;
            padding: 6px;
            border-radius: 18px;
          }
          .footer-input-container-v2 .attach-menu-wrap .attach-picker-popover {
            left: 12px;
            right: 12px;
          }
          .attach-picker-item {
            padding: 10px 10px;
            font-size: 15px;
          }
        }

        /* Match the rest of the app's dark mode (chat area #242424, cards #2a2a2a / #3f3f3f borders)
           so the popover doesn't read as a different palette. */
        .dark-theme .attach-picker-popover {
          background: #2a2a2a;
          border-color: #3f3f3f;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
        }

        .attach-picker-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          border: none;
          background: transparent;
          padding: 8px 10px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          text-align: left;
          transition: background 0.15s ease;
        }

        .dark-theme .attach-picker-item {
          color: #f9fafb;
        }

        .attach-picker-item:hover {
          background: #f1f5f9;
        }

        .dark-theme .attach-picker-item:hover {
          background: #3a3a3a;
        }

        .attach-picker-icon-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #0f172a;
        }

        .attach-picker-icon-circle svg {
          width: 18px;
          height: 18px;
        }

        .dark-theme .attach-picker-icon-circle {
          background: #3a3a3a;
          color: #f9fafb;
        }

        .attach-picker-item-label {
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .collaborate-text-v2 {
          font-size: 13px;
          color: #9ca3af;
          margin-bottom: 28px;
          max-width: 36rem;
          padding: 0 4px;
          line-height: 1.45;
        }

        @media (min-width: 640px) {
          .collaborate-text-v2 {
            margin-bottom: 40px;
          }
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
          grid-template-columns: 1fr;
          gap: 12px;
          width: 100%;
        }

        @media (min-width: 520px) {
          .recent-cards-v2 {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
          }
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

        /* Message view — outer scroll; inner column centered with side margins */
        .messages-container-v2 {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          width: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 12px clamp(8px, 2vw, 28px) 16px;
          padding-bottom: 200px;
          scroll-behavior: smooth;
        }

        @media (min-width: 640px) {
          .messages-container-v2 {
            padding: 20px clamp(12px, 3vw, 28px);
            padding-bottom: 220px;
          }
        }

        .messages-thread-center-v2 {
          width: 100%;
          max-width: min(880px, 100%);
          margin-inline: auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .message-row-v2 {
          display: flex;
          gap: 12px;
          max-width: 100%;
          width: 100%;
          animation: messageIn 0.3s ease-out forwards;
        }

        .message-row-v2.user {
          align-self: flex-end;
          flex-direction: row-reverse;
          width: fit-content;
          max-width: 100%;
        }

        .message-row-v2.assistant {
          align-self: flex-start;
          width: fit-content;
          max-width: 100%;
        }

        .message-bubble-wrap-v2 {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          max-width: 100%;
        }

        .message-row-v2.user .message-bubble-wrap-v2 {
          align-items: flex-end;
        }

        .message-copy-stack-v2 {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          min-height: 22px;
        }

        .message-row-v2.user .message-copy-stack-v2 {
          align-items: center;
        }

        .message-copied-label-v2 {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #64748b;
          animation: copiedFade 0.2s ease-out;
        }

        .dark-theme .message-copied-label-v2 {
          color: #94a3b8;
        }

        @keyframes copiedFade {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message-copy-btn-v2 {
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 8px;
          line-height: 0;
          opacity: 0;
          transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
        }

        .message-row-v2:hover .message-copy-btn-v2 {
          opacity: 1;
        }

        @media (hover: none) {
          .message-copy-btn-v2 {
            opacity: 0.5;
          }
        }

        .message-copy-btn-v2:hover {
          color: var(--brand-color, #ed0000);
          background: rgba(15, 23, 42, 0.06);
        }

        .dark-theme .message-copy-btn-v2:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .voice-mic-frame-v2 {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border-radius: 9999px;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease, padding 0.25s ease;
          border: 2px solid transparent;
        }

        .voice-mic-frame-v2--active {
          padding: 2px;
          border-color: var(--brand-color, #ed0000);
          background-color: color-mix(in srgb, var(--brand-color, #ed0000) 14%, transparent);
          box-shadow:
            0 0 0 4px color-mix(in srgb, var(--brand-color, #ed0000) 22%, transparent),
            0 0 26px color-mix(in srgb, var(--brand-color, #ed0000) 38%, transparent);
          animation: voiceFramePulse 1.4s ease-in-out infinite;
        }

        @keyframes voiceFramePulse {
          0%, 100% {
            box-shadow:
              0 0 0 3px color-mix(in srgb, var(--brand-color, #ed0000) 20%, transparent),
              0 0 18px color-mix(in srgb, var(--brand-color, #ed0000) 32%, transparent);
          }
          50% {
            box-shadow:
              0 0 0 8px color-mix(in srgb, var(--brand-color, #ed0000) 12%, transparent),
              0 0 32px color-mix(in srgb, var(--brand-color, #ed0000) 48%, transparent);
          }
        }

        .message-avatar-v2 {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
          align-self: flex-start;
          overflow: hidden;
        }

        @media (min-width: 640px) {
          .message-avatar-v2 {
            width: 48px;
            height: 48px;
          }
        }
        
        .bot-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center center;
          display: block;
        }

        .message-row-v2.user .message-avatar-v2 {
          background: #111827;
          color: white;
        }

        .message-row-v2.assistant .message-avatar-v2 {
          background: #f3f4f6;
        }

        .message-bubble-v2 {
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 15px;
          line-height: 1.5;
          position: relative;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          max-width: min(100%, calc(100vw - 5.5rem));
          word-break: break-word;
        }

        @media (min-width: 640px) {
          .message-bubble-v2 {
            padding: 12px 16px;
            max-width: 100%;
          }
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

        .message-sources-v2 {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
        }
        .dark-theme .message-sources-v2 {
          border-top-color: rgba(255, 255, 255, 0.08);
        }
        .message-sources-label-v2 {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
          margin-right: 4px;
        }
        .message-source-pill-v2 {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
          background: color-mix(in srgb, var(--brand-color, #ed0000) 10%, #fff);
          color: var(--brand-color, #ed0000);
          border: 1px solid color-mix(in srgb, var(--brand-color, #ed0000) 22%, transparent);
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          max-width: 100%;
        }
        .message-source-pill-v2:hover {
          background: color-mix(in srgb, var(--brand-color, #ed0000) 18%, #fff);
          transform: translateY(-1px);
        }
        .message-source-pill-v2--static { cursor: default; }
        .message-source-pill-v2--static:hover { transform: none; }
        .dark-theme .message-source-pill-v2 {
          background: color-mix(in srgb, var(--brand-color, #ed0000) 18%, #1f1f1f);
          border-color: color-mix(in srgb, var(--brand-color, #ed0000) 35%, transparent);
          color: #fff;
        }
        .dark-theme .message-source-pill-v2:hover {
          background: color-mix(in srgb, var(--brand-color, #ed0000) 28%, #1f1f1f);
        }
        .message-source-pill-icon-v2 {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--brand-color, #ed0000) 25%, transparent);
          color: inherit;
        }
        .message-source-pill-title-v2 {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .message-source-pill-version-v2 {
          font-size: 10px;
          font-weight: 700;
          opacity: 0.75;
          letter-spacing: 0.02em;
        }

        /* Generated document download chip */
        .generated-doc-download-v2 {
          margin-top: 10px;
        }
        .generated-doc-btn-v2 {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          border-radius: 8px;
          background: var(--brand-color, #ed0000);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: opacity 0.15s;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .generated-doc-btn-v2:hover { opacity: 0.85; }
        .dark-theme .generated-doc-btn-v2 { background: var(--brand-color, #ed0000); }

        .message-image-grid-v2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 6px;
          margin-bottom: 8px;
        }
        .message-image-v2 {
          width: 100%;
          max-height: 260px;
          object-fit: cover;
          border-radius: 12px;
          display: block;
          cursor: zoom-in;
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

        .message-avatar-thinking-v2 img {
          animation: thinkingAvatarPulse 1.25s ease-in-out infinite;
        }

        @keyframes thinkingAvatarPulse {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.88; filter: brightness(0.95); }
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
          padding: 12px 12px max(12px, env(safe-area-inset-bottom, 0px));
          background: linear-gradient(180deg, transparent 0%, white 40%);
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 10;
        }

        @media (min-width: 640px) {
          .footer-input-v2 {
            padding: 20px 24px 24px;
          }
        }

        .footer-input-container-v2 {
          width: 100%;
          max-width: 800px;
          min-width: 0;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 20px;
          padding: 6px 10px;
          display: flex;
          align-items: center;
          gap: 2px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
          transition: all 0.2s;
        }

        @media (min-width: 640px) {
          .footer-input-container-v2 {
            border-radius: 24px;
            padding: 8px 16px;
            gap: 4px;
          }
        }

        .footer-input-container-v2:focus-within {
          border-color: var(--brand-color, #ed0000);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand-color, #ed0000) 14%, transparent);
        }

        .footer-textarea-v2 {
          flex: 1;
          min-width: 0;
          border: none;
          resize: none;
          outline: none;
          padding: 8px 4px;
          font-size: 16px;
          max-height: 160px;
          line-height: 1.45;
        }

        @media (min-width: 640px) {
          .footer-textarea-v2 {
            font-size: 15px;
            padding: 8px 0;
            max-height: 200px;
          }
        }

        .footer-send-btn-v2 {
          background: var(--brand-color, #ed0000);
          color: white;
          border: none;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        @media (min-width: 640px) {
          .footer-send-btn-v2 {
            width: 36px;
            height: 36px;
          }
        }

        .footer-disclaimer-v2 {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          margin-top: 12px;
        }

        .footer-disclaimer-logo-v2 {
          object-fit: contain;
          flex-shrink: 0;
          opacity: 0.9;
        }

        .chat-sidebar-powered-v2 {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 12px;
          padding: 10px 8px 4px;
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          border-top: 1px solid #f3f4f6;
        }

        .chat-sidebar-powered-v2 img {
          object-fit: contain;
          opacity: 0.85;
        }

        .dark-theme .chat-sidebar-powered-v2 {
          border-top-color: #3f3f3f;
          color: #9ca3af;
        }

        .dark-theme .footer-disclaimer-v2 {
          color: #9ca3af;
        }

        /* Sidebar toggle from header (mobile-first: hidden on wide screens) */
        .sidebar-toggle-btn-header {
          display: none;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          margin: 0;
          padding: 0;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #6b7280;
          cursor: pointer;
          position: relative;
          z-index: 4;
          flex-shrink: 0;
        }

        .sidebar-toggle-btn-header:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .dark-theme .sidebar-toggle-btn-header:hover {
          background: #333;
          color: #f9fafb;
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
          /* Must sit above the mobile sidebar (z-index 1050) and its backdrop (1040) so confirmation
             dialogs (e.g. Sign out) aren't hidden behind the drawer when it's open. */
          z-index: 1100;
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

        .avatar-picker-modal {
          background: white;
          border-radius: 24px;
          padding: 40px 36px 32px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.2);
          animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: center;
        }

        .avatar-picker-header {
          margin-bottom: 32px;
        }

        .avatar-picker-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--brand-color, #ed0000), #ff4444);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          color: white;
        }

        .avatar-picker-header h3 {
          font-size: 22px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }

        .avatar-picker-header p {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }

        .avatar-picker-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 28px;
        }

        .avatar-picker-option {
          position: relative;
          border: 2px solid #e5e7eb;
          border-radius: 20px;
          padding: 24px 16px 16px;
          cursor: pointer;
          background: #fafafa;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .avatar-picker-option:hover {
          border-color: #d1d5db;
          background: #f5f5f5;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.08);
        }

        .avatar-picker-option.selected {
          border-color: var(--brand-color, #ed0000);
          background: white;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-color, #ed0000) 15%, transparent), 0 8px 25px -5px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }

        .avatar-picker-option img {
          width: 120px;
          height: 120px;
          object-fit: contain;
          border-radius: 16px;
        }

        .avatar-picker-label {
          font-size: 15px;
          font-weight: 600;
          color: #374151;
        }

        .avatar-picker-option.selected .avatar-picker-label {
          color: var(--brand-color, #ed0000);
        }

        .avatar-picker-check {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--brand-color, #ed0000);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: checkPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes checkPop {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }

        .avatar-picker-footer {
          display: flex;
          justify-content: center;
        }

        .avatar-picker-confirm {
          width: 100%;
          padding: 14px 32px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          color: white;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.3px;
        }

        .avatar-picker-confirm:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px -4px rgba(0, 0, 0, 0.2);
        }

        .avatar-picker-confirm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dark .avatar-picker-modal {
          background: #1e1e1e;
        }

        .dark .avatar-picker-header h3 {
          color: #f3f4f6;
        }

        .dark .avatar-picker-header p {
          color: #9ca3af;
        }

        .dark .avatar-picker-option {
          border-color: #374151;
          background: #262626;
        }

        .dark .avatar-picker-option:hover {
          border-color: #4b5563;
          background: #2a2a2a;
        }

        .dark .avatar-picker-option.selected {
          background: #1e1e1e;
        }

        .dark .avatar-picker-label {
          color: #d1d5db;
        }

        @media (max-width: 768px) {
          .ufl-root {
            position: relative;
          }

          .chat-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 1040;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(2px);
            -webkit-tap-highlight-color: transparent;
          }

          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            height: 100dvh;
            max-height: 100dvh;
            width: min(288px, 88vw);
            z-index: 1050;
            transform: translateX(-102%);
            box-shadow: none;
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
          }

          .sidebar.sidebar-open {
            transform: translateX(0);
            box-shadow: 8px 0 32px rgba(0, 0, 0, 0.12);
          }

          .sidebar-toggle-btn-header {
            display: flex;
          }

          .header-action-label-v2 {
            display: none;
          }

          .header-action-btn-v2 {
            padding: 10px;
            min-width: 44px;
            min-height: 44px;
            justify-content: center;
          }

          .messages-container-v2 {
            padding-bottom: max(200px, 28vh);
          }

          .input-tool-btn,
          .footer-tool-btn {
            min-width: 44px;
            min-height: 44px;
            padding: 10px;
          }

          .send-btn-v2 {
            width: 40px;
            height: 40px;
            flex-shrink: 0;
          }

          .modal-overlay-v2 {
            padding: 12px;
          }

          .modal-card-v2 {
            padding: 24px 20px;
            max-height: min(88dvh, 640px);
            overflow-y: auto;
          }

          .avatar-picker-modal {
            padding: 28px 20px 24px;
            max-width: min(360px, calc(100vw - 24px));
          }
          .avatar-picker-option img {
            width: 90px;
            height: 90px;
          }
        }

      `}</style>
      </div>
    </>
  );
};
