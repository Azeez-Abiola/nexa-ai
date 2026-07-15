import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  BiPaperPlane, BiPencil, BiHomeAlt, BiHistory, BiLibrary, BiGridAlt,
  BiUserCircle, BiCog, BiMessageSquareAdd, BiSearch, BiImage, BiCodeBlock,
  BiBoltCircle, BiShareAlt, BiHelpCircle, BiChevronDown,
  BiUpArrowAlt, BiMessageRounded, BiPlus, BiDotsHorizontalRounded,
  BiPaperclip, BiMicrophone, BiMoon, BiSun, BiCamera, BiCopy, BiCheck, BiLink, BiReply, BiSmile, BiX
} from "react-icons/bi";
import { MdPushPin, MdAutoAwesome, MdCreateNewFolder, MdFolder, MdFolderOpen } from "react-icons/md";
import { FiLogOut, FiDownload, FiTrash2, FiExternalLink, FiFileText } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { ChatGptStyleMenuIcon } from "./components/ChatGptStyleMenuIcon";
import { WebcamCaptureModal } from "./components/WebcamCaptureModal";
import { ReactionEmojiPicker } from "./chat/ReactionEmojiPicker";
import { PROFILE_PIC_PROMPT_STORAGE_KEY } from "./chat/reactionEmojis";
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
import RateLimitBanner, { type RateLimitInfo } from "./chat/RateLimitBanner";
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
  messageId?: string;
  replyTo?: MessageReplyTo;
  reactions?: MessageReaction[];
  senderId?: string;
  senderName?: string;
  imageUrls?: string[];
  sources?: MessageSource[];
  generatedDocument?: GeneratedDocument;
  timestamp: Date;
  /** Set on shared-with-me view when the recipient lacks access to the cited sources. */
  redacted?: boolean;
}

interface Conversation {
  _id: string;
  title: string;
  messages: Message[];
  pinnedMessage?: PinnedMessage;
  createdAt: string;
  updatedAt: string;
  /** True when this conversation has multiple participants (group chat). */
  isCollaborative?: boolean;
  /** True when viewing a conversation shared with this user — input is hidden and edits are disabled. */
  isShared?: boolean;
  /** When isShared, who shared it. */
  sharedBy?: { userId?: string; fullName?: string; email?: string };
  /** Number of messages hidden from this recipient by the access redactor. */
  redactedMessageCount?: number;
}

interface ConversationFolder {
  _id: string;
  name: string;
  conversationIds: string[];
}

