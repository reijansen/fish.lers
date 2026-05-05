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
  type: 'support' | 'escalation';
  status: 'active' | 'closed';
  studentUID?: string;
  adminUID?: string;
  escalationID?: string;
  escalationReason?: string;
  participants: string[];
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InboxNotification {
  conversationID: string;
  type: 'student_message' | 'admin_reply' | 'escalation_created' | 'superadmin_reply';
  studentUID?: string;
  adminUID?: string;
  superAdminUID?: string;
  escalationID?: string;
  message: string;
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

  // UI state
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [toastNotification, setToastNotification] = useState<InboxNotification | null>(null);
  const [typingUsersByConversation, setTypingUsersByConversation] = useState<
    Record<string, Array<{ userUID: string; userRole: ChatMessage["senderRole"] }>>
  >({});
  const typingStopTimersRef = useRef<Record<string, any>>({});

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

          // Connect Socket.io
          if (!socketRef.current) {
            const socketURL = import.meta.env.VITE_SOCKET_IO_URL || 'http://localhost:5000';
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
    });

    socket.on('disconnect', () => {
      console.log('[Chat] Socket.io disconnected');
      setIsConnected(false);
    });

    // Message:new - real-time message from server
    socket.on('message:new', (msg: ChatMessage) => {
      console.log('[Chat] message:new received:', msg.messageID);
      setMessages((prev) => [...prev, msg]);

      // Increment unread count if not viewing this conversation
      if (currentConversation?.conversationID !== msg.conversationID) {
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
      const clientMessageID = `${userUID}_${Date.now()}`;

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

      try {
        // Join conversation room first
        await joinConversation(conversationID);

        // Load initial messages via REST API (pagination)
        const token = await (auth.currentUser?.getIdToken() ?? Promise.resolve(''));
        const response = await fetch(
          `http://localhost:5000/api/chat/${conversationID}/messages?limit=50`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) throw new Error('Failed to load messages');

        const data = await response.json();
        setMessages(data.items || []);
        setHasMoreMessages(data.hasMore || false);

        // Phase 5: mark as read up to newest message in loaded page.
        const newest = (data.items || [])[0] as ChatMessage | undefined;
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
        const url = new URL(`http://localhost:5000/api/chat/${conversationID}/messages`);
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
      const response = await fetch('http://localhost:5000/api/chat/conversations?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load conversations');

      const data = await response.json();
      setConversations(data.conversations || []);
      if (data.unreadCounts && typeof data.unreadCounts === 'object') {
        setUnreadCounts(data.unreadCounts);
      }
    } catch (err: any) {
      console.error('[Chat] Error loading conversations:', err);
      setError(err.message || 'Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [isConnected]);

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
