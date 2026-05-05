/**
 * Chat Context & Hooks (Client-side)
 * 
 * Manages chat state, Socket.io connection, and messaging logic.
 * 
 * File: client/src/context/ChatContext.tsx
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

// ============================================================================
// TYPES
// ============================================================================

export interface Message {
  messageID: string;
  conversationID: string;
  senderUID: string;
  senderRole: 'student' | 'admin' | 'superAdmin';
  senderName: string;
  content: string;
  createdAt: string;
}

export interface ConversationMetadata {
  conversationID: string;
  type: 'student_support' | 'admin_escalation';
  studentUID?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isClosed: boolean;
  status: 'active' | 'closed' | 'archived';
  lastMessageText?: string;
  messageCount: number;
  studentParticipant?: string;
  escalationID?: string;
  escalationInitiatedBy?: string;
  escalationReason?: string;
}

export interface ChatContextType {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Current conversation
  currentConversation: ConversationMetadata | null;
  messages: Message[];
  isLoadingMessages: boolean;

  // Conversations list
  conversations: ConversationMetadata[];
  isLoadingConversations: boolean;

  // User info
  userUID: string | null;
  userRole: 'student' | 'admin' | 'superAdmin' | null;

  // Actions
  loadConversation: (conversationID: string) => Promise<void>;
  loadConversations: (options?: { type?: string; status?: string; limit?: number }) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  createStudentSupport: (studentUID?: string) => Promise<string>;
  escalateToSuperAdmin: (studentSupportConvID: string, reason: string) => Promise<string>;
  closeConversation: (conversationID: string) => Promise<void>;

  // UI state
  messageInput: string;
  setMessageInput: (text: string) => void;
  isSendingMessage: boolean;
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
  const [currentConversation, setCurrentConversation] = useState<ConversationMetadata | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Conversations list
  const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // UI state
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const idempotencyKeyRef = useRef<string>('');

  // ========================================================================
  // SETUP: Firebase Auth + Socket.io Connection
  // ========================================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserUID(user.uid);

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
          socketRef.current = io(process.env.REACT_APP_SOCKET_IO_URL || 'http://localhost:4000', {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
          });

          setupSocketListeners(socketRef.current);
        }
      } else {
        // Disconnect
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        setUserUID(null);
        setUserRole(null);
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
      console.log('Socket.io connected');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('Socket.io disconnected');
      setIsConnected(false);
    });

    socket.on('message_received', (data: Message) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on('conversation_loaded', (data: { metadata: ConversationMetadata; messages: Message[] }) => {
      setCurrentConversation(data.metadata);
      setMessages(data.messages);
      setIsLoadingMessages(false);
    });

    socket.on('conversations_listed', (data: { conversations: ConversationMetadata[] }) => {
      setConversations(data.conversations);
      setIsLoadingConversations(false);
    });

    socket.on('message_sent', (data: { messageID: string; status: string }) => {
      setIsSendingMessage(false);
      setMessageInput('');
    });

    socket.on('conversation_created', (data: { conversationID: string; status: string }) => {
      // Optionally refresh conversations list
      console.log('Conversation created:', data);
    });

    socket.on('conversation_closed', (data: { conversationID: string; closedAt: string }) => {
      if (currentConversation?.conversationID === data.conversationID) {
        setCurrentConversation((prev) => (prev ? { ...prev, isClosed: true } : null));
      }
    });

    socket.on('error', (data: { code: string; message: string }) => {
      console.error('Socket error:', data);
      setError(data.message);
    });
  };

  // ========================================================================
  // ACTIONS
  // ========================================================================

  const sendMessage = useCallback(
    async (content: string) => {
      if (!socketRef.current || !currentConversation || isSendingMessage) {
        return;
      }

      setIsSendingMessage(true);
      idempotencyKeyRef.current = `${userUID}_${Date.now()}_${Math.random()}`;

      socketRef.current.emit('send_message', {
        conversationID: currentConversation.conversationID,
        content,
        idempotencyKey: idempotencyKeyRef.current,
      });
    },
    [currentConversation, isSendingMessage, userUID]
  );

  const loadConversation = useCallback(async (conversationID: string) => {
    if (!socketRef.current) return;

    setIsLoadingMessages(true);
    socketRef.current.emit('load_conversation', {
      conversationID,
      limit: 50,
    });
  }, []);

  const loadConversations = useCallback(
    async (options?: { type?: string; status?: string; limit?: number }) => {
      if (!socketRef.current) return;

      setIsLoadingConversations(true);
      socketRef.current.emit('list_conversations', {
        type: options?.type,
        status: options?.status || 'active',
        limit: options?.limit || 20,
        offset: 0,
      });
    },
    []
  );

  const createStudentSupport = useCallback(
    async (studentUID?: string): Promise<string> => {
      if (!socketRef.current) throw new Error('Socket not connected');

      return new Promise((resolve, reject) => {
        socketRef.current?.emit('create_student_support_conversation', { studentUID }, (data: any) => {
          if (data?.error) {
            reject(new Error(data.error));
          } else {
            resolve(data?.conversationID || '');
          }
        });
      });
    },
    []
  );

  const escalateToSuperAdmin = useCallback(
    async (studentSupportConvID: string, reason: string): Promise<string> => {
      if (!socketRef.current) throw new Error('Socket not connected');

      return new Promise((resolve, reject) => {
        socketRef.current?.emit(
          'escalate_to_superadmin',
          {
            studentSupportConversationID: studentSupportConvID,
            reason,
            idempotencyKey: `${userUID}_${Date.now()}`,
          },
          (data: any) => {
            if (data?.error) {
              reject(new Error(data.error));
            } else {
              resolve(data?.conversationID || '');
            }
          }
        );
      });
    },
    [userUID]
  );

  const closeConversation = useCallback(async (conversationID: string) => {
    if (!socketRef.current) return;

    socketRef.current.emit('close_conversation', { conversationID });
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  const value: ChatContextType = {
    isConnected,
    isLoading,
    error,
    currentConversation,
    messages,
    isLoadingMessages,
    conversations,
    isLoadingConversations,
    userUID,
    userRole,
    loadConversation,
    loadConversations,
    sendMessage,
    createStudentSupport,
    escalateToSuperAdmin,
    closeConversation,
    messageInput,
    setMessageInput,
    isSendingMessage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}