interface SharedConversation {
  shareId: string;
  sharedAt: string;
  sharedBy: { userId?: string; fullName?: string; email?: string };
  /** True when the share scopes a single AI response within the conversation. */
  singleMessage?: boolean;
  conversation: {
    _id: string;
    title: string;
    messages: Message[];
    createdAt: string;
    updatedAt: string;
  };
  redactedMessageCount?: number;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  businessUnit: string;
  grade?: string;
  profilePicture?: string | null;
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

/**
 * Document types for the chat “Files” picker (images use Camera / Photos).
 * Kept in sync with the backend's ALLOWED_MIME_TYPES so users don't hit an opaque
 * 400. Legacy binary .doc/.ppt are intentionally excluded (the backend parsers
 * only read the modern OOXML formats); legacy .xls IS supported via SheetJS.
 */
const CHAT_DOCUMENT_ACCEPT =
  ".pdf,.docx,.txt,.csv,.xlsx,.xls,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv";

/** Extensions the backend can actually parse (documents + images). */
const SUPPORTED_UPLOAD_EXTENSIONS = [
  "pdf", "docx", "txt", "csv", "xlsx", "xls", "pptx",
  "jpg", "jpeg", "png", "gif", "webp",
];
/** Must match backend defaults in rateLimiter/multer config. */
const MAX_UPLOAD_FILE_SIZE_MB = 10;
const MAX_UPLOAD_FILES_PER_MESSAGE = 5;

/** Special id for @Nexa AI in group conversation mention autocomplete. */
const NEXA_AI_ID = "__nexa_ai__";
const NEXA_AI_MENTION = "Nexa AI";
const NEXA_MENTION_RE = /@nexa(\s+ai)?/i;
interface MessageReplyTo {
  messageId: string;
  senderName?: string;
  content: string;
}

interface MessageReaction {
  userId: string;
  userName: string;
  emoji: string;
}

interface PinnedMessage {
  messageId: string;
  content: string;
  senderName?: string;
  pinnedBy?: string;
  pinnedAt?: string;
}

function formatCollabTypingLabel(typers: { name: string }[]): string {
  const names = typers.map((t) => t.name.split(/\s+/)[0] || t.name);
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]} and ${names.length - 1} others are typing…`;
}

function messageSnippet(content: string, max = 120): string {
  const clean = (content || "").split("\n").filter((l) => !l.startsWith("📎")).join(" ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function splitAttachedFiles(files: File[]) {
  const images = files.filter((f) => f.type.startsWith("image/"));
  const documents = files.filter((f) => !f.type.startsWith("image/"));
  return { images, documents };
}

/** Build optimistic attachment metadata — documents use 📎 lines; images use imageUrls. */
function buildAttachmentMeta(files: File[]) {
  const { images, documents } = splitAttachedFiles(files);
  const fileLabel =
    documents.length > 0 ? `\n📎 ${documents.map((f) => f.name).join(", ")}` : "";
  const imageUrls =
    images.length > 0 ? images.map((f) => URL.createObjectURL(f)) : undefined;
  return { fileLabel, imageUrls };
}

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
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
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

  // Conversation sharing
  const [shareModalConvId, setShareModalConvId] = useState<string | null>(null);
  /** When set alongside shareModalConvId, the modal shares a single AI response at this index instead of the whole chat. */
  const [shareMessageIndex, setShareMessageIndex] = useState<number | null>(null);
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareError, setShareError] = useState("");
  const [sharedConversations, setSharedConversations] = useState<SharedConversation[]>([]);
  const [isSharedSectionCollapsed, setIsSharedSectionCollapsed] = useState(false);
  // Share link state — token, URL, copy feedback, and link-fetch loading.
  const [shareLinkUrl, setShareLinkUrl] = useState<string>("");
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const shareLinkCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<{ title: string; category: string; prompt: string }[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [accessRequestStatus, setAccessRequestStatus] = useState<Record<string, 'idle'|'pending'|'accepted'|'rejected'>>({});

  // @mention state
  const [buUsers, setBuUsers] = useState<{_id: string; fullName: string; email: string; profilePicture?: string | null; isAdmin?: boolean}[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  // Index of the highlighted option in the @mention autocomplete dropdown (keyboard nav).
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [pendingMentions, setPendingMentions] = useState<{userId: string; name: string}[]>([]);
  const [mentionedConversations, setMentionedConversations] = useState<{mentionId: string; mentionerName: string; conversation: Conversation; participants?: {id: string; name: string; profilePicture?: string | null}[]}[]>([]);
  const [isSharedConvCollapsed, setIsSharedConvCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingPingRef = useRef(0);
  const [collaborativeTypers, setCollaborativeTypers] = useState<{ userId: string; name: string }[]>([]);
  const [replyTarget, setReplyTarget] = useState<{ messageId: string; senderName?: string; snippet: string } | null>(null);
  const [messageMenu, setMessageMenu] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [reactPickerAnchor, setReactPickerAnchor] = useState<{
    msgId: string;
    messageIdx: number;
    x: number;
    y: number;
  } | null>(null);

  const [folders, setFolders] = useState<ConversationFolder[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderSubMenuConvId, setFolderSubMenuConvId] = useState<string | null>(null);

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
  // Screen-fixed anchor for the currently open conversation/folder kebab dropdown.
  // Using fixed positioning lets the dropdown escape the sidebar's scroll container
  // (overflow:auto) and the footer, which were clipping/covering it.
  const [menuAnchor, setMenuAnchor] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
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
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"gpt" | "claude" | "kimi" | "deepseek">("gpt");
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [softToastMessage, setSoftToastMessage] = useState<string | null>(null);
  const [profilePicPromptOpen, setProfilePicPromptOpen] = useState(false);
  const [profilePicUploading, setProfilePicUploading] = useState(false);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const [imageLightboxUrl, setImageLightboxUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(() => localStorage.getItem("nexa-avatar") || "");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const attachMenuWrapRef = useRef<HTMLDivElement>(null);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const softToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Aborts the in-flight streaming generation when the user hits "stop".
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAdminPage = location.pathname.startsWith('/admin');
  const isSuperAdminPage = location.pathname.startsWith('/super-admin');
  const isUserChatProfile = location.pathname === "/user-chat/profile";
  const isChatPage = location.pathname === "/user-chat";
  const userInitials = user
    ? `${user.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || ""}`
    : "";

  // Initials fallback for any display name (used when no profile picture is set).
  const initialsOf = (name?: string | null) =>
    (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Small circular avatar (picture or initials) for sidebar shared/group entries.
  const renderMiniAvatar = (
    person: { name?: string | null; profilePicture?: string | null },
    key?: React.Key
  ) =>
    person.profilePicture ? (
      <img
        key={key}
        className="mini-avatar"
        src={person.profilePicture}
        alt={person.name || ''}
        title={person.name || ''}
      />
    ) : (
      <span key={key} className="mini-avatar mini-avatar--initials" title={person.name || ''}>
        {initialsOf(person.name)}
      </span>
    );

  // Map of userId → profile picture for quickly resolving avatars of message senders
  // and mentions. Includes the current user so their own avatar renders too.
  const avatarById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const u of buUsers) {
      if (u.profilePicture) map.set(String(u._id), u.profilePicture);
    }
    if (user?.id && user.profilePicture) map.set(String(user.id), user.profilePicture);
    return map;
  }, [buUsers, user?.id, user?.profilePicture]);

  const isActiveGroupChat = React.useMemo(() => {
    if (!currentConversation || currentConversation.isShared) return false;
    if (currentConversation.isCollaborative) return true;
    if (mentionedConversations.some((m) => String(m.conversation._id) === currentConversation._id)) return true;
    if (pendingMentions.length > 0) return true;
    return (currentConversation.messages ?? []).some(
      (m) => m.senderId && String(m.senderId) !== String(user?.id)
    );
  }, [currentConversation, mentionedConversations, pendingMentions.length, user?.id]);

  const canOpenMessageMenu = Boolean(currentConversation && !currentConversation.isShared);

  const refreshCurrentConversation = useCallback(async (convId?: string) => {
    const id = convId || currentConversation?._id;
    if (!token || !id) return null;
    try {
      const { data } = await axios.get<{ conversation: Conversation; isCollaborative?: boolean }>(
        `/api/v1/conversations/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentConversation((prev) =>
        prev && prev._id === id
          ? {
              ...prev,
              messages: data.conversation.messages,
              pinnedMessage: data.conversation.pinnedMessage ?? undefined,
              updatedAt: data.conversation.updatedAt,
              isCollaborative: data.isCollaborative ?? prev.isCollaborative,
            }
          : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c._id === id
            ? {
                ...c,
                messages: data.conversation.messages,
                pinnedMessage: data.conversation.pinnedMessage ?? undefined,
                updatedAt: data.conversation.updatedAt,
              }
            : c
        )
      );
      return data.conversation;
    } catch {
      return null;
    }
  }, [token, currentConversation?._id]);

  // Load full conversation (messageIds, pinned state) when opening a chat.
  useEffect(() => {
    if (!token || !currentConversation?._id || currentConversation.isShared) return;
    void refreshCurrentConversation(currentConversation._id);
  }, [currentConversation?._id, token, refreshCurrentConversation]);

  // One-time profile picture prompt for users without an avatar (bump storage key on new releases).
  useEffect(() => {
    if (!isAuthenticated || !user || user.profilePicture || isUserChatProfile) {
      setProfilePicPromptOpen(false);
      return;
    }
    try {
      if (localStorage.getItem(PROFILE_PIC_PROMPT_STORAGE_KEY)) return;
    } catch { /* ignore */ }
    setProfilePicPromptOpen(true);
  }, [isAuthenticated, user?.id, user?.profilePicture, isUserChatProfile]);

  useEffect(() => {
    if (!imageLightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImageLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imageLightboxUrl]);

  const openMessageMenu = useCallback((idx: number, clientX: number, clientY: number) => {
    if (!currentConversation || currentConversation.isShared) return;
    window.getSelection()?.removeAllRanges();
    setMessageMenu({ idx, x: clientX, y: clientY });
    setReactPickerAnchor(null);
  }, [currentConversation]);

  const groupParticipantIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (user?.id) ids.add(String(user.id));
    const entry = mentionedConversations.find(
      (m) => String(m.conversation._id) === currentConversation?._id
    );
    entry?.participants?.forEach((p) => ids.add(String(p.id)));
    (currentConversation?.messages ?? []).forEach((m) => {
      if (m.senderId) ids.add(String(m.senderId));
    });
    return ids;
  }, [currentConversation?._id, currentConversation?.messages, mentionedConversations, user?.id]);

  const notifyCollaborativeTyping = useCallback(() => {
    if (!isActiveGroupChat || !token || !currentConversation?._id) return;
    const now = Date.now();
    if (now - lastTypingPingRef.current < 2500) return;
    lastTypingPingRef.current = now;
    axios
      .post(`/api/v1/conversations/${currentConversation._id}/typing`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch(() => {});
  }, [isActiveGroupChat, token, currentConversation?._id]);

  const stopCollaborativeTyping = useCallback(() => {
    if (!token || !currentConversation?._id) return;
    lastTypingPingRef.current = 0;
    axios
      .delete(`/api/v1/conversations/${currentConversation._id}/typing`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch(() => {});
  }, [token, currentConversation?._id]);

  const handleComposerInput = (val: string, el: HTMLTextAreaElement, maxHeight: number) => {
    setInput(val);
    autoGrowTextarea(el, maxHeight);
    if (val.trim()) notifyCollaborativeTyping();
    else stopCollaborativeTyping();
    const cursor = el.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@([^@\s]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionActiveIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  // @mention autocomplete: users whose name/email match the current query.
  // Names that START WITH the query are ranked first so the top match lines up
  // with the inline ghost-text completion.
  const getMentionMatches = (query: string) => {
    const q = query.toLowerCase();
    const people = buUsers
      .filter(
        u =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const ap = a.fullName.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.fullName.toLowerCase().startsWith(q) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.fullName.localeCompare(b.fullName);
      });

    const matches: { _id: string; fullName: string; email: string; profilePicture?: string | null; isAdmin?: boolean; isNexa?: boolean }[] = [];
    if (isActiveGroupChat && (NEXA_AI_MENTION.toLowerCase().includes(q) || "nexa".startsWith(q) || q === "")) {
      matches.push({
        _id: NEXA_AI_ID,
        fullName: NEXA_AI_MENTION,
        email: "Ask Nexa AI",
        isNexa: true,
      });
    }
    return [...matches, ...people.slice(0, 6)];
  };

  // Inline ghost-text completion for the current @query. Shows the remainder of
  // the best prefix match in grey so the user can accept it with Enter/Tab.
  const mentionMatches = mentionQuery !== null ? getMentionMatches(mentionQuery) : [];
  const mentionGhostSuffix = (() => {
    if (!mentionQuery) return "";
    const top = mentionMatches[0];
    if (!top || !top.fullName.toLowerCase().startsWith(mentionQuery.toLowerCase())) return "";
    // Only show the ghost while the @query sits at the very end of the input.
    if (!/@[^@\s]*$/.test(input)) return "";
    return top.fullName.slice(mentionQuery.length);
  })();

  // Insert the selected mention into the input, replacing the partial "@query".
  const selectMention = (u: { _id: string; fullName: string }) => {
    const atIdx = input.lastIndexOf('@');
    const newInput = (atIdx >= 0 ? input.slice(0, atIdx) : input) + `@${u.fullName} `;
    setInput(newInput);
    // Only queue a collaboration invite for users not already in this group.
    if (u._id !== NEXA_AI_ID && (!isActiveGroupChat || !groupParticipantIds.has(u._id))) {
      setPendingMentions(prev =>
        prev.some(m => m.userId === u._id) ? prev : [...prev, { userId: u._id, name: u.fullName }]
      );
    }
    setMentionQuery(null);
    setMentionActiveIndex(0);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // Compute a screen-fixed anchor for a kebab dropdown from the clicked button.
  // Opens downward normally, but flips upward when there isn't enough room below
  // (e.g. sessions near the bottom, above the dark-mode/settings/logout footer).
  const computeMenuAnchor = (e: React.MouseEvent): { left: number; top?: number; bottom?: number } => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const DROPDOWN_W = 180;
    const DROPDOWN_H = 260;
    const left = Math.max(8, Math.min(rect.right - DROPDOWN_W, window.innerWidth - DROPDOWN_W - 8));
    const openUp = rect.bottom + DROPDOWN_H > window.innerHeight;
    return openUp
      ? { left, bottom: Math.max(8, window.innerHeight - rect.top + 4) }
      : { left, top: rect.bottom + 4 };
  };

  // Toggle a kebab menu open/closed, capturing its anchor position when opening.
  const toggleConvMenu = (
    e: React.MouseEvent,
    id: string,
    isOpen: boolean,
    setId: (v: string | null) => void
  ) => {
    e.stopPropagation();
    if (isOpen) {
      setId(null);
      setMenuAnchor(null);
    } else {
      setId(id);
      setMenuAnchor(computeMenuAnchor(e));
    }
  };

  const convMenuStyle: React.CSSProperties | undefined = menuAnchor
    ? {
        position: "fixed",
        left: menuAnchor.left,
        top: menuAnchor.top ?? "auto",
        bottom: menuAnchor.bottom ?? "auto",
        right: "auto",
        zIndex: 200,
      }
    : undefined;

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

  // Handle /access-request/respond?token=&action= links from email
  useEffect(() => {
    if (location.pathname !== '/access-request/respond') return;
    const params = new URLSearchParams(location.search);
    const token_ = params.get('token');
    const action = params.get('action');
    if (!token_ || !action) { navigate('/user-chat'); return; }
    (async () => {
      try {
        const { data } = await axios.post('/api/v1/conversations/access-request/process', { token: token_, action });
        alert(data.message || (action === 'accept' ? 'Access granted!' : 'Request declined.'));
      } catch (err: any) {
        alert(err?.response?.data?.error || 'Could not process the request.');
      }
      navigate('/user-chat', { replace: true });
    })();
  }, [location.pathname, location.search]);

  // Poll current conversation for new messages from collaborators
  useEffect(() => {
    if (!currentConversation?._id || currentConversation.isShared || loading || !token) return;
    if (!isActiveGroupChat) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(
          `/api/v1/conversations/${currentConversation._id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const fresh = data.conversation;
        setCurrentConversation((prev) => {
          if (!prev || prev._id !== fresh._id) return prev;
          if (fresh.updatedAt === prev.updatedAt) return prev;
          return {
            ...prev,
            messages: fresh.messages,
            pinnedMessage: fresh.pinnedMessage ?? undefined,
            updatedAt: fresh.updatedAt,
            isCollaborative: data.isCollaborative ?? prev.isCollaborative,
          };
        });
      } catch { /* silent */ }
    }, 8000);
    return () => clearInterval(interval);
  }, [currentConversation?._id, currentConversation?.messages?.length, loading, token, isActiveGroupChat]);

  // Poll for "X is typing…" in group conversations
  useEffect(() => {
    if (!isActiveGroupChat || !currentConversation?._id || !token || currentConversation.isShared) {
      setCollaborativeTypers([]);
      return;
    }
    let cancelled = false;
    const fetchTypers = async () => {
      try {
        const { data } = await axios.get(
          `/api/v1/conversations/${currentConversation._id}/typing`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!cancelled) setCollaborativeTypers(data.typers || []);
      } catch {
        if (!cancelled) setCollaborativeTypers([]);
      }
    };
    fetchTypers();
    const interval = setInterval(fetchTypers, 2500);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isActiveGroupChat, currentConversation?._id, token, currentConversation?.isShared]);

  // Poll for accepted/rejected access requests
  useEffect(() => {
    const pending = Object.entries(accessRequestStatus).filter(([, v]) => v === 'pending');
    if (pending.length === 0 || !token) return;
    const interval = setInterval(async () => {
      for (const [convId] of pending) {
        try {
          const { data } = await axios.get(
            `/api/v1/conversations/access-request/status/${convId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (data.status === 'accepted') {
            setAccessRequestStatus(prev => ({ ...prev, [convId]: 'accepted' }));
            loadConversations(token, false); // refresh to get forked conversation
          } else if (data.status === 'rejected') {
            setAccessRequestStatus(prev => ({ ...prev, [convId]: 'rejected' }));
          }
        } catch { /* silent */ }
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [accessRequestStatus, token]);

  // Intercept 401s globally — a stale/expired token should force re-login.
  // We do this once on mount, not on every render.
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (res) => res,
      (error) => {
        if (error?.response?.status === 401) {
          const currentPath = window.location.pathname;
          // Preserve share links so the user lands back on them after re-auth
          try {
            if (currentPath.startsWith("/shared/")) {
              sessionStorage.setItem("post-login-redirect", currentPath);
            }
          } catch { /* ignore */ }
          localStorage.removeItem("nexa-token");
          localStorage.removeItem("nexa-user");
          delete axios.defaults.headers.common["Authorization"];
          setIsAuthenticated(false);
          setToken(null);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptorId);
  }, []);

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
            const onSharePath = window.location.pathname.startsWith("/shared/");
            loadConversations(savedToken, onSharePath);
            fetchFolders(savedToken);
            fetchMentionedConversations(savedToken);
            fetchBuUsers(savedToken);
            if (!localStorage.getItem("nexa-avatar")) {
              setShowAvatarPicker(true);
            }
          } else if (window.location.pathname.startsWith("/user-chat")) {
            // Admin actively using the chat (e.g. the embedded "Ask Nexa" panel) — their
            // conversations are stored under the admin id (authMiddleware maps adminId→userId),
            // so load them back on refresh just like a regular user. We still skip /auth/me,
            // which 401s for admin tokens and would trip the interceptor that clears the session.
            loadingStartTimeRef.current = Date.now();
            loadConversations(savedToken, false);
            fetchFolders(savedToken);
            fetchMentionedConversations(savedToken);
            fetchBuUsers(savedToken);
          } else {
            // Admin elsewhere (e.g. the dashboard shell) — nothing to load here.
            // The navbar will provide access to the control panel.
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

  async function fetchMentionedConversations(authToken?: string) {
    const t = authToken || token;
    if (!t) return;
    try {
      const { data } = await axios.get("/api/v1/conversations/mentioned-in-me", { headers: { Authorization: `Bearer ${t}` } });
      setMentionedConversations(data.mentions || []);
    } catch { /* silent */ }
  }

  async function fetchBuUsers(authToken?: string) {
    const t = authToken || token;
    if (!t) return;
    try {
      const { data } = await axios.get("/api/v1/conversations/mentionable-users", { headers: { Authorization: `Bearer ${t}` } });
      setBuUsers(data.users || []);
    } catch { /* silent */ }
  }

  async function applyPendingMentions(convId: string) {
    if (pendingMentions.length === 0 || !token) return;
    const toApply = [...pendingMentions];
    setPendingMentions([]);
    for (const m of toApply) {
      try {
        await axios.post(`/api/v1/conversations/${convId}/mention`, { mentionedUserId: m.userId }, { headers: { Authorization: `Bearer ${token}` } });
        fetchMentionedConversations();
      } catch { /* silent — duplicate mention etc */ }
    }
    setCurrentConversation((prev) =>
      prev && prev._id === convId ? { ...prev, isCollaborative: true } : prev
    );
  }

  async function sendGroupMessage(content: string, convId: string, files: File[] = []) {
    if (!token) return;
    const messageId = crypto.randomUUID();
    const { images } = splitAttachedFiles(files);
    const { fileLabel, imageUrls } = buildAttachmentMeta(files);
    const replyPayload = replyTarget
      ? {
          messageId: replyTarget.messageId,
          senderName: replyTarget.senderName,
          content: replyTarget.snippet,
        }
      : undefined;

    const optimisticMsg: Message = {
      role: "user",
      content: (content || "") + fileLabel || (images.length > 0 ? "📷 Photo" : ""),
      timestamp: new Date(),
      messageId,
      senderId: user?.id,
      senderName: user?.fullName || user?.email,
      ...(imageUrls ? { imageUrls } : {}),
      ...(replyPayload ? { replyTo: replyPayload } : {}),
    };
    setCurrentConversation((prev) =>
      prev && prev._id === convId
        ? { ...prev, messages: [...(prev.messages || []), optimisticMsg], isCollaborative: true }
        : prev
    );

    let data: { conversation: Conversation };
    try {
      if (images.length > 0) {
        const formData = new FormData();
        formData.append("content", content || "");
        formData.append("messageId", messageId);
        if (replyPayload) formData.append("replyTo", JSON.stringify(replyPayload));
        images.forEach((f) => formData.append("files", f));
        ({ data } = await axios.post<{ conversation: Conversation }>(
          `/api/v1/conversations/${convId}/note`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        ));
      } else {
        const payload: Record<string, unknown> = { content, messageId };
        if (replyPayload) payload.replyTo = replyPayload;
        ({ data } = await axios.post<{ conversation: Conversation }>(
          `/api/v1/conversations/${convId}/note`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        ));
      }
    } catch {
      setCurrentConversation((prev) =>
        prev && prev._id === convId
          ? { ...prev, messages: (prev.messages || []).filter((m) => m.messageId !== messageId) }
          : prev
      );
      throw new Error("Could not send group message");
    }

    setReplyTarget(null);
    setCurrentConversation((prev) =>
      prev && prev._id === convId
        ? { ...prev, ...data.conversation, isCollaborative: true }
        : data.conversation
    );
    setConversations((prev) =>
      prev.map((c) => (c._id === convId ? { ...c, ...data.conversation, isCollaborative: true } : c))
    );
  }

  async function handleMessageReaction(messageId: string, emoji: string, messageIdx?: number) {
    if (!token || !currentConversation?._id) return;
    let resolvedId = messageId;
    if (resolvedId.startsWith("idx-") && messageIdx !== undefined) {
      const fresh = await refreshCurrentConversation();
      resolvedId = fresh?.messages?.[messageIdx]?.messageId || resolvedId;
    }
    if (!resolvedId || resolvedId.startsWith("idx-")) return;
    try {
      const { data } = await axios.post<{ conversation: Conversation }>(
        `/api/v1/conversations/${currentConversation._id}/messages/${resolvedId}/reactions`,
        { emoji },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentConversation((prev) =>
        prev ? { ...prev, messages: data.conversation.messages, updatedAt: data.conversation.updatedAt } : prev
      );
      setReactPickerAnchor(null);
      setMessageMenu(null);
    } catch { /* silent */ }
  }

  async function handlePinMessage(message: Message, messageIdx?: number) {
    if (!token || !currentConversation?._id) return;
    let messageId = message.messageId;
    if (!messageId && messageIdx !== undefined) {
      const fresh = await refreshCurrentConversation();
      messageId = fresh?.messages?.[messageIdx]?.messageId;
    }
    if (!messageId) {
      alert("Could not pin this message. Please try again.");
      return;
    }
    try {
      const { data } = await axios.post<{ conversation: Conversation }>(
        `/api/v1/conversations/${currentConversation._id}/pin`,
        { messageId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentConversation((prev) =>
        prev ? { ...prev, pinnedMessage: data.conversation.pinnedMessage, updatedAt: data.conversation.updatedAt } : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c._id === currentConversation._id
            ? { ...c, pinnedMessage: data.conversation.pinnedMessage, updatedAt: data.conversation.updatedAt }
            : c
        )
      );
      setMessageMenu(null);
      showSoftToast("Message pinned");
    } catch {
      alert("Could not pin this message. Please try again.");
    }
  }

  async function handleUnpinMessage() {
    if (!token || !currentConversation?._id) return;
    try {
      const { data } = await axios.delete<{ conversation: Conversation }>(
        `/api/v1/conversations/${currentConversation._id}/pin`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentConversation((prev) =>
        prev ? { ...prev, pinnedMessage: undefined, updatedAt: data.conversation.updatedAt } : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c._id === currentConversation._id
            ? { ...c, pinnedMessage: undefined, updatedAt: data.conversation.updatedAt }
            : c
        )
      );
      showSoftToast("Message unpinned");
    } catch {
      showSoftToast("Could not unpin message");
    }
  }

  async function handleAccessRequest(convId: string, sharerId: string) {
    if (!token) return;
    setAccessRequestStatus(prev => ({ ...prev, [convId]: 'pending' }));
    try {
      await axios.post(
        "/api/v1/conversations/access-request",
        { conversationGroupId: convId, sharerId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error || "";
      if (msg.includes("pending")) {
        // already pending — keep status
      } else {
        setAccessRequestStatus(prev => ({ ...prev, [convId]: 'idle' }));
        alert(msg || "Could not send request. Please try again.");
      }
    }
  }

  async function fetchFolders(authToken?: string) {
    const t = authToken || token;
    if (!t) return;
    try {
      const { data } = await axios.get("/api/v1/conversations/folders", { headers: { Authorization: `Bearer ${t}` } });
      setFolders(data.folders || []);
    } catch { /* silent */ }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name || !token) return;
    try {
      const { data } = await axios.post("/api/v1/conversations/folders", { name }, { headers: { Authorization: `Bearer ${token}` } });
      setFolders(prev => [...prev, data.folder]);
      setExpandedFolderIds(prev => new Set([...prev, data.folder._id]));
    } catch { /* silent */ }
    setNewFolderName("");
    setIsCreatingFolder(false);
  }

  async function handleRenameFolder(folderId: string) {
    const name = renameFolderName.trim();
    if (!name || !token) return;
    try {
      await axios.patch(`/api/v1/conversations/folders/${folderId}`, { name }, { headers: { Authorization: `Bearer ${token}` } });
      setFolders(prev => prev.map(f => f._id === folderId ? { ...f, name } : f));
    } catch { /* silent */ }
    setRenamingFolderId(null);
  }

  async function handleDeleteFolder(folderId: string) {
    if (!token) return;
    try {
      await axios.delete(`/api/v1/conversations/folders/${folderId}`, { headers: { Authorization: `Bearer ${token}` } });
      setFolders(prev => prev.filter(f => f._id !== folderId));
    } catch { /* silent */ }
    setFolderMenuId(null);
  }

  async function handleAddToFolder(folderId: string, convId: string) {
    if (!token) return;
    try {
      const { data } = await axios.post(`/api/v1/conversations/folders/${folderId}/add`, { conversationId: convId }, { headers: { Authorization: `Bearer ${token}` } });
      setFolders(prev => prev.map(f => f._id === folderId ? { ...f, conversationIds: data.folder.conversationIds } : { ...f, conversationIds: f.conversationIds.filter(id => id !== convId) }));
    } catch { /* silent */ }
    setFolderSubMenuConvId(null);
    setActiveMenuId(null);
  }

  async function handleRemoveFromFolder(folderId: string, convId: string) {
    if (!token) return;
    try {
      await axios.delete(`/api/v1/conversations/folders/${folderId}/conversations/${convId}`, { headers: { Authorization: `Bearer ${token}` } });
      setFolders(prev => prev.map(f => f._id === folderId ? { ...f, conversationIds: f.conversationIds.filter(id => id !== convId) } : f));
    } catch { /* silent */ }
    setActiveMenuId(null);
  }

  async function loadConversations(authToken: string, skipAutoSelect = false) {
    setIsConversationsLoading(true);
    try {
      const { data } = await axios.get<{ conversations: Conversation[]; total: number; hasMore: boolean }>(
        "/api/v1/conversations?limit=20&offset=0",
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setConversations(data.conversations);
      setConversationsHasMore(data.hasMore ?? false);
      setConversationsOffset(20);

      if (!skipAutoSelect && data.conversations.length > 0) {
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

    // Honour a share-link redirect that was stashed before the user was bounced
    // to /login (so deep links to /shared/:token survive the auth round-trip).
    let postLoginPath: string | null = null;
    try {
      postLoginPath = sessionStorage.getItem("post-login-redirect");
      if (postLoginPath) sessionStorage.removeItem("post-login-redirect");
    } catch {
      /* ignore */
    }

    // Role-based redirection
    if (authUser.businessUnit === 'SUPERADMIN') {
      window.location.href = "/super-admin/dashboard";
    } else if (authUser.isAdmin === true) {
      window.location.href = "/admin/dashboard";
    } else if (postLoginPath && postLoginPath.startsWith("/shared/")) {
      setIsConversationsLoading(true);
      axios.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
      applyTenantBrandFromSession(authUser.tenantColor);
      await loadConversations(authToken, true); // don't auto-select; share link effect sets it
      fetchFolders(authToken);
      fetchMentionedConversations(authToken);
      fetchBuUsers(authToken);
      navigate(postLoginPath, { replace: true });
    } else {
      window.history.pushState(null, "", "/user-chat");
      setIsConversationsLoading(true);
      axios.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
      applyTenantBrandFromSession(authUser.tenantColor);
      await loadConversations(authToken);
      fetchFolders(authToken);
      fetchMentionedConversations(authToken);
      fetchBuUsers(authToken);
      if (!localStorage.getItem("nexa-avatar")) {
        setShowAvatarPicker(true);
      }
    }
  };

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    const tok = localStorage.getItem("nexa-token");
    if (tok) {
      axios.post("/api/v1/auth/logout", {}, { headers: { Authorization: `Bearer ${tok}` } }).catch(() => {});
    }
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

    // Reuse an existing empty conversation instead of creating a duplicate. This covers both
    // "already on an empty new chat" and "an empty new chat exists but I'm viewing another one"
    // (e.g. open an existing chat → New Chat → back to existing → New Chat again).
    const existingEmpty =
      currentConversation && (currentConversation.messages?.length ?? 0) === 0
        ? currentConversation
        : conversations.find((c) => (c.messages?.length ?? 0) === 0);
    if (existingEmpty) {
      if (existingEmpty._id !== currentConversation?._id) setCurrentConversation(existingEmpty);
      setInput("");
      if (location.pathname !== "/user-chat") navigate("/user-chat");
      setTimeout(() => textareaRef.current?.focus(), 50);
      if (typeof window !== "undefined" && window.innerWidth <= 768) setSidebarOpen(false);
      return;
    }

    try {
      const { data } = await axios.post<{ conversation: Conversation }>(
        "/api/v1/conversations",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setConversations((prev) => [data.conversation, ...prev]);
      setCurrentConversation(data.conversation);
      setInput("");
      if (typeof window !== "undefined" && window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
      setTimeout(() => textareaRef.current?.focus(), 50);
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

  const handleOpenShareModal = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareModalConvId(convId);
    setShareMessageIndex(null);
    setShareRecipientEmail("");
    setShareError("");
    setShareLinkUrl("");
    setShareLinkCopied(false);
    setActiveMenuId(null);
  };

  const handleOpenShareMessageModal = (convId: string, messageIndex: number) => {
    setShareModalConvId(convId);
    setShareMessageIndex(messageIndex);
    setShareRecipientEmail("");
    setShareError("");
    setShareLinkUrl("");
    setShareLinkCopied(false);
  };

  // Fetch (or reuse) the share link whenever the modal opens. The backend is
  // idempotent on (sender, group, messageIndex), so reopening returns the same URL.
  useEffect(() => {
    if (!shareModalConvId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        setShareLinkLoading(true);
        const { data } = await axios.post(
          `/api/v1/conversations/${shareModalConvId}/share-link`,
          shareMessageIndex !== null ? { messageIndex: shareMessageIndex } : {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!cancelled && data?.token) {
          setShareLinkUrl(`${window.location.origin}/shared/${data.token}`);
        }
      } catch {
        // Best-effort — the email path still works without a link.
      } finally {
        if (!cancelled) setShareLinkLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareModalConvId, shareMessageIndex, token]);

  const copyShareLink = async () => {
    if (!shareLinkUrl) return;
    try {
      await navigator.clipboard.writeText(shareLinkUrl);
      setShareLinkCopied(true);
      if (shareLinkCopyTimer.current) clearTimeout(shareLinkCopyTimer.current);
      shareLinkCopyTimer.current = setTimeout(() => setShareLinkCopied(false), 2000);
    } catch {
      /* ignore clipboard failures */
    }
  };

  const confirmShareConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareModalConvId || !shareRecipientEmail.trim() || !token) return;
    try {
      setShareSubmitting(true);
      setShareError("");
      const url =
        shareMessageIndex !== null
          ? `/api/v1/conversations/${shareModalConvId}/messages/${shareMessageIndex}/share`
          : `/api/v1/conversations/${shareModalConvId}/share`;
      const { data } = await axios.post(
        url,
        { recipientEmail: shareRecipientEmail.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const wasMessage = shareMessageIndex !== null;
      setShareModalConvId(null);
      setShareMessageIndex(null);
      setShareRecipientEmail("");
      alert(
        wasMessage
          ? `AI response shared with ${data.sharedWithEmail || shareRecipientEmail.trim()}.`
          : `Conversation shared with ${data.sharedWithEmail || shareRecipientEmail.trim()}.`
      );
    } catch (err: any) {
      setShareError(err.response?.data?.error || "Could not share.");
    } finally {
      setShareSubmitting(false);
    }
  };

  const fetchSharedWithMe = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get<{ sharedConversations: SharedConversation[] }>(
        "/api/v1/conversations/shared-with-me",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSharedConversations(data.sharedConversations || []);
    } catch (err) {
      // Best-effort — never block the chat if shares can't load
      console.warn("Could not load shared conversations", err);
    }
  }, [token]);

  useEffect(() => {
    fetchSharedWithMe();
  }, [fetchSharedWithMe]);

  // Resolve a /shared/:token URL into a current conversation. Runs whenever the
  // path matches and we have a token; redirects to /user-chat once loaded so
  // the URL stays clean and the view sticks until the user navigates away.
  useEffect(() => {
    if (!token) return;
    const match = location.pathname.match(/^\/shared\/([A-Za-z0-9_-]+)/);
    if (!match) return;
    const shareToken = match[1];
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(
          `/api/v1/conversations/share-link/${shareToken}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (cancelled) return;
        setCurrentConversation({
          _id: data.conversation._id,
          title: data.conversation.title,
          messages: data.conversation.messages,
          createdAt: data.conversation.createdAt,
          updatedAt: data.conversation.updatedAt,
          isShared: true,
          sharedBy: data.sharedBy,
          redactedMessageCount: data.redactedMessageCount
        });
        navigate("/user-chat", { replace: true });
      } catch (err: any) {
        if (cancelled) return;
        // 401 means the interceptor already cleared the token and will re-render
        // to the login screen — no need to alert or navigate manually.
        if (err?.response?.status === 401) return;
        const msg =
          err?.response?.data?.error ||
          "This share link is invalid or you don't have permission to view it.";
        alert(msg);
        navigate("/user-chat", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, token, navigate]);

  const openSharedConversation = (s: SharedConversation) => {
    // Map shared payload onto the existing Conversation shape so the message
    // renderer can read it without a separate code path. The isShared flag is
    // what suppresses the input footer + edit affordances downstream.
    setCurrentConversation({
      _id: s.conversation._id,
      title: s.conversation.title,
      messages: s.conversation.messages,
      createdAt: s.conversation.createdAt,
      updatedAt: s.conversation.updatedAt,
      isShared: true,
      sharedBy: s.sharedBy,
      redactedMessageCount: s.redactedMessageCount
    });
    if (location.pathname !== "/user-chat") navigate("/user-chat");
    if (window.innerWidth <= 768) setSidebarOpen(false);
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
      // Rate-limit hits are surfaced by the RateLimitBanner, not an alert.
      if (!(axios.isAxiosError(error) && error.response?.status === 429)) {
        alert("Failed to edit message");
      }
    } finally {
      setEditModalOpen(false);
      setEditingMessageIndex(null);
      setEditingContent("");
      setRegeneratingMessageIndex(null);
      setLoading(false);
    }
  };

  // Parse the draft-7 `RateLimit` header (e.g. "limit=50, remaining=7, reset=340")
  // and update the banner state. Falls back to `Retry-After` for the reset window.
  const captureRateLimit = (headers: Headers) => {
    const raw = headers.get("RateLimit") ?? headers.get("ratelimit");
    if (!raw) return;
    const parts: Record<string, number> = {};
    raw.split(",").forEach((seg) => {
      const [k, v] = seg.split("=").map((s) => s.trim());
      if (k && v !== undefined) parts[k] = Number(v);
    });
    const resetSecs = Number.isFinite(parts.reset)
      ? parts.reset
      : Number(headers.get("Retry-After"));
    if (!Number.isFinite(parts.remaining) || !Number.isFinite(resetSecs)) return;
    setRateLimit({
      remaining: parts.remaining,
      limit: Number.isFinite(parts.limit) ? parts.limit : 0,
      resetAt: Date.now() + resetSecs * 1000,
    });
  };

  // Helper function to stream AI response
  const streamResponse = async (conversationId: string, userContent: string, files?: File[], model: "gpt" | "claude" | "kimi" | "deepseek" = "gpt"): Promise<Conversation | null> => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const hasFiles = files && files.length > 0;

    let body: FormData | string;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (hasFiles) {
      const formData = new FormData();
      formData.append("message", userContent);
      formData.append("model", model);
      files.forEach((f) => formData.append("files", f));
      body = formData;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ content: userContent, model });
    }

    // Fresh AbortController for this generation so the user can stop it.
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await fetch(
      `${apiBase}/api/v1/conversations/${conversationId}/message-stream`,
      { method: "POST", headers, body, signal: controller.signal }
    );

    // Always record the latest quota so the banner can warn as it runs low.
    captureRateLimit(response.headers);

    if (response.status === 429) {
      const err = new Error("RATE_LIMITED") as Error & { rateLimited?: boolean };
      err.rateLimited = true;
      throw err;
    }

    if (!response.ok) {
      // Prefer the backend's JSON error (e.g. multer "Only PDF, DOCX… files are allowed",
      // file-too-large, session cap) so the user sees an actionable message.
      let backendMsg = "";
      try {
        const data = await response.clone().json();
        backendMsg = data?.error || "";
      } catch { /* not JSON */ }
      if (backendMsg && hasFiles) setAttachError(backendMsg);
      throw new Error(backendMsg || `HTTP ${response.status}: ${response.statusText}`);
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
                // Surface any per-file upload failures the backend reported so the
                // user isn't left thinking a document was analyzed when it wasn't.
                if (Array.isArray(data.uploadedDocuments)) {
                  const failed = data.uploadedDocuments
                    .filter((d: { status?: string }) => d?.status === "failed")
                    .map((d: { fileName?: string }) => d.fileName)
                    .filter(Boolean);
                  const extractionFailed = data.uploadedDocuments
                    .filter((d: { extractionFailed?: boolean }) => d?.extractionFailed)
                    .map((d: { fileName?: string }) => d.fileName)
                    .filter(Boolean);
                  const notices: string[] = [];
                  if (failed.length > 0) {
                    notices.push(`These files couldn't be uploaded: ${failed.join(", ")}.`);
                  }
                  if (extractionFailed.length > 0) {
                    notices.push(`Couldn't read text from: ${extractionFailed.join(", ")}. Try a text-based PDF/DOCX or re-upload.`);
                  }
                  if (notices.length > 0) setAttachError(notices.join(" "));
                }
                return finalConversation;
              }

              if (data.error) {
                throw new Error(data.error);
              }

              // Status events arrive before the AI starts — show them as placeholder text
              if (data.status) {
                setCurrentConversation((prev) => {
                  if (!prev) return prev;
                  const lastMsg = prev.messages[prev.messages.length - 1];
                  if (lastMsg?.role === "assistant" && !fullResponse) {
                    // Update existing status placeholder
                    const updated = { ...prev, messages: [...prev.messages] };
                    updated.messages[updated.messages.length - 1] = { ...lastMsg, content: data.status };
                    return updated;
                  } else if (lastMsg?.role !== "assistant") {
                    // No assistant message yet — add one as a status placeholder
                    return {
                      ...prev,
                      messages: [...prev.messages, { role: "assistant" as const, content: data.status, timestamp: new Date() }]
                    };
                  }
                  return prev;
                });
                continue;
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
              // Only swallow malformed-JSON fragments (SSE chunks can split mid-line).
              // Real errors — a thrown `data.error` or an abort — must propagate so the
              // user actually sees that generation failed instead of a stuck placeholder.
              if (error instanceof SyntaxError) {
                console.error("Error parsing stream data:", error);
              } else {
                throw error;
              }
            }
          }
        }

        // Keep incomplete line in buffer
        buffer = lines[lines.length - 1];
      }
    } catch (err) {
      // User pressed "stop" — keep whatever streamed so far, don't surface an error,
      // and replace the "Generating response…" placeholder with a clear stopped notice.
      if ((err as Error)?.name === "AbortError") {
        setCurrentConversation((prev) => {
          if (!prev) return prev;
          const msgs = [...prev.messages];
          const last = msgs[msgs.length - 1];
          const hasPartial = !!fullResponse && !!fullResponse.trim();
          if (last && last.role === "assistant") {
            msgs[msgs.length - 1] = {
              ...last,
              content: hasPartial
                ? `${fullResponse}\n\n*Response generation stopped*`
                : "*Response generation stopped*",
            };
          } else {
            msgs.push({ role: "assistant" as const, content: "*Response generation stopped*", timestamp: new Date() });
          }
          return { ...prev, messages: msgs };
        });
        return finalConversation;
      }
      throw err;
    } finally {
      reader.releaseLock();
      abortControllerRef.current = null;
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
    const resetInputs = () => {
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (photosInputRef.current) photosInputRef.current.value = "";
    };

    if (files.length === 0) {
      resetInputs();
      return;
    }

    // Validate up front so users get a clear message instead of an opaque HTTP 400
    // once the upload reaches the backend's multer limits.
    const maxBytes = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isImage = file.type.startsWith("image/");
      const typeOk = isImage || SUPPORTED_UPLOAD_EXTENSIONS.includes(ext);
      if (!typeOk) {
        rejected.push(`${file.name} (unsupported type)`);
        continue;
      }
      if (file.size > maxBytes) {
        rejected.push(`${file.name} (over ${MAX_UPLOAD_FILE_SIZE_MB}MB)`);
        continue;
      }
      accepted.push(file);
    }

    let capNotice = "";
    let toAdd = accepted;
    const room = MAX_UPLOAD_FILES_PER_MESSAGE - attachedFiles.length;
    if (accepted.length > room) {
      toAdd = accepted.slice(0, Math.max(0, room));
      capNotice = `You can attach up to ${MAX_UPLOAD_FILES_PER_MESSAGE} files per message.`;
    }

    if (toAdd.length > 0) {
      setAttachedFiles((prev) => [...prev, ...toAdd]);
      setAttachMenuOpen(false);
    }

    const messages: string[] = [];
    if (rejected.length > 0) messages.push(`Couldn't attach: ${rejected.join(", ")}.`);
    if (capNotice) messages.push(capNotice);
    setAttachError(messages.length > 0 ? messages.join(" ") : null);

    resetInputs();
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
      if (softToastTimerRef.current) clearTimeout(softToastTimerRef.current);
    };
  }, []);

  const showSoftToast = (message: string) => {
    if (softToastTimerRef.current) clearTimeout(softToastTimerRef.current);
    setSoftToastMessage(message);
    softToastTimerRef.current = setTimeout(() => {
      setSoftToastMessage(null);
      softToastTimerRef.current = null;
    }, 2200);
  };

  const dismissProfilePicPrompt = (reason: "later" | "done") => {
    try {
      localStorage.setItem(PROFILE_PIC_PROMPT_STORAGE_KEY, reason);
    } catch { /* ignore */ }
    setProfilePicPromptOpen(false);
  };

  const handleProfilePicPromptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setProfilePicUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const { data } = await axios.post<{ profilePicture: string }>("/api/v1/auth/me/avatar", fd, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      const nextUser = { ...user!, profilePicture: data.profilePicture };
      setUser(nextUser);
      localStorage.setItem("nexa-user", JSON.stringify(nextUser));
      dismissProfilePicPrompt("done");
      showSoftToast("Profile picture updated");
    } catch {
      showSoftToast("Could not upload picture");
    } finally {
      setProfilePicUploading(false);
      if (profilePicInputRef.current) profilePicInputRef.current.value = "";
    }
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    setAttachError(null);
  };

  const copyMessageText = async (
    text: string,
    messageIndex: number,
    options?: { closeMenu?: boolean; showToast?: boolean }
  ) => {
    const clean = (text || "")
      .split("\n")
      .filter((l) => !l.startsWith("📎"))
      .join("\n")
      .trim();
    if (!clean || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(clean);
      if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
      setCopiedMessageIndex(messageIndex);
      copyFeedbackTimerRef.current = setTimeout(() => {
        setCopiedMessageIndex(null);
        copyFeedbackTimerRef.current = null;
      }, 2000);
      if (options?.showToast !== false) showSoftToast("Message copied");
      if (options?.closeMenu) {
        setMessageMenu(null);
        setReactPickerAnchor(null);
      }
    } catch {
      // ignore
    }
  };

  // Hard block: hourly/minute quota exhausted and not yet refreshed.
  const isRateLimited = !!rateLimit && rateLimit.remaining <= 0 && rateLimit.resetAt > Date.now();

  // Stop an in-progress AI generation. The stream reader's abort is handled
  // gracefully in streamResponse (partial text is kept).
  const handleStop = () => {
    abortControllerRef.current?.abort();
    setLoading(false);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    if (loading || !token) return;
    if (isRateLimited) return;

    const mentionsNexa = NEXA_MENTION_RE.test(trimmed);
    const newInvites = pendingMentions.filter((m) => !groupParticipantIds.has(m.userId));

    const filesToSend = [...attachedFiles];
    const { documents: docFiles, images: imageFiles } = splitAttachedFiles(filesToSend);
    const needsNexa = mentionsNexa || docFiles.length > 0;
    setInput("");
    setAttachedFiles([]);
    setAttachError(null);
    setMentionQuery(null);
    stopCollaborativeTyping();

    // Group chat: human messages by default; Nexa only when @Nexa AI is tagged (or documents need AI).
    if (isActiveGroupChat && !needsNexa && (trimmed || imageFiles.length > 0)) {
      try {
        if (!currentConversation) {
          const createData = await axios.post<{ conversation: Conversation }>(
            "/api/v1/conversations", {}, { headers: { Authorization: `Bearer ${token}` } }
          );
          const conv = createData.data.conversation;
          await sendGroupMessage(trimmed, conv._id, imageFiles);
          if (newInvites.length > 0) {
            setPendingMentions(newInvites);
            await applyPendingMentions(conv._id);
          } else {
            setPendingMentions([]);
          }
        } else {
          await sendGroupMessage(trimmed, currentConversation._id, imageFiles);
          if (newInvites.length > 0) {
            setPendingMentions(newInvites);
            await applyPendingMentions(currentConversation._id);
          } else {
            setPendingMentions([]);
          }
        }
      } catch {
        alert("Could not send message. Please try again.");
      }
      return;
    }

    // Initial invite flow (solo chat): @mention to add someone without triggering AI.
    const isInviteOnly = !isActiveGroupChat && pendingMentions.length > 0;

    if (isInviteOnly && trimmed) {
      const userMsg: Message = { role: "user", content: trimmed, timestamp: new Date() };
      try {
        if (!currentConversation) {
          const createData = await axios.post<{ conversation: Conversation }>(
            "/api/v1/conversations", {}, { headers: { Authorization: `Bearer ${token}` } }
          );
          const conv = createData.data.conversation;
          const { data } = await axios.post(
            `/api/v1/conversations/${conv._id}/note`,
            { content: trimmed },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const updated = { ...conv, messages: data.conversation.messages, isCollaborative: true };
          setCurrentConversation(updated);
          setConversations(prev => [updated, ...prev]);
          applyPendingMentions(conv._id);
        } else {
          const { data } = await axios.post(
            `/api/v1/conversations/${currentConversation._id}/note`,
            { content: trimmed },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const updated = { ...currentConversation, messages: data.conversation.messages, isCollaborative: true };
          setCurrentConversation(updated);
          setConversations(prev => prev.map(c => c._id === updated._id ? updated : c));
          applyPendingMentions(currentConversation._id);
        }
      } catch {
        setCurrentConversation(prev => prev ? { ...prev, messages: [...(prev.messages || []), userMsg] } : prev);
        applyPendingMentions(currentConversation?._id || '');
      }
      return;
    }

    // Clear invite queue when proceeding to AI — invites already in group don't block Nexa.
    if (newInvites.length > 0 && currentConversation) {
      setPendingMentions(newInvites);
      applyPendingMentions(currentConversation._id);
    } else {
      setPendingMentions([]);
    }

    // If no conversation exists, create one first
    if (!currentConversation) {
      const createData = await axios.post<{ conversation: Conversation }>(
        "/api/v1/conversations",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newConv = createData.data.conversation;
      // Use functional updater to avoid stale-closure duplication when state hasn't flushed yet
      setConversations((prev) => {
        const alreadyExists = prev.some((c) => c._id === newConv._id);
        return alreadyExists ? prev : [newConv, ...prev];
      });

      const { fileLabel, imageUrls } = buildAttachmentMeta(filesToSend);
      const userMsg: Message = {
        role: "user",
        content: (trimmed || "") + fileLabel,
        timestamp: new Date(),
        ...(imageUrls ? { imageUrls } : {}),
        ...(isActiveGroupChat ? { senderId: user?.id, senderName: user?.fullName || user?.email } : {}),
      };
      const updatedConv = { ...newConv, messages: [userMsg] };
      setCurrentConversation(updatedConv);
      setLoading(true);

      // Stream AI response
      try {
        const finalConversation = await streamResponse(newConv._id, trimmed, filesToSend, selectedModel);
        applyPendingMentions(newConv._id);

        // Use the final conversation data from the stream response
        if (finalConversation) {
          setCurrentConversation(finalConversation);
          setConversations((prev) =>
            prev.map((c) => (c._id === finalConversation._id ? finalConversation : c))
          );
        }
      } catch (error) {
        console.error("Send message error:", error);
        // Rate-limit hits (banner) and user-initiated stops (AbortError) are not errors.
        if (!(error as { rateLimited?: boolean })?.rateLimited && (error as Error)?.name !== "AbortError") {
          alert("Error sending message. Please try again.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    const { fileLabel, imageUrls } = buildAttachmentMeta(filesToSend);
    const userMsg: Message = {
      role: "user",
      content: (trimmed || "") + fileLabel,
      timestamp: new Date(),
      ...(imageUrls ? { imageUrls } : {}),
      ...(isActiveGroupChat ? { senderId: user?.id, senderName: user?.fullName || user?.email } : {}),
    };
    const updatedConv = { ...currentConversation, messages: [...currentConversation.messages, userMsg] };
    setCurrentConversation(updatedConv);
    setLoading(true);

    // Stream AI response
    try {
      const finalConversation = await streamResponse(currentConversation._id, trimmed, filesToSend, selectedModel);
      applyPendingMentions(currentConversation._id);

      // Use the final conversation data from the stream response
      if (finalConversation) {
        setCurrentConversation(finalConversation);
        setConversations((prev) =>
          prev.map((c) => (c._id === finalConversation._id ? finalConversation : c))
        );
      }
    } catch (error) {
      console.error("Send message error:", error);
      // Rate-limit hits (banner) and user-initiated stops (AbortError) are not errors.
      if (!(error as { rateLimited?: boolean })?.rateLimited && (error as Error)?.name !== "AbortError") {
        alert("Error sending message. Please try again.");
      }
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

  // /shared/:token — public-ish share link viewer. Requires auth (so the
  // backend can apply per-source redaction tied to the viewer's identity).
  // The actual fetch + currentConversation hydration runs in an effect below;
  // here we just require auth and fall through to the chat shell.
  if (location.pathname.startsWith("/shared/")) {
    if (!isAuthenticated) {
      // Stash the intended path so we can return after login
      try {
        sessionStorage.setItem("post-login-redirect", location.pathname);
      } catch {
        /* ignore */
      }
      window.history.replaceState(null, "", "/login");
      return <Login onLoginSuccess={handleLogin} />;
    }
    // Authenticated — render chat shell below; the effect below loads the share.
  }

  // Access-request respond links — process token then redirect to user-chat
  if (location.pathname === '/access-request/respond') {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Arial', color:'#555' }}>Processing request…</div>;
  }

  // Any other unmatched route for unauthenticated users → landing page
  if (!isAuthenticated) {
    return <NewLandingPage />;
  }

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const chatHeaderTenantLogoUrl = resolveTenantLogoUrl(user?.tenantLogo);

  const ModelToggle = () => (
    <select
      className="model-select"
      value={selectedModel}
      onChange={(e) => setSelectedModel(e.target.value as "gpt" | "claude" | "kimi" | "deepseek")}
      aria-label="AI Model"
    >
      <option value="gpt">GPT-5</option>
      {/* <option value="claude">Claude Opus 4.7</option> */}
      <option value="kimi">Kimi k2.5</option>
      <option value="deepseek">DeepSeek v4</option>
    </select>
  );

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
            <div
              className="sidebar-logo"
              role="button"
              tabIndex={0}
              title="Start a new chat"
              style={{ cursor: 'pointer' }}
              onClick={handleNewChat}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNewChat(); } }}
            >
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

          {(folderMenuId || activeMenuId) && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 90 }}
              onClick={() => { setFolderMenuId(null); setActiveMenuId(null); setFolderSubMenuConvId(null); setMenuAnchor(null); }}
            />
          )}
          <div className="sidebar-conversations-v2">
            {/* ── Folders ── */}
            {(() => {
              // Group/mentioned conversations live in their own section, so they're the
              // only things excluded from Recent. Foldered chats still appear in Recent.
              const mentionedConvIds = new Set(mentionedConversations.map(m => String(m.conversation._id)));
              return (
                <>
                  <div className="sidebar-section-label retractable" style={{ justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MdFolder size={14} style={{ color: 'var(--brand-color, #ed0000)' }} />
                      Folders
                    </span>
                    <button
                      title="New folder"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, display: 'flex', alignItems: 'center', color: 'inherit', opacity: 0.6 }}
                      onClick={(e) => { e.stopPropagation(); setIsCreatingFolder(true); setNewFolderName(""); }}
                    >
                      <MdCreateNewFolder size={15} />
                    </button>
                  </div>

                  {isCreatingFolder && (
                    <div className="folder-create-row" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        className="folder-name-input"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        placeholder="Folder name…"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleCreateFolder();
                          if (e.key === 'Escape') setIsCreatingFolder(false);
                        }}
                      />
                      <button className="folder-confirm-btn" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>✓</button>
                      <button className="folder-cancel-btn" onClick={() => setIsCreatingFolder(false)}>✕</button>
                    </div>
                  )}

                  {folders.map(folder => {
                    const isExpanded = expandedFolderIds.has(folder._id);
                    const folderConvs = conversations.filter(c => folder.conversationIds.includes(c._id));
                    return (
                      <div key={folder._id} className="folder-group">
                        <div
                          className="folder-header"
                          onClick={() => setExpandedFolderIds(prev => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(folder._id) : next.add(folder._id);
                            return next;
                          })}
                        >
                          <BiChevronDown size={14} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                          {isExpanded
                            ? <MdFolderOpen size={15} style={{ flexShrink: 0, color: 'var(--brand-color, #ed0000)' }} />
                            : <MdFolder size={15} style={{ flexShrink: 0, color: 'var(--brand-color, #ed0000)' }} />}
                          {renamingFolderId === folder._id ? (
                            <input
                              autoFocus
                              className="folder-name-input inline"
                              value={renameFolderName}
                              onChange={e => setRenameFolderName(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.stopPropagation(); handleRenameFolder(folder._id); }
                                if (e.key === 'Escape') setRenamingFolderId(null);
                              }}
                            />
                          ) : (
                            <span className="folder-name">{folder.name}</span>
                          )}
                          <span className="folder-count">{folder.conversationIds.length}</span>
                          <button
                            className="conv-menu-btn"
                            onClick={e => toggleConvMenu(e, folder._id, folderMenuId === folder._id, setFolderMenuId)}
                          >
                            <BiDotsHorizontalRounded size={15} />
                          </button>
                          {folderMenuId === folder._id && (
                            <div className="conv-dropdown" style={convMenuStyle} onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setRenamingFolderId(folder._id); setRenameFolderName(folder.name); setFolderMenuId(null); setMenuAnchor(null); }}>Rename</button>
                              <button style={{ color: '#ef4444' }} onClick={() => handleDeleteFolder(folder._id)}>Delete folder</button>
                            </div>
                          )}
                        </div>
                        {isExpanded && folderConvs.map(conv => (
                          <div
                            key={conv._id}
                            className={`sidebar-conversation-v2 folder-conv ${currentConversation?._id === conv._id ? 'active' : ''}`}
                            onClick={() => {
                              setCurrentConversation(conv);
                              if (location.pathname !== '/user-chat') navigate('/user-chat');
                              if (window.innerWidth <= 768) setSidebarOpen(false);
                            }}
                          >
                            <div className="conv-title-v2">{conv.title}</div>
                            <button className="conv-menu-btn visible" onClick={e => toggleConvMenu(e, conv._id, activeMenuId === conv._id, setActiveMenuId)}>
                              <BiDotsHorizontalRounded size={18} />
                            </button>
                            {activeMenuId === conv._id && (
                              <div className="conv-dropdown" style={convMenuStyle} onClick={e => e.stopPropagation()}>
                                <button onClick={e => { handleOpenShareModal(conv._id, e as any); }}>Share</button>
                                <button onClick={() => handleRemoveFromFolder(folder._id, conv._id)}>Remove from folder</button>
                                <button onClick={e => { handleContextMenuDelete(conv._id, e as any); setActiveMenuId(null); }}>Delete</button>
                              </div>
                            )}
                          </div>
                        ))}
                        {isExpanded && folderConvs.length === 0 && (
                          <div className="sidebar-empty" style={{ paddingLeft: 32, fontSize: 11 }}>Empty folder</div>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Group Conversations (mentions) ── */}
                  <div className="folder-group" style={{ marginTop: 4 }}>
                    <div className="folder-header" onClick={() => setIsSharedConvCollapsed(!isSharedConvCollapsed)}>
                      <BiChevronDown size={14} style={{ transform: isSharedConvCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                      <BiMessageRounded size={14} style={{ flexShrink: 0, color: 'var(--brand-color, #ed0000)' }} />
                      <span className="folder-name">Group Conversations</span>
                      {mentionedConversations.length > 0 && <span className="folder-count">{mentionedConversations.length}</span>}
                    </div>
                    {!isSharedConvCollapsed && (
                      mentionedConversations.length === 0
                        ? <div className="sidebar-empty" style={{ paddingLeft: 28, fontSize: 11 }}>No group conversations yet</div>
                        : mentionedConversations.map(m => (
                          <div
                            key={String(m.mentionId)}
                            className={`sidebar-conversation-v2 folder-conv ${currentConversation?._id === String(m.conversation._id) ? 'active' : ''}`}
                            onClick={() => {
                              setCurrentConversation({ ...m.conversation, _id: String(m.conversation._id), isCollaborative: true });
                              if (location.pathname !== '/user-chat') navigate('/user-chat');
                              if (window.innerWidth <= 768) setSidebarOpen(false);
                            }}
                            style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
                          >
                            <div className="conv-title-v2">{m.conversation.title}</div>
                            {m.participants && m.participants.length > 0 && (
                              <div className="mini-avatar-row" title={m.participants.map(p => p.name).join(', ')}>
                                {m.participants.slice(0, 5).map((p) => renderMiniAvatar(p, p.id))}
                                {m.participants.length > 5 && (
                                  <span className="mini-avatar mini-avatar--more">+{m.participants.length - 5}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>

                  {/* ── Shared with me (direct shares) ── */}
                  <div className="folder-group" style={{ marginTop: 4 }}>
                    <div className="folder-header" onClick={() => setIsSharedSectionCollapsed(!isSharedSectionCollapsed)}>
                      <BiChevronDown size={14} style={{ transform: isSharedSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                      <BiShareAlt size={14} style={{ flexShrink: 0, color: 'var(--brand-color, #ed0000)' }} />
                      <span className="folder-name">Shared with me</span>
                      {sharedConversations.length > 0 && <span className="folder-count">{sharedConversations.length}</span>}
                    </div>
                    {!isSharedSectionCollapsed && (
                      sharedConversations.length === 0
                        ? <div className="sidebar-empty" style={{ paddingLeft: 28, fontSize: 11 }}>Nothing shared with you yet</div>
                        : sharedConversations.map((s) => (
                          <div
                            key={s.shareId}
                            className={`sidebar-conversation-v2 folder-conv ${currentConversation?._id === s.conversation._id && currentConversation?.isShared ? 'active' : ''}`}
                            onClick={() => openSharedConversation(s)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="conv-title-v2">{s.singleMessage ? "💬 " : ""}{s.conversation.title}</div>
                            <div className="mini-avatar-row" style={{ marginLeft: 'auto' }}>
                              {renderMiniAvatar({
                                name: s.sharedBy?.fullName || s.sharedBy?.email || "Someone",
                                profilePicture: s.sharedBy?.userId ? avatarById.get(String(s.sharedBy.userId)) : undefined,
                              })}
                            </div>
                          </div>
                        ))
                    )}
                  </div>

                  {/* ── Recent (unfiled only) ── */}
                  <div
                    className="sidebar-section-label retractable"
                    onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
                  >
                    <span>Recent</span>
                    <BiChevronDown style={{ transform: isHistoryCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </div>
                  {!isHistoryCollapsed && (() => {
                    // Recent shows every conversation (including ones filed into folders);
                    // only the separate group-conversation entries are excluded.
                    const recent = conversations.filter(c => !mentionedConvIds.has(c._id));
                    const sorted = [...recent].sort((a, b) => {
                      const aPinned = pinnedConversations.has(a._id);
                      const bPinned = pinnedConversations.has(b._id);
                      if (aPinned !== bPinned) return aPinned ? -1 : 1;
                      return 0;
                    });
                    return sorted.length === 0 ? (
                      <div className="sidebar-empty">No conversations yet</div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {sorted.map((conv) => (
                          <motion.div
                            layout
                            key={conv._id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className={`sidebar-conversation-v2 ${currentConversation?._id === conv._id ? 'active' : ''} ${pinnedConversations.has(conv._id) ? 'pinned' : ''}`}
                            onClick={() => {
                              setCurrentConversation(conv);
                              if (location.pathname !== '/user-chat') navigate('/user-chat');
                              if (window.innerWidth <= 768) setSidebarOpen(false);
                            }}
                          >
                            {pinnedConversations.has(conv._id) && <MdPushPin size={16} className="pin-active-icon mr-2 flex-shrink-0" />}
                            <div className="conv-title-v2">{conv.title}</div>
                            <button className="conv-menu-btn visible" onClick={e => { setFolderSubMenuConvId(null); toggleConvMenu(e, conv._id, activeMenuId === conv._id, setActiveMenuId); }}>
                              <BiDotsHorizontalRounded size={18} />
                            </button>
                            {activeMenuId === conv._id && (
                              <div className="conv-dropdown" style={convMenuStyle} onClick={e => e.stopPropagation()}>
                                <button onClick={e => { handlePinConversation(conv._id, e as any); setActiveMenuId(null); }}>
                                  {pinnedConversations.has(conv._id) ? 'Unpin' : 'Pin'}
                                </button>
                                <button onClick={e => { handleOpenShareModal(conv._id, e as any); }}>Share</button>
                                <button
                                  onClick={e => { e.stopPropagation(); setFolderSubMenuConvId(folderSubMenuConvId === conv._id ? null : conv._id); }}
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                  Move to folder <span style={{ opacity: 0.5, fontSize: 10 }}>▶</span>
                                </button>
                                {folderSubMenuConvId === conv._id && (
                                  <div className="folder-submenu">
                                    {folders.length === 0 ? (
                                      <span className="folder-submenu-empty">No folders yet</span>
                                    ) : folders.map(f => (
                                      <button key={f._id} onClick={() => handleAddToFolder(f._id, conv._id)}>
                                        <MdFolder size={12} style={{ marginRight: 6, flexShrink: 0 }} />
                                        {f.name}
                                      </button>
                                    ))}
                                    <button
                                      style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 2, paddingTop: 6 }}
                                      onClick={() => { setIsCreatingFolder(true); setNewFolderName(""); setActiveMenuId(null); setFolderSubMenuConvId(null); }}
                                    >
                                      <MdCreateNewFolder size={12} style={{ marginRight: 6 }} /> New folder
                                    </button>
                                  </div>
                                )}
                                <button onClick={e => { handleContextMenuDelete(conv._id, e as any); setActiveMenuId(null); }}>Delete</button>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    );
                  })()}
                  {!isHistoryCollapsed && conversationsHasMore && (
                    <button className="show-more-btn" onClick={loadMoreConversations} disabled={isLoadingMoreConversations}>
                      <BiChevronDown size={18} />
                      <span>{isLoadingMoreConversations ? 'Loading...' : 'Show more'}</span>
                    </button>
                  )}
                </>
              );
            })()}
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
              {user?.profilePicture ? (
                <img className="user-avatar-v2-img" src={user.profilePicture} alt="" />
              ) : (
                userInitials || "U"
              )}
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
              role="button"
              tabIndex={0}
              title="Start a new chat"
              style={{ cursor: 'pointer' }}
              aria-label={user?.tenantLabel || user?.businessUnit || "Nexa"}
              onClick={handleNewChat}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNewChat(); } }}
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
              {/* Share this conversation — header-level entry point. Only shown when there's
                  a real conversation loaded and it's the user's own (not a shared-with-me view). */}
              {currentConversation?._id && !currentConversation?.isShared && (currentConversation.messages?.length ?? 0) > 0 ? (
                <button
                  type="button"
                  className="header-action-btn-v2"
                  aria-label="Share conversation"
                  onClick={() => handleOpenShareModal(currentConversation._id!, { stopPropagation: () => {} } as React.MouseEvent)}
                >
                  <BiShareAlt size={18} />
                  <span className="header-action-label-v2">Share</span>
                </button>
              ) : null}
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

          {!isUserChatProfile &&
            currentConversation?.pinnedMessage &&
            !currentConversation.isShared &&
            (currentConversation.messages?.length ?? 0) > 0 && (
            <div className="group-pinned-bar group-pinned-bar--under-header" title="Pinned message">
              <div className="group-pinned-bar-inner">
                <span className="group-pinned-icon"><MdPushPin size={14} /></span>
                <span className="group-pinned-text">
                  {currentConversation.pinnedMessage.senderName
                    ? `${currentConversation.pinnedMessage.senderName}: `
                    : ""}
                  {messageSnippet(currentConversation.pinnedMessage.content, 120)}
                </span>
                <button
                  type="button"
                  className="group-pinned-unpin"
                  title="Unpin"
                  onClick={() => void handleUnpinMessage()}
                >
                  ×
                </button>
              </div>
            </div>
          )}

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

                <RateLimitBanner info={rateLimit} onExpire={() => setRateLimit(null)} />

                <div className="main-input-container-v2">
                  {attachError && (
                    <div className="attach-error" role="alert">{attachError}</div>
                  )}
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
                      <ModelToggle />
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
                      className={`send-btn-v2${loading ? ' is-stop' : ''}`}
                      onClick={loading ? handleStop : handleSend}
                      disabled={loading ? false : ((!input.trim() && attachedFiles.length === 0) || isRateLimited)}
                      title={loading ? 'Stop generating' : 'Send'}
                      aria-label={loading ? 'Stop generating' : 'Send'}
                    >
                      {loading ? <span className="stop-square" /> : <BiUpArrowAlt size={24} />}
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
                  {currentConversation?.isShared ? (
                    <div className="shared-banner">
                      <span className="shared-banner-icon">🔒</span>
                      <div className="shared-banner-text">
                        <div className="shared-banner-title">Read-only — shared with you</div>
                        <div className="shared-banner-meta">
                          From {currentConversation.sharedBy?.fullName || currentConversation.sharedBy?.email || "another user"}
                          {currentConversation.redactedMessageCount && currentConversation.redactedMessageCount > 0
                            ? ` · ${currentConversation.redactedMessageCount} message${currentConversation.redactedMessageCount === 1 ? "" : "s"} hidden by access controls`
                            : ""}
                        </div>
                        {(() => {
                          const convId = String(currentConversation._id);
                          const status = accessRequestStatus[convId] || 'idle';
                          const sharerId = currentConversation.sharedBy?.userId;
                          if (!sharerId) return null;
                          if (status === 'pending') return (
                            <div className="shared-banner-request-sent">⏳ Request sent — waiting for approval</div>
                          );
                          if (status === 'accepted') return (
                            <div className="shared-banner-request-sent" style={{ color: '#16a34a' }}>✓ Access granted — check your recent chats</div>
                          );
                          if (status === 'rejected') return (
                            <div className="shared-banner-request-sent" style={{ color: '#dc2626' }}>✕ Request declined by sharer</div>
                          );
                          return (
                            <button
                              className="shared-banner-request-btn"
                              onClick={() => handleAccessRequest(convId, sharerId)}
                            >
                              Request access to continue conversation with Nexa
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ) : null}
                  {(currentConversation?.messages ?? []).map((m, idx) => {
                    // Treat plain (non-collaborative) user messages as "own" so the current
                    // user's avatar still shows next to them.
                    const isOwn = m.role === 'user' && (!m.senderId || m.senderId === user?.id);
                    const senderInitials = isOwn
                      ? (userInitials || 'U')
                      : (m.senderName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    const senderAvatar = m.role === 'user'
                      ? (isOwn ? (user?.profilePicture || undefined) : avatarById.get(String(m.senderId)))
                      : undefined;
                    const msgId = m.messageId || `idx-${idx}`;
                    return (
                    <div key={msgId} className={`message-row-v2 ${m.role}${m.redacted ? ' redacted' : ''}`}>
                      {m.role === 'assistant' && (
                        <div className="message-avatar-v2">
                          <img src={selectedAvatar || "/avatar-1.png"} alt="Nexa" className="bot-avatar-img" />
                        </div>
                      )}
                      <div
                        className="message-bubble-wrap-v2"
                        onDoubleClick={(e) => {
                          if (!canOpenMessageMenu) return;
                          e.preventDefault();
                          e.stopPropagation();
                          openMessageMenu(idx, e.clientX, e.clientY);
                        }}
                        onContextMenu={(e) => {
                          if (!canOpenMessageMenu) return;
                          e.preventDefault();
                          e.stopPropagation();
                          openMessageMenu(idx, e.clientX, e.clientY);
                        }}
                      >
                        {m.role === 'user' && (
                          <div className={`msg-user-avatar${isOwn ? ' own' : ''}`} title={isOwn ? 'You' : (m.senderName || 'Collaborator')}>
                            {senderAvatar ? (
                              <img src={senderAvatar} alt="" />
                            ) : (
                              senderInitials
                            )}
                          </div>
                        )}
                        {(() => {
                          if (!m.imageUrls || m.imageUrls.length === 0) return null;
                          return (
                            <div className="message-image-attach-row">
                              {m.imageUrls.map((url, iIdx) => (
                                <button
                                  key={iIdx}
                                  type="button"
                                  className="message-image-attach-card"
                                  onClick={() => setImageLightboxUrl(url)}
                                  aria-label="View attached image"
                                >
                                  <img src={url} alt="Attached image" />
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                        {(() => {
                          // Document attachment cards render ABOVE the message bubble.
                          const docFileNames = (m.content || "")
                            .split("\n")
                            .filter((l) => l.startsWith("📎"))
                            .flatMap((l) =>
                              l.replace(/^📎\s*/, "").split(",").map((n) => n.trim()).filter(Boolean)
                            );
                          if (docFileNames.length === 0) return null;
                          const isDark = theme === "dark";
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                              {docFileNames.map((fname, fIdx) => {
                                const ext = (fname.split(".").pop() || "file").toUpperCase();
                                return (
                                  <div
                                    key={fIdx}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 12,
                                      padding: "10px 14px",
                                      borderRadius: 14,
                                      maxWidth: 320,
                                      background: isDark ? "rgba(255,255,255,0.04)" : "#f4f4f5",
                                      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 40,
                                        height: 40,
                                        flexShrink: 0,
                                        borderRadius: 10,
                                        background: "#ed0000",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <FiFileText size={20} color="#fff" />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontWeight: 700,
                                          fontSize: 14,
                                          lineHeight: 1.3,
                                          color: isDark ? "#fff" : "#18181b",
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {fname}
                                      </div>
                                      <div style={{ fontSize: 12, color: isDark ? "rgba(255,255,255,0.55)" : "#71717a" }}>
                                        {ext}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        <div className="message-bubble-v2">
                          {m.replyTo ? (
                            <div className="message-reply-quote">
                              <span className="message-reply-quote-name">{m.replyTo.senderName || "Message"}</span>
                              <span className="message-reply-quote-text">{messageSnippet(m.replyTo.content, 100)}</span>
                            </div>
                          ) : null}
                          {(() => {
                                // Only the text lines render inside the bubble; 📎 attachment lines
                                // and images are rendered as cards above the bubble.
                                const textLines = (m.content || "").split("\n").filter(l => !l.startsWith("📎"));
                                if (!textLines.some(l => l.trim())) return null;
                                return (
                                  <div>
                                    {textLines.map((line, lIdx) => (
                                      <p key={lIdx}>{parseMarkdown(line)}</p>
                                    ))}
                                  </div>
                                );
                              })()}
                          {m.role === "assistant" && m.sources && m.sources.length > 0 ? (
                            <div className="message-sources-v2">
                              <span className="message-sources-label-v2">Sources</span>
                              {m.sources.map((s) => {
                                const isWeb = s.documentType === "web";
                                const content = (
                                  <>
                                    <span className="message-source-pill-icon-v2">
                                      {isWeb ? <BiLink size={12} /> : <BiLibrary size={12} />}
                                    </span>
                                    <span className="message-source-pill-title-v2">{s.title}</span>
                                    {!isWeb && typeof s.version === "number" && s.version > 0 ? (
                                      <span className="message-source-pill-version-v2">v{s.version}</span>
                                    ) : null}
                                  </>
                                );
                                return s.url ? (
                                  <a
                                    key={s.documentId}
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="message-source-pill-v2"
                                    title={s.title}
                                  >
                                    {content}
                                  </a>
                                ) : (
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
                        {m.reactions && m.reactions.length > 0 ? (
                          <div className="message-reactions-row">
                            {(() => {
                              const grouped = new Map<string, { count: number; mine: boolean }>();
                              for (const r of m.reactions) {
                                const entry = grouped.get(r.emoji) || { count: 0, mine: false };
                                entry.count += 1;
                                if (String(r.userId) === String(user?.id)) entry.mine = true;
                                grouped.set(r.emoji, entry);
                              }
                              return [...grouped.entries()].map(([emoji, info]) =>
                                info.mine ? (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="message-reaction-chip message-reaction-chip--mine"
                                    title="Click to remove your reaction"
                                    onClick={() => {
                                      if (m.messageId) void handleMessageReaction(m.messageId, emoji, idx);
                                    }}
                                  >
                                    {emoji}{info.count > 1 ? ` ${info.count}` : ""}
                                  </button>
                                ) : (
                                  <span key={emoji} className="message-reaction-chip" title={emoji}>
                                    {emoji}{info.count > 1 ? ` ${info.count}` : ""}
                                  </span>
                                )
                              );
                            })()}
                          </div>
                        ) : null}
                        <div className="message-copy-stack-v2">
                          <button
                            type="button"
                            className={`message-copy-btn-v2${copiedMessageIndex === idx ? " copied" : ""}`}
                            title={copiedMessageIndex === idx ? "Copied" : "Copy message"}
                            aria-label={copiedMessageIndex === idx ? "Copied" : "Copy message"}
                            onClick={() => void copyMessageText(m.content, idx)}
                          >
                            {copiedMessageIndex === idx ? <BiCheck size={16} /> : <BiCopy size={16} />}
                          </button>
                          {/* Share single AI response. Only render on assistant messages, in your
                              own conversations (not on a shared-with-me view), and not on redacted
                              ones since there's nothing to share. */}
                          {m.role === "assistant" && !currentConversation?.isShared && !m.redacted && currentConversation?._id ? (
                            <button
                              type="button"
                              className="message-copy-btn-v2"
                              title="Share this response"
                              aria-label="Share this response"
                              onClick={() => handleOpenShareMessageModal(currentConversation._id, idx)}
                            >
                              <BiShareAlt size={16} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                  {loading && currentConversation?.messages?.[currentConversation.messages.length - 1]?.role !== "assistant" && (
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
                  {isActiveGroupChat && collaborativeTypers.length > 0 && (
                    <div className="collab-typing-bar" aria-live="polite">
                      <span className="collab-typing-label">{formatCollabTypingLabel(collaborativeTypers)}</span>
                      <span className="collab-typing-dots typing-v2">
                        <span className="dot-v2"></span>
                        <span className="dot-v2"></span>
                        <span className="dot-v2"></span>
                      </span>
                    </div>
                  )}
                  {messageMenu && canOpenMessageMenu && (() => {
                    const m = currentConversation?.messages?.[messageMenu.idx];
                    if (!m) return null;
                    const msgId = m.messageId || `idx-${messageMenu.idx}`;
                    return (
                      <>
                        <div className="message-menu-backdrop" onClick={() => { setMessageMenu(null); setReactPickerAnchor(null); }} />
                        <div
                          className="message-action-menu"
                          style={{ left: Math.min(messageMenu.x, window.innerWidth - 200), top: Math.min(messageMenu.y, window.innerHeight - 220) }}
                          role="menu"
                        >
                          <button type="button" role="menuitem" onClick={() => {
                            setReplyTarget({
                              messageId: msgId,
                              senderName: m.role === "assistant" ? "Nexa AI" : (m.senderName || "User"),
                              snippet: messageSnippet(m.content),
                            });
                            setMessageMenu(null);
                            textareaRef.current?.focus();
                          }}>
                            <BiReply size={16} /> Reply
                          </button>
                          <button type="button" role="menuitem" onClick={() => {
                            if (!messageMenu) return;
                            const opening = reactPickerAnchor?.msgId !== msgId;
                            setMessageMenu(null);
                            setReactPickerAnchor(
                              opening
                                ? { msgId, messageIdx: messageMenu.idx, x: messageMenu.x, y: messageMenu.y }
                                : null
                            );
                          }}>
                            <BiSmile size={16} /> React
                          </button>
                          <button type="button" role="menuitem" onClick={() => void copyMessageText(m.content, messageMenu.idx, { closeMenu: true })}>
                            <BiCopy size={16} /> Copy
                          </button>
                          <button type="button" role="menuitem" onClick={() => void handlePinMessage(m, messageMenu.idx)}>
                            <MdPushPin size={16} /> Pin
                          </button>
                        </div>
                      </>
                    );
                  })()}
                  {reactPickerAnchor && (() => {
                    const m = currentConversation?.messages?.[reactPickerAnchor.messageIdx];
                    if (!m) return null;
                    const msgId = m.messageId || `idx-${reactPickerAnchor.messageIdx}`;
                    const myReaction =
                      m.reactions?.find((r) => String(r.userId) === String(user?.id))?.emoji ?? null;
                    return (
                      <ReactionEmojiPicker
                        anchorX={reactPickerAnchor.x}
                        anchorY={reactPickerAnchor.y + 48}
                        activeReaction={myReaction}
                        onSelect={(emoji) =>
                          void handleMessageReaction(m.messageId || msgId, emoji, reactPickerAnchor.messageIdx)
                        }
                        onClose={() => setReactPickerAnchor(null)}
                      />
                    );
                  })()}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}
          </section>

          {((currentConversation?.messages?.length ?? 0) > 0 || loading) && !currentConversation?.isShared && (
            <footer className="footer-input-v2" onClick={(e) => e.stopPropagation()}>
              <RateLimitBanner info={rateLimit} onExpire={() => setRateLimit(null)} />
              {attachError && (
                <div className="attach-error" role="alert">{attachError}</div>
              )}
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
              {replyTarget && canOpenMessageMenu && (
                <div className="reply-preview-bar">
                  <div className="reply-preview-accent" />
                  <div className="reply-preview-body">
                    <div className="reply-preview-label">Replying to {replyTarget.senderName || "message"}</div>
                    <div className="reply-preview-snippet">{replyTarget.snippet}</div>
                  </div>
                  <button type="button" className="reply-preview-close" aria-label="Cancel reply" onClick={() => setReplyTarget(null)}>
                    ✕
                  </button>
                </div>
              )}
              <div className="footer-input-container-v2">
                <ModelToggle />
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
                {mentionQuery !== null && (() => {
                  const matches = getMentionMatches(mentionQuery);
                  return (
                    <div className="mention-dropdown">
                      {matches.map((u, idx) => (
                        <button
                          key={u._id}
                          className={`mention-option${idx === mentionActiveIndex ? ' mention-option--active' : ''}`}
                          onMouseEnter={() => setMentionActiveIndex(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectMention(u);
                          }}
                        >
                          {u.profilePicture ? (
                            <img className="mention-avatar mention-avatar--img" src={u.profilePicture} alt="" />
                          ) : (
                            <span className={`mention-avatar${(u as { isNexa?: boolean }).isNexa ? ' mention-avatar--nexa' : ''}`}>
                              {(u as { isNexa?: boolean }).isNexa ? 'N' : u.fullName.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="mention-name">{u.fullName}</span>
                          {(u as { isNexa?: boolean }).isNexa ? (
                            <span className="mention-role-badge">AI</span>
                          ) : u.isAdmin ? <span className="mention-role-badge">Admin</span> : null}
                          <span className="mention-email">{u.email}</span>
                        </button>
                      ))}
                      {matches.length === 0 && (
                        <div className="mention-empty">No users found</div>
                      )}
                    </div>
                  );
                })()}
                <div className="footer-textarea-shell">
                  {mentionGhostSuffix && (
                    <div className="footer-ghost" aria-hidden="true">
                      <span className="footer-ghost-typed">{input}</span>
                      <span className="footer-ghost-suffix">{mentionGhostSuffix}</span>
                    </div>
                  )}
                  <textarea
                    className="footer-textarea-v2"
                    placeholder={isActiveGroupChat ? "Message the group… (@Nexa AI to ask Nexa)" : "Send a message... (type @ to mention someone)"}
                    value={input}
                    onChange={(e) => handleComposerInput(e.target.value, e.target, 200)}
                    onBlur={stopCollaborativeTyping}
                    ref={(el) => {
                      (textareaRef as any).current = el;
                      if (el && !input) el.style.height = "";
                    }}
                    onKeyDown={(e) => {
                      // When the @mention autocomplete is open, arrow keys navigate it and
                      // Enter/Tab (or → at the end) accepts the highlighted user instead of
                      // sending the message.
                      if (mentionQuery !== null) {
                        const matches = getMentionMatches(mentionQuery);
                        if (matches.length > 0) {
                          if (e.key === 'ArrowDown') { e.preventDefault(); setMentionActiveIndex(i => (i + 1) % matches.length); return; }
                          if (e.key === 'ArrowUp') { e.preventDefault(); setMentionActiveIndex(i => (i - 1 + matches.length) % matches.length); return; }
                          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(matches[Math.min(mentionActiveIndex, matches.length - 1)]); return; }
                          if (e.key === 'ArrowRight' && mentionGhostSuffix) {
                            const el = e.currentTarget;
                            if (el.selectionStart === el.value.length) { e.preventDefault(); selectMention(matches[0]); return; }
                          }
                        }
                        if (e.key === 'Escape') { setMentionQuery(null); return; }
                      }
                      handleKeyDown(e);
                    }}
                    rows={1}
                  />
                </div>
                <button
                  className={`footer-send-btn-v2${loading ? ' is-stop' : ''}`}
                  onClick={loading ? handleStop : handleSend}
                  disabled={loading ? false : ((!input.trim() && attachedFiles.length === 0) || isRateLimited)}
                  title={loading ? 'Stop generating' : 'Send'}
                  aria-label={loading ? 'Stop generating' : 'Send'}
                >
                  {loading ? <span className="stop-square" /> : <BiUpArrowAlt size={20} />}
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

          {softToastMessage && (
            <div className="copy-toast-v2" role="status" aria-live="polite">
              {softToastMessage}
            </div>
          )}
        </main>

        <WebcamCaptureModal
          open={webcamOpen}
          onClose={() => setWebcamOpen(false)}
          onCapture={(file) => setAttachedFiles((prev) => [...prev, file])}
        />

        {imageLightboxUrl && (
          <div
            className="image-lightbox-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={() => setImageLightboxUrl(null)}
          >
            <button
              type="button"
              className="image-lightbox-close"
              aria-label="Close image"
              onClick={(e) => {
                e.stopPropagation();
                setImageLightboxUrl(null);
              }}
            >
              <BiX size={26} />
            </button>
            <img
              src={imageLightboxUrl}
              alt="Attached image enlarged"
              className="image-lightbox-img"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Modals */}
        {profilePicPromptOpen && user && !user.profilePicture && (
          <div className="modal-overlay-v2 profile-pic-prompt-overlay">
            <div className="modal-card-v2 profile-pic-prompt-card">
              <div className="profile-pic-prompt-avatar" aria-hidden="true">
                {(user.fullName || user.email || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div className="modal-header-v2">
                <h3>Add a profile picture</h3>
                <p>
                  Help your teammates recognize you in group chats. You can upload a photo now or do it later from your profile.
                </p>
              </div>
              <input
                ref={profilePicInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: "none" }}
                onChange={handleProfilePicPromptUpload}
              />
              <div className="modal-footer-v2 profile-pic-prompt-actions">
                <button
                  type="button"
                  className="modal-btn-v2 secondary"
                  onClick={() => dismissProfilePicPrompt("later")}
                  disabled={profilePicUploading}
                >
                  Upload later
                </button>
                <button
                  type="button"
                  className="modal-btn-v2 primary"
                  disabled={profilePicUploading}
                  onClick={() => profilePicInputRef.current?.click()}
                >
                  {profilePicUploading ? "Uploading…" : "Upload now"}
                </button>
              </div>
            </div>
          </div>
        )}

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

        {shareModalConvId && (
          <div className="modal-overlay-v2">
            <div className="modal-card-v2">
              <div className="modal-header-v2">
                <h3>{shareMessageIndex !== null ? "Share AI response" : "Share conversation"}</h3>
                <p>
                  {shareMessageIndex !== null
                    ? "Anyone in your business unit can open this — but if the response cited documents they don't have permission to view, it'll be hidden from them."
                    : "Anyone in your business unit can open this — but messages that cited documents they don't have permission to view will be hidden from them."}
                </p>
              </div>

              {/* Copy link — primary path */}
              <div className="share-link-row">
                <input
                  type="text"
                  className="share-link-input"
                  value={shareLinkLoading ? "Generating link…" : shareLinkUrl}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className="share-link-copy-btn"
                  onClick={copyShareLink}
                  disabled={!shareLinkUrl || shareLinkLoading}
                  aria-label="Copy share link"
                >
                  {shareLinkCopied ? <BiCheck size={16} /> : <BiCopy size={16} />}
                  <span>{shareLinkCopied ? "Copied" : "Copy link"}</span>
                </button>
              </div>

              <div className="share-divider"><span>or send by email</span></div>

              <form onSubmit={confirmShareConversation}>
                <input
                  className="modal-input-v2"
                  type="email"
                  placeholder="teammate@company.com"
                  value={shareRecipientEmail}
                  onChange={(e) => setShareRecipientEmail(e.target.value)}
                  required
                  disabled={shareSubmitting}
                />
                {shareError ? (
                  <div className="modal-error-v2">{shareError}</div>
                ) : null}
                <div className="modal-footer-v2">
                  <button
                    type="button"
                    className="modal-btn-v2 secondary"
                    onClick={() => {
                      if (shareSubmitting) return;
                      setShareModalConvId(null);
                      setShareMessageIndex(null);
                      setShareError("");
                      setShareRecipientEmail("");
                      setShareLinkUrl("");
                      setShareLinkCopied(false);
                    }}
                    disabled={shareSubmitting}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="modal-btn-v2 primary"
                    disabled={shareSubmitting || !shareRecipientEmail.trim()}
                  >
                    {shareSubmitting ? "Sending…" : "Send invite"}
                  </button>
                </div>
              </form>
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

        /* ── Folder styles ── */
        .folder-group {
          display: flex;
          flex-direction: column;
        }
        .folder-header {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px 5px 10px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          color: var(--sidebar-text, #374151);
          position: relative;
          user-select: none;
        }
        .folder-header:hover { background: var(--sidebar-hover, rgba(0,0,0,0.05)); }
        .folder-name { flex: 1; truncate; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .folder-count { font-size: 10px; font-weight: 700; opacity: 0.4; }
        .folder-conv { padding-left: 24px !important; }
        .folder-create-row {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
        }
        .folder-name-input {
          flex: 1;
          font-size: 12px;
          padding: 4px 8px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          outline: none;
          background: white;
          color: #111;
        }
        .folder-name-input:focus { border-color: var(--brand-color, #ed0000); }
        .folder-name-input.inline { font-size: 12px; height: 22px; padding: 2px 6px; max-width: 100px; }
        .folder-confirm-btn, .folder-cancel-btn {
          background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 5px; border-radius: 4px;
        }
        .folder-confirm-btn { color: #16a34a; }
        .folder-confirm-btn:disabled { opacity: 0.3; cursor: default; }
        .folder-cancel-btn { color: #6b7280; }
        .folder-submenu {
          display: flex;
          flex-direction: column;
          background: #f9fafb;
          border-top: 1px solid #f0f0f0;
          margin: 0 -1px;
          padding: 2px 0;
        }
        .folder-submenu button {
          display: flex; align-items: center; padding: 8px 14px; font-size: 12px;
        }
        .folder-submenu-empty {
          padding: 6px 14px; font-size: 11px; color: #9ca3af; display: block;
        }

        /* @mention dropdown */
        .mention-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0; right: 0;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          z-index: 200;
          overflow: hidden;
          max-height: 220px;
          overflow-y: auto;
        }
        .dark-theme .mention-dropdown { background: #1e1e1e; border-color: #333; }
        .mention-option {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 9px 14px;
          border: none; background: transparent; cursor: pointer; text-align: left;
        }
        .mention-option:hover,
        .mention-option--active { background: #f3f4f6; }
        .dark-theme .mention-option:hover,
        .dark-theme .mention-option--active { background: rgba(255,255,255,0.07); }
        .mention-avatar {
          width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
          background: var(--brand-color, #ed0000); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
        }
        .mention-avatar--img { object-fit: cover; padding: 0; }
        .mention-name { font-size: 13px; font-weight: 700; color: #111; flex: 0 0 auto; }
        .dark-theme .mention-name { color: #f3f4f6; }
        .mention-role-badge {
          font-size: 9px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--brand-color, #ed0000); background: rgba(237,0,0,0.1);
          padding: 1px 6px; border-radius: 999px; flex-shrink: 0;
        }
        .mention-email { font-size: 11px; color: #9ca3af; flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mention-empty { padding: 10px 14px; font-size: 12px; color: #9ca3af; text-align: center; }

        /* Sidebar mini avatars (shared-by / group participants) */
        .mini-avatar-row { display: flex; align-items: center; padding-left: 2px; }
        .mini-avatar-row .mini-avatar { margin-left: -6px; }
        .mini-avatar-row .mini-avatar:first-child { margin-left: 0; }
        .mini-avatar {
          width: 22px; height: 22px; border-radius: 50%;
          object-fit: cover; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--brand-color, #ed0000); color: #fff;
          font-size: 9px; font-weight: 800; letter-spacing: 0.2px;
          border: 1.5px solid #f3f4f6;
        }
        .mini-avatar--more { background: #6b7280; font-size: 8px; }
        .dark-theme .mini-avatar { border-color: #1e1e1e; }

        /* Dark theme overrides for folders */
        .dark-theme .folder-header { color: rgba(255,255,255,0.75); }
        .dark-theme .folder-header:hover { background: rgba(255,255,255,0.08); }
        .dark-theme .folder-name-input { background: #2a2a2a; border-color: #444; color: #fff; }
        .dark-theme .folder-name-input:focus { border-color: var(--brand-color, #ed0000); }
        .dark-theme .folder-submenu { background: #2a2a2a; border-top-color: rgba(255,255,255,0.08); }
        .dark-theme .folder-submenu button { color: rgba(255,255,255,0.8); }
        .dark-theme .folder-submenu button:hover { background: rgba(255,255,255,0.08); }
        .dark-theme .conv-dropdown { background: #1e1e1e; border-color: #333; }
        .dark-theme .conv-dropdown button { color: rgba(255,255,255,0.8); }
        .dark-theme .conv-dropdown button:hover { background: rgba(255,255,255,0.08); color: var(--brand-color, #ed0000); }

        /* Shared-with-me sidebar list */
        .shared-with-me-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 8px 8px;
        }
        .shared-with-me-list .conversation-item-v2 {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 8px 12px;
          width: 100%;
          background: transparent;
          border: 0;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          color: inherit;
          transition: background 0.15s ease;
        }
        .shared-with-me-list .conversation-item-v2:hover {
          background: rgba(0,0,0,0.04);
        }
        .shared-with-me-list .conversation-item-v2.active {
          background: rgba(237, 0, 0, 0.06);
        }
        .dark-theme .shared-with-me-list .conversation-item-v2:hover {
          background: rgba(255,255,255,0.05);
        }
        .shared-conv-title {
          font-size: 14px;
          font-weight: 600;
          color: inherit;
          line-height: 1.3;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .shared-meta {
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
        }

        /* Read-only banner above the message thread */
        .shared-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 18px;
          margin-bottom: 16px;
          background: rgba(237, 0, 0, 0.04);
          border: 1px solid rgba(237, 0, 0, 0.18);
          border-radius: 14px;
        }
        .shared-banner-icon {
          font-size: 18px;
          line-height: 1;
        }
        .shared-banner-text { display: flex; flex-direction: column; gap: 2px; }
        .shared-banner-title {
          font-size: 13px;
          font-weight: 700;
          color: #1a1a1a;
          letter-spacing: 0.01em;
        }
        .dark-theme .shared-banner-title { color: #f3f4f6; }
        .shared-banner-meta {
          font-size: 12px;
          font-weight: 500;
          color: #6b7280;
        }
        .dark-theme .shared-banner-meta { color: #9ca3af; }
        /* Collaborative conversation sender badge — sits top-right of the bubble */
        .collab-sender-badge {
          align-self: flex-end;
          min-width: 24px; height: 22px; padding: 0 7px;
          border-radius: 7px; flex-shrink: 0;
          background: var(--brand-color, #ed0000); color: #fff;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
        }
        /* Your own messages get a quieter, outlined badge labelled "You" */
        .collab-sender-badge.own {
          background: transparent;
          color: var(--brand-color, #ed0000);
          border: 1px solid var(--brand-color, #ed0000);
          font-weight: 700;
        }
        .dark-theme .collab-sender-badge.own { color: #f3f4f6; border-color: #4b5563; }
        /* When a sender has a profile picture, the badge becomes a round avatar. */
        .collab-sender-badge:has(.collab-sender-avatar-img) {
          padding: 0; background: transparent; border: none; width: 24px; height: 24px; min-width: 24px;
        }
        .collab-sender-avatar-img {
          width: 24px; height: 24px; border-radius: 50%; object-fit: cover;
          border: 1px solid rgba(0,0,0,0.08);
        }
        .dark-theme .collab-sender-avatar-img { border-color: rgba(255,255,255,0.15); }

        .shared-banner-request-btn {
          margin-top: 10px;
          align-self: flex-start;
          background: var(--brand-color, #ed0000);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .shared-banner-request-btn:hover { opacity: 0.85; }
        .shared-banner-request-sent {
          margin-top: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
        }

        /* Redacted message style — kept subtle so the conversation reads naturally */
        .message-row-v2.redacted .message-bubble-v2 {
          background: repeating-linear-gradient(
            45deg,
            rgba(15, 23, 42, 0.025),
            rgba(15, 23, 42, 0.025) 10px,
            rgba(15, 23, 42, 0.05) 10px,
            rgba(15, 23, 42, 0.05) 20px
          );
          color: #6b7280;
          font-style: italic;
        }
        .dark-theme .message-row-v2.redacted .message-bubble-v2 {
          background: repeating-linear-gradient(
            45deg,
            rgba(255,255,255,0.04),
            rgba(255,255,255,0.04) 10px,
            rgba(255,255,255,0.06) 10px,
            rgba(255,255,255,0.06) 20px
          );
          color: #9ca3af;
        }

        /* Share modal input + error */
        .modal-input-v2 {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
          margin-top: 8px;
          background: #fff;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .modal-input-v2:focus {
          border-color: var(--brand-color, #ed0000);
          box-shadow: 0 0 0 3px rgba(237, 0, 0, 0.08);
        }
        .modal-input-v2:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .dark-theme .modal-input-v2 {
          background: #1a1a1a;
          color: #f3f4f6;
          border-color: #333;
        }
        .modal-error-v2 {
          margin-top: 10px;
          padding: 10px 12px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          color: #b91c1c;
          font-size: 12px;
          font-weight: 600;
        }

        /* Share-link row: read-only URL field + Copy link action */
        .share-link-row {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }
        .share-link-input {
          flex: 1;
          height: 44px;
          padding: 0 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          color: #1a1a1a;
          background: #fafafa;
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
          outline: none;
          cursor: text;
        }
        .dark-theme .share-link-input {
          background: #161616;
          color: #f3f4f6;
          border-color: #333;
        }
        .share-link-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 44px;
          padding: 0 16px;
          border: 0;
          border-radius: 12px;
          background: #1a1a1a;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease, opacity 0.15s ease;
          flex-shrink: 0;
        }
        .share-link-copy-btn:hover:not(:disabled) {
          background: #000;
        }
        .share-link-copy-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .share-link-copy-btn svg { display: block; }
        .dark-theme .share-link-copy-btn {
          background: #f3f4f6;
          color: #0f172a;
        }
        .dark-theme .share-link-copy-btn:hover:not(:disabled) {
          background: #fff;
        }

        /* "or send by email" divider */
        .share-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 18px 0 4px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9ca3af;
        }
        .share-divider::before,
        .share-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #e5e7eb;
        }
        .dark-theme .share-divider::before,
        .dark-theme .share-divider::after { background: #333; }

        /* Copy-message button: when in copied state, swap to a black check mark */
        .message-copy-btn-v2.copied {
          color: #0f172a !important;
          opacity: 1 !important;
        }
        .dark-theme .message-copy-btn-v2.copied {
          color: #f3f4f6 !important;
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
          overflow: hidden;
          flex-shrink: 0;
        }

        .user-avatar-v2-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
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

        .attach-error {
          margin: 0 8px 8px;
          padding: 8px 12px;
          border-radius: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 12.5px;
          line-height: 1.4;
        }
        .dark-theme .attach-error {
          background: rgba(237, 0, 0, 0.12);
          border-color: rgba(237, 0, 0, 0.4);
          color: #fca5a5;
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

        .model-select {
          padding: 4px 24px 4px 10px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid rgba(0,0,0,0.15);
          border-radius: 8px;
          background: white;
          color: var(--brand-color, #ed0000);
          cursor: pointer;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          flex-shrink: 0;
        }
        .dark-theme .model-select {
          background-color: #2a2a2a;
          border-color: rgba(255,255,255,0.15);
          color: var(--brand-color, #ed0000);
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
          user-select: none;
          -webkit-user-select: none;
        }

        .message-row-v2.user .message-bubble-wrap-v2 {
          align-items: flex-end;
        }

        /* Assistant: copy button sits to the right of the response bubble. */
        .message-row-v2.assistant .message-bubble-wrap-v2 {
          flex-direction: row;
          align-items: flex-start;
          gap: 8px;
        }

        .message-copy-stack-v2 {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          min-height: 22px;
        }

        .message-row-v2.assistant .message-copy-stack-v2 {
          padding-top: 4px;
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

        /* User avatar shown at the top-right, above their message bubble. */
        .msg-user-avatar {
          align-self: flex-end;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          background: var(--brand-color, #ed0000);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.3px;
        }
        @media (min-width: 640px) {
          .msg-user-avatar {
            width: 48px;
            height: 48px;
            font-size: 16px;
          }
        }
        .msg-user-avatar.own { background: #111827; }
        .msg-user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
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

        /* Document attachment chips — rendered in chat history for 📎-prefixed lines */
        .message-doc-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .message-doc-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px 5px 8px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.08);
          font-size: 12px;
          max-width: 260px;
          transition: background 0.15s;
        }
        .dark-theme .message-doc-chip {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
        .doc-chip-icon {
          font-size: 14px;
          flex-shrink: 0;
        }
        .doc-chip-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
          font-weight: 500;
          color: #374151;
        }
        .dark-theme .doc-chip-name {
          color: #d1d5db;
        }
        .doc-chip-ext {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--brand-color, #ed0000);
          background: color-mix(in srgb, var(--brand-color, #ed0000) 10%, transparent);
          padding: 1px 5px;
          border-radius: 4px;
          flex-shrink: 0;
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
          text-decoration: none;
          color: inherit;
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

        .message-image-attach-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
          max-width: 320px;
        }

        .message-image-attach-card {
          display: block;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: #f4f4f5;
          line-height: 0;
          padding: 0;
          cursor: zoom-in;
        }

        .message-image-attach-card img {
          display: block;
          width: 160px;
          max-height: 200px;
          object-fit: cover;
        }

        .dark-theme .message-image-attach-card {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
        }

        .image-lightbox-overlay {
          position: fixed;
          inset: 0;
          z-index: 1400;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 24px 24px;
          background: rgba(0, 0, 0, 0.88);
          backdrop-filter: blur(6px);
          animation: modalFadeIn 0.2s ease-out;
        }

        .image-lightbox-close {
          position: fixed;
          top: max(16px, env(safe-area-inset-top, 16px));
          left: max(16px, env(safe-area-inset-left, 16px));
          z-index: 1401;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border: none;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          cursor: pointer;
        }

        .image-lightbox-close:hover {
          background: rgba(255, 255, 255, 0.24);
        }

        .image-lightbox-img {
          max-width: min(960px, 100%);
          max-height: calc(100vh - 96px);
          object-fit: contain;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
        }

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

        .collab-typing-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 4px 10px;
          margin-left: 52px;
          opacity: 0.55;
          animation: collab-typing-in 0.2s ease;
        }

        @keyframes collab-typing-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 0.55; transform: translateY(0); }
        }

        .collab-typing-label {
          font-size: 13px;
          font-style: italic;
          color: #6b7280;
          letter-spacing: 0.01em;
        }

        .collab-typing-dots {
          padding: 0;
        }

        .collab-typing-dots .dot-v2 {
          width: 5px;
          height: 5px;
        }

        .group-pinned-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 12px 52px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #f5f0e8;
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .group-pinned-bar--under-header {
          flex-shrink: 0;
          margin: 0;
          padding: 10px clamp(12px, 3vw, 28px);
          border-radius: 0;
          border: none;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          background: #faf6f0;
          box-shadow: none;
          z-index: 4;
        }

        .group-pinned-bar-inner {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          max-width: min(880px, 100%);
          margin: 0 auto;
        }

        .copy-toast-v2 {
          position: fixed;
          left: 50%;
          bottom: calc(96px + env(safe-area-inset-bottom, 0px));
          transform: translateX(-50%);
          z-index: 1300;
          padding: 10px 20px;
          border-radius: 999px;
          background: rgba(17, 24, 39, 0.9);
          color: #f9fafb;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.01em;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          pointer-events: none;
          animation: copyToastIn 0.22s ease-out;
        }

        @keyframes copyToastIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .dark-theme .copy-toast-v2 {
          background: rgba(255, 255, 255, 0.92);
          color: #111827;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        }

        .dark-theme .group-pinned-bar--under-header {
          background: rgba(255, 255, 255, 0.06);
          border-bottom-color: rgba(255, 255, 255, 0.08);
        }

        .group-pinned-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.06);
          color: #6b7280;
          flex-shrink: 0;
        }

        .group-pinned-text {
          font-size: 13px;
          color: #374151;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        .group-pinned-unpin {
          flex-shrink: 0;
          border: none;
          background: transparent;
          color: #9ca3af;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          padding: 0 4px;
        }

        .group-pinned-unpin:hover { color: #374151; }

        .reply-preview-bar {
          display: flex;
          align-items: stretch;
          gap: 10px;
          margin-bottom: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          background: #faf6f0;
          border: 1px solid rgba(0, 0, 0, 0.06);
        }

        .reply-preview-accent {
          width: 3px;
          border-radius: 999px;
          background: var(--brand-color, #ed0000);
          flex-shrink: 0;
        }

        .reply-preview-body { flex: 1; min-width: 0; }

        .reply-preview-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--brand-color, #ed0000);
          margin-bottom: 2px;
        }

        .reply-preview-snippet {
          font-size: 13px;
          color: #4b5563;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .reply-preview-close {
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          font-size: 14px;
          padding: 4px;
        }

        .message-reply-quote {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: 8px;
          padding: 8px 10px;
          border-left: 3px solid var(--brand-color, #ed0000);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.04);
        }

        .message-reply-quote-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--brand-color, #ed0000);
        }

        .message-reply-quote-text {
          font-size: 12px;
          color: #6b7280;
        }

        .message-row-v2.user .message-reply-quote {
          background: rgba(255, 255, 255, 0.18);
          border-left-color: rgba(255, 255, 255, 0.85);
        }

        .message-row-v2.user .message-reply-quote-name {
          color: rgba(255, 255, 255, 0.95);
        }

        .message-row-v2.user .message-reply-quote-text {
          color: rgba(255, 255, 255, 0.88);
        }

        .message-reactions-row {
          display: flex;
          gap: 4px;
          margin-top: 4px;
          margin-left: 4px;
        }

        .message-reaction-chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 999px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          font-size: 14px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        button.message-reaction-chip {
          cursor: pointer;
          font: inherit;
        }

        .message-reaction-chip--mine {
          border-color: rgba(237, 0, 0, 0.25);
          background: rgba(237, 0, 0, 0.06);
        }

        .message-reaction-chip--mine:hover {
          background: rgba(237, 0, 0, 0.12);
        }

        .dark-theme .message-reaction-chip--mine {
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
        }

        .message-menu-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1200;
        }

        .message-action-menu {
          position: fixed;
          z-index: 1201;
          min-width: 160px;
          padding: 6px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .message-action-menu button {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          border: none;
          background: transparent;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          color: #111827;
          text-align: left;
        }

        .message-action-menu button:hover {
          background: #f3f4f6;
        }

        .reaction-picker-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1201;
        }

        .reaction-picker-root {
          position: fixed;
          z-index: 1202;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: calc(100vw - 24px);
        }

        .reaction-quick-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border-radius: 999px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
        }

        .reaction-quick-scroll {
          display: flex;
          align-items: center;
          gap: 2px;
          max-width: min(280px, calc(100vw - 120px));
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .reaction-quick-scroll::-webkit-scrollbar { display: none; }

        .reaction-quick-btn {
          border: none;
          background: transparent;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .reaction-quick-btn:hover { background: #f3f4f6; }

        .reaction-quick-btn--active {
          background: rgba(237, 0, 0, 0.1);
          box-shadow: inset 0 0 0 2px rgba(237, 0, 0, 0.35);
        }

        .reaction-plus-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border: none;
          border-radius: 999px;
          background: #f3f4f6;
          color: #374151;
          cursor: pointer;
        }

        .reaction-plus-btn:hover { background: #e5e7eb; }

        .reaction-expanded-panel {
          width: 300px;
          max-width: calc(100vw - 24px);
          max-height: 340px;
          display: flex;
          flex-direction: column;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(12px);
          overflow: hidden;
        }

        .reaction-search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 10px 10px 6px;
          padding: 8px 12px;
          border-radius: 12px;
          background: #f3f4f6;
        }

        .reaction-search-icon { color: #9ca3af; flex-shrink: 0; }

        .reaction-search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 14px;
          outline: none;
          color: #111827;
        }

        .reaction-section {
          padding: 0 10px 8px;
        }

        .reaction-section--scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }

        .reaction-section-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #9ca3af;
          margin-bottom: 6px;
        }

        .reaction-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 2px;
        }

        .reaction-grid-btn {
          border: none;
          background: transparent;
          font-size: 22px;
          line-height: 1;
          padding: 6px 2px;
          border-radius: 8px;
          cursor: pointer;
        }

        .reaction-grid-btn:hover { background: #f3f4f6; }

        .reaction-grid-btn--active {
          background: rgba(237, 0, 0, 0.1);
          box-shadow: inset 0 0 0 2px rgba(237, 0, 0, 0.35);
        }

        .reaction-category-tabs {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 8px 10px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          overflow-x: auto;
          scrollbar-width: none;
        }

        .reaction-category-tabs::-webkit-scrollbar { display: none; }

        .reaction-category-tab {
          border: none;
          background: transparent;
          font-size: 20px;
          line-height: 1;
          padding: 6px 8px;
          border-radius: 10px;
          cursor: pointer;
          opacity: 0.55;
          flex-shrink: 0;
        }

        .reaction-category-tab.active,
        .reaction-category-tab:hover {
          opacity: 1;
          background: #f3f4f6;
        }

        .mention-avatar--nexa {
          background: var(--brand-color, #ed0000);
          color: #fff;
        }

        .dark-theme .group-pinned-bar { background: rgba(255, 255, 255, 0.06); }
        .dark-theme .group-pinned-text { color: #e5e7eb; }
        .dark-theme .reply-preview-bar { background: rgba(255, 255, 255, 0.05); }
        .dark-theme .message-action-menu { background: #1f1f1f; border-color: rgba(255,255,255,0.1); }
        .dark-theme .message-action-menu button { color: #f3f4f6; }
        .dark-theme .message-action-menu button:hover { background: rgba(255,255,255,0.08); }
        .dark-theme .reaction-quick-bar { background: #1f1f1f; border-color: rgba(255,255,255,0.1); }
        .dark-theme .reaction-quick-btn:hover { background: rgba(255,255,255,0.08); }
        .dark-theme .reaction-plus-btn { background: rgba(255,255,255,0.08); color: #f3f4f6; }
        .dark-theme .reaction-expanded-panel { background: rgba(31,31,31,0.96); border-color: rgba(255,255,255,0.1); }
        .dark-theme .reaction-search-wrap { background: rgba(255,255,255,0.06); }
        .dark-theme .reaction-search-input { color: #f3f4f6; }
        .dark-theme .reaction-grid-btn:hover,
        .dark-theme .reaction-category-tab:hover,
        .dark-theme .reaction-category-tab.active { background: rgba(255,255,255,0.08); }

        .dark-theme .collab-typing-label {
          color: #9ca3af;
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
          position: relative;
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

        /* Wrapper that lets the grey ghost-text completion sit exactly behind the
           @mention input. The textarea is transparent so the ghost shows through. */
        .footer-textarea-shell {
          position: relative;
          flex: 1;
          min-width: 0;
          display: flex;
        }
        .footer-textarea-shell .footer-textarea-v2 {
          position: relative;
          z-index: 1;
          background: transparent;
        }
        .footer-ghost {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          padding: 8px 4px;
          font-size: 16px;
          line-height: 1.45;
          font-family: inherit;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          overflow: hidden;
          max-height: 160px;
        }
        @media (min-width: 640px) {
          .footer-ghost {
            font-size: 15px;
            padding: 8px 0;
            max-height: 200px;
          }
        }
        .footer-ghost-typed { color: transparent; }
        .footer-ghost-suffix { color: #9ca3af; }
        .dark-theme .footer-ghost-suffix { color: #6b7280; }

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

        /* Stop-generating state: send button stays red with a white square. */
        .footer-send-btn-v2.is-stop,
        .send-btn-v2.is-stop {
          background: var(--brand-color, #ed0000);
          opacity: 1;
        }
        .footer-send-btn-v2.is-stop:disabled,
        .send-btn-v2.is-stop:disabled {
          opacity: 1;
        }
        .stop-square {
          width: 14px;
          height: 14px;
          background: #fff;
          border-radius: 3px;
          display: block;
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

        .profile-pic-prompt-overlay {
          z-index: 1200;
        }

        .profile-pic-prompt-card {
          text-align: center;
        }

        .profile-pic-prompt-avatar {
          width: 72px;
          height: 72px;
          margin: 0 auto 16px;
          border-radius: 999px;
          background: var(--brand-color, #ed0000);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
        }

        .profile-pic-prompt-actions {
          justify-content: center;
          margin-top: 24px;
        }

        .profile-pic-prompt-card .modal-header-v2 p {
          margin-bottom: 0;
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
