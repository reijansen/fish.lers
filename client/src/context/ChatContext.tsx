/**
 * Chat Context & Hooks (Client-side)
 * 
 * Manages chat state, Socket.io connection, and messaging logic.
 * Integrated with Phase 3 backend (message:send, message:new, inbox:notify).
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const SOCKET_BASE_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_SOCKET_IO_URL ||
  API_BASE_URL;

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  messageID: string;
  conversationID: string;
  senderUID: string;
  senderRole: 'student' | 'admin' | 'superAdmin';
  content: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Conversation {
  conversationID: string;
  type: 'support' | 'escalation' | 'staff';
  status: 'active' | 'closed';
  studentUID?: string;
  adminUID?: string;
  escalationID?: string;
  escalationReason?: string;
  staffKey?: 'admins';
  participants: string[];
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview?: string;
  lastMessageSenderUID?: string;
  lastMessageSenderRole?: 'student' | 'admin' | 'superAdmin';
  unreadCount?: number;
  archivedFor?: string[];
  deletedFor?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InboxNotification {
  conversationID: string;
  type: 'student_message' | 'admin_reply' | 'escalation_created' | 'superadmin_reply' | 'staff_message';
  studentUID?: string;
  adminUID?: string;
  superAdminUID?: string;
  escalationID?: string;
  message: string;
}

export interface ChatPerson {
  uid: string;
  displayName?: string;
  email: string;
  role: "student" | "admin";
  isSuperAdmin?: boolean;
}

export interface ChatContextType {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Current conversation
  currentConversation: Conversation | null;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;

  // Conversations list
  conversations: Conversation[];
  isLoadingConversations: boolean;
  unreadCounts: Record<string, number>;

  // User info
  userUID: string | null;
  userRole: 'student' | 'admin' | 'superAdmin' | null;

  // Actions
  loadConversation: (conversationID: string) => Promise<void>;
  loadMoreMessages: (conversationID: string, beforeCursor?: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  conversationFolder: "inbox" | "archived";
  setConversationFolder: (folder: "inbox" | "archived") => void;
  setConversationArchived: (conversationID: string, archived: boolean) => Promise<void>;
  setConversationDeleted: (conversationID: string, deleted: boolean) => Promise<void>;
  sendMessage: (conversationID: string, text: string) => Promise<void>;
  joinConversation: (conversationID: string) => Promise<void>;
  setCurrentConversation: (conv: Conversation | null) => void;

  // UI state
  messageInput: string;
  setMessageInput: (text: string) => void;
  isSendingMessage: boolean;
  toastNotification: InboxNotification | null;
  dismissToast: () => void;

  // Phase 5 UX state
  typingUsersByConversation: Record<string, Array<{ userUID: string; userRole: ChatMessage["senderRole"] }>>;
  signalTyping: (conversationID: string) => void;

  // UI helpers
  peopleByUID: Record<string, ChatPerson>;
  getPersonLabel: (uid: string) => string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Connection & Auth
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userUID, setUserUID] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'admin' | 'superAdmin' | null>(null);

  // Current conversation
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  // Conversations list
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [conversationFolder, setConversationFolder] = useState<"inbox" | "archived">("inbox");

  // UI state
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [toastNotification, setToastNotification] = useState<InboxNotification | null>(null);
  const [typingUsersByConversation, setTypingUsersByConversation] = useState<
    Record<string, Array<{ userUID: string; userRole: ChatMessage["senderRole"] }>>
  >({});
  const typingStopTimersRef = useRef<Record<string, any>>({});
  const seenMessageIDsRef = useRef<Set<string>>(new Set());
  const seenClientIDsRef = useRef<Set<string>>(new Set());
  const [connectNonce, setConnectNonce] = useState(0);
  const currentConversationIdRef = useRef<string | null>(null);
  const [peopleByUID, setPeopleByUID] = useState<Record<string, ChatPerson>>({});

  useEffect(() => {
    currentConversationIdRef.current = currentConversation?.conversationID || null;
  }, [currentConversation?.conversationID]);

  // ========================================================================
  // SETUP: Firebase Auth + Socket.io Connection
  // ========================================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserUID(user.uid);

        try {
          // Get ID token with custom claims
          const token = await user.getIdToken();
          const decodedToken = JSON.parse(atob(token.split('.')[1]));
          const role = decodedToken.superAdmin
            ? 'superAdmin'
            : decodedToken.admin
            ? 'admin'
            : 'student';
          setUserRole(role);

          // Ensure we can label the current user in the UI (server people list excludes "self").
          setPeopleByUID((prev) => ({
            ...prev,
            [user.uid]: {
              uid: user.uid,
              displayName: user.displayName || undefined,
              email: user.email || "",
              role: role === "student" ? "student" : "admin",
              isSuperAdmin: role === "superAdmin",
            },
          }));

          // Connect Socket.io
          if (!socketRef.current) {
            const socketURL = SOCKET_BASE_URL;
            socketRef.current = io(socketURL, {
              auth: { token },
              reconnection: true,
              reconnectionDelay: 1000,
              reconnectionDelayMax: 5000,
              reconnectionAttempts: 5,
            });

            setupSocketListeners(socketRef.current);
          }
        } catch (err) {
          console.error('Error setting up chat:', err);
          setError('Failed to setup chat connection');
        }
      } else {
        // Disconnect
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        setUserUID(null);
        setUserRole(null);
        setIsConnected(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ========================================================================
  // SOCKET.IO EVENT LISTENERS
  // ========================================================================

  const setupSocketListeners = (socket: Socket) => {
    socket.on('connect', () => {
      console.log('[Chat] Socket.io connected');
      setIsConnected(true);
      setError(null);
      setConnectNonce((n) => n + 1);
    });

    socket.on('disconnect', () => {
      console.log('[Chat] Socket.io disconnected');
      setIsConnected(false);
    });

    // Message:new - real-time message from server
    socket.on('message:new', (msg: ChatMessage) => {
      // Dedup by messageID and/or clientMessageID
      if (msg.messageID && seenMessageIDsRef.current.has(msg.messageID)) return;
      const clientId = (msg as any).clientMessageID as string | undefined;
      if (clientId && seenClientIDsRef.current.has(clientId)) return;

      if (msg.messageID) seenMessageIDsRef.current.add(msg.messageID);
      if (clientId) seenClientIDsRef.current.add(clientId);

      console.log('[Chat] message:new received:', msg.messageID);
      setMessages((prev) => [...prev, msg]);

      // Increment unread count if not viewing this conversation
      if (currentConversationIdRef.current !== msg.conversationID) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.conversationID]: (prev[msg.conversationID] || 0) + 1,
        }));
      } else {
        // If actively viewing, mark as read up to this message.
        socket.emit('message:read', {
          conversationID: msg.conversationID,
          readUpToMessageID: msg.messageID,
        });
      }
    });

    // Inbox:notify - notification event
    socket.on('inbox:notify', (notif: InboxNotification) => {
      console.log('[Chat] inbox:notify received:', notif.type);
      // Show toast notification
      setToastNotification(notif);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setToastNotification(null), 5000);
    });

    socket.on('error', (data: any) => {
      console.error('[Chat] Socket error:', data);
      setError(data.error || 'Connection error');
    });

    // Phase 5: typing indicators
    socket.on('user:typing', (payload: any) => {
      const { conversationID, userUID: typingUID, userRole, isTyping } = payload || {};
      if (!conversationID || !typingUID || typingUID === userUID) return;

      setTypingUsersByConversation((prev) => {
        const existing = prev[conversationID] || [];
        const without = existing.filter((u) => u.userUID !== typingUID);
        if (!isTyping) {
          return { ...prev, [conversationID]: without };
        }
        return { ...prev, [conversationID]: [...without, { userUID: typingUID, userRole }] };
      });

      // Safety: auto-clear a typing indicator after 3s if no stop arrives.
      const key = `${conversationID}:${typingUID}`;
      const timers = typingStopTimersRef.current;
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(() => {
        setTypingUsersByConversation((prev) => {
          const existing = prev[conversationID] || [];
          return { ...prev, [conversationID]: existing.filter((u) => u.userUID !== typingUID) };
        });
      }, 3000);
    });
  };

  // ========================================================================
  // ACTIONS
  // ========================================================================

  const sendMessage = useCallback(
    async (conversationID: string, text: string) => {
      if (!socketRef.current || !text.trim()) return;

      setIsSendingMessage(true);
      const clientMessageID =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${userUID || 'user'}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      return new Promise<void>((resolve) => {
        socketRef.current?.emit(
          'message:send',
          {
            conversationID,
            text: text.trim(),
            clientMessageID,
          },
          (response: any) => {
            if (response.ok) {
              console.log('[Chat] Message sent:', response.message.messageID);
              setMessageInput('');
            } else {
              console.error('[Chat] Message send failed:', response.error);
              setError(response.error || 'Failed to send message');
            }
            setIsSendingMessage(false);
            resolve();
          }
        );
      });
    },
    [userUID]
  );

  const joinConversation = useCallback(async (conversationID: string) => {
    if (!socketRef.current) return;

    return new Promise<void>((resolve) => {
      socketRef.current?.emit(
        'conversation:join',
        { conversationID },
        (response: any) => {
          if (response.ok) {
            console.log('[Chat] Joined conversation:', conversationID);
          } else {
            console.error('[Chat] Join failed:', response.error);
            setError(response.error || 'Failed to join conversation');
          }
          resolve();
        }
      );
    });
  }, []);

  const loadConversation = useCallback(
    async (conversationID: string) => {
      if (!isConnected) return;

      setIsLoadingMessages(true);
      setMessages([]);
      setHasMoreMessages(false);
      seenMessageIDsRef.current = new Set();
      seenClientIDsRef.current = new Set();

      try {
        // Join conversation room first
        await joinConversation(conversationID);

        // Load initial messages via REST API (pagination)
        const token = await (auth.currentUser?.getIdToken() ?? Promise.resolve(''));
        const response = await fetch(
          `${API_BASE_URL}/api/chat/${conversationID}/messages?limit=50`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) throw new Error('Failed to load messages');

        const data = await response.json();
        setMessages(data.items || []);
        setHasMoreMessages(data.hasMore || false);

        // Seed dedupe sets from loaded history.
        for (const item of data.items || []) {
          if (item?.messageID) seenMessageIDsRef.current.add(item.messageID);
        }

        // Phase 5: mark as read up to newest message in loaded page.
        // API returns items in chronological order (oldest first).
        const items = Array.isArray(data.items) ? (data.items as ChatMessage[]) : [];
        const newest = items.length ? items[items.length - 1] : undefined;
        if (newest?.messageID) {
          socketRef.current?.emit('message:read', {
            conversationID,
            readUpToMessageID: newest.messageID,
          });
        }

        // Clear unread count for this conversation
        setUnreadCounts((prev) => {
          const updated = { ...prev };
          delete updated[conversationID];
          return updated;
        });
      } catch (err: any) {
        console.error('[Chat] Error loading conversation:', err);
        setError(err.message || 'Failed to load conversation');
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [isConnected, joinConversation]
  );

  const loadMoreMessages = useCallback(
    async (conversationID: string, beforeCursor?: string) => {
      if (!isConnected) return;

      try {
        const token = await (auth.currentUser?.getIdToken() ?? Promise.resolve(''));
        const url = new URL(`${API_BASE_URL}/api/chat/${conversationID}/messages`);
        url.searchParams.append('limit', '50');
        if (beforeCursor) url.searchParams.append('before', beforeCursor);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to load more messages');

        const data = await response.json();
        setMessages((prev) => [...(data.items || []), ...prev]);
        setHasMoreMessages(data.hasMore || false);
      } catch (err: any) {
        console.error('[Chat] Error loading more messages:', err);
        setError(err.message || 'Failed to load more messages');
      }
    },
    [isConnected]
  );

  const loadConversations = useCallback(async () => {
    if (!isConnected) return;

    setIsLoadingConversations(true);

    try {
      const token = await (auth.currentUser?.getIdToken() ?? Promise.resolve(''));
      const url = new URL(`${API_BASE_URL}/api/chat/conversations`);
      url.searchParams.set("limit", "50");
      url.searchParams.set("folder", conversationFolder);
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load conversations');

      const data = await response.json();
      console.log('[Chat] loadConversations response:', data);
      const nextConversations = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(nextConversations);
      const currentId = currentConversationIdRef.current;
      if (currentId) {
        const refreshedCurrent = nextConversations.find((conv: Conversation) => conv.conversationID === currentId) || null;
        if (refreshedCurrent) {
          setCurrentConversation(refreshedCurrent);
        }
      }
      if (data.unreadCounts && typeof data.unreadCounts === 'object') {
        setUnreadCounts(data.unreadCounts);
      }

      // Load a user directory for display names/emails (role-filtered by server).
      try {
        const peopleRes = await fetch(`${API_BASE_URL}/api/chat/people?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (peopleRes.ok) {
          const peopleData = await peopleRes.json();
          const list: ChatPerson[] = Array.isArray(peopleData.people) ? peopleData.people : [];
          const next: Record<string, ChatPerson> = {};
          for (const p of list) next[p.uid] = p;
          setPeopleByUID((prev) => ({ ...prev, ...next }));
        }
      } catch {
        // ignore directory failures; UI will fall back to UID.
      }
    } catch (err: any) {
      console.error('[Chat] Error loading conversations:', err);
      setError(err.message || 'Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [isConnected, conversationFolder]);

  // Reload inbox when switching folders.
  useEffect(() => {
    if (!isConnected) return;
    loadConversations();
  }, [conversationFolder, isConnected, loadConversations]);

  const setConversationArchived = useCallback(
    async (conversationID: string, archived: boolean) => {
      try {
        const token = await (auth.currentUser?.getIdToken() ?? Promise.resolve(""));
        const res = await fetch(`${API_BASE_URL}/api/chat/${conversationID}/archive`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ archived }),
        });
        if (!res.ok) throw new Error("Failed to update conversation");
        await loadConversations();
      } catch (err: any) {
        console.error("[Chat] Error archiving conversation:", err);
        setError(err.message || "Failed to update conversation");
      }
    },
    [loadConversations]
  );

  const setConversationDeleted = useCallback(
    async (conversationID: string, deleted: boolean) => {
      try {
        const token = await (auth.currentUser?.getIdToken() ?? Promise.resolve(""));
        const res = await fetch(`${API_BASE_URL}/api/chat/${conversationID}/delete`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ deleted }),
        });
        if (!res.ok) throw new Error("Failed to update conversation");
        await loadConversations();
      } catch (err: any) {
        console.error("[Chat] Error deleting conversation:", err);
        setError(err.message || "Failed to update conversation");
      }
    },
    [loadConversations]
  );

  const getPersonLabel = useCallback(
    (uid: string) => {
      const person = peopleByUID[uid];
      if (!person) return uid;
      return person.displayName || person.email || uid;
    },
    [peopleByUID]
  );

  // Phase 6: reconnect resync
  useEffect(() => {
    if (!isConnected) return;

    (async () => {
      await loadConversations();
      const currentId = currentConversationIdRef.current;
      if (currentId) {
        await loadConversation(currentId);
      }
    })();
  }, [connectNonce, isConnected, loadConversations, loadConversation]);

  // Phase 5: Debounced typing signal
  const signalTyping = useCallback(
    (conversationID: string) => {
      if (!socketRef.current) return;

      socketRef.current.emit('user:typing', { conversationID, isTyping: true });

      const timers = typingStopTimersRef.current;
      if (timers[conversationID]) clearTimeout(timers[conversationID]);
      timers[conversationID] = setTimeout(() => {
        socketRef.current?.emit('user:typing', { conversationID, isTyping: false });
      }, 1500);
    },
    []
  );

  // ========================================================================
  // CONTEXT VALUE
  // ========================================================================

  const value: ChatContextType = {
    isConnected,
    isLoading,
    error,
    currentConversation,
    messages,
    isLoadingMessages,
    hasMoreMessages,
    conversations,
    isLoadingConversations,
    unreadCounts,
    userUID,
    userRole,
    loadConversation,
    loadMoreMessages,
    loadConversations,
    conversationFolder,
    setConversationFolder,
    setConversationArchived,
    setConversationDeleted,
    sendMessage,
    joinConversation,
    setCurrentConversation,
    messageInput,
    setMessageInput,
    isSendingMessage,
    toastNotification,
    dismissToast: () => setToastNotification(null),
    typingUsersByConversation,
    signalTyping,
    peopleByUID,
    getPersonLabel,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/**
 * Hook to use chat context.
 */
export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}
