/**
 * ChatLayout Component
 * 
 * Main container for 2-pane chat UI (desktop) / stacked (mobile).
 */

import React, { useEffect } from 'react';
import { useNavigate, useParams } from "react-router-dom";

import { useChat } from '../../context/ChatContext';
import { ThreadList } from './ThreadList';
import { ChatThread } from './ChatThread';
import { MessageComposer } from './MessageComposer';
import { ChatToast } from './ChatToast';
import { NewChatModal, type ChatPerson } from './NewChatModal';
import { auth } from '../../firebase';
import { ChatDetailsPanel } from "./ChatDetailsPanel";
import { getSupportConversationLabel } from "./chatTitleUtils";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

export const ChatLayout: React.FC = () => {
  const chat = useChat();
  const nav = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [isNarrow, setIsNarrow] = React.useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 1023px)");
    const handler = () => setIsNarrow(media.matches);
    handler();
    // Safari <14 uses addListener/removeListener.
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, []);

  // Mobile: edge-swipe (left->right) to go back to the thread list.
  const swipeRef = React.useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    isEdge: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    isEdge: false,
  });

  const onMobileTouchStart = (e: React.TouchEvent) => {
    if (!isNarrow || !conversationId) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    swipeRef.current = {
      active: true,
      startX: t.clientX,
      startY: t.clientY,
      lastX: t.clientX,
      lastY: t.clientY,
      // Only allow swipe-back if started near the left edge (Messenger-like).
      isEdge: t.clientX <= 24,
    };
  };

  const onMobileTouchMove = (e: React.TouchEvent) => {
    if (!swipeRef.current.active) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    swipeRef.current.lastX = t.clientX;
    swipeRef.current.lastY = t.clientY;
  };

  const onMobileTouchEnd = () => {
    const s = swipeRef.current;
    if (!s.active) return;
    swipeRef.current.active = false;
    if (!s.isEdge) return;

    const dx = s.lastX - s.startX;
    const dy = s.lastY - s.startY;

    // Trigger when swipe is mostly horizontal, and rightwards enough.
    if (dx > 80 && Math.abs(dy) < 40) {
      if (isDetailsOpen) {
        setIsDetailsOpen(false);
        return;
      }
      chat.setCurrentConversation(null);
      nav("/chat");
    }
  };

  const getConversationTitle = React.useCallback(
    (conv: any | null): string => {
      if (!conv) return "Conversation";
      if (conv.type === "staff") return "Staff Chat (Admins)";
      if (conv.type === "support") {
        return getSupportConversationLabel(conv, chat.userUID, chat.peopleByUID);
      }
      if (conv.type === "escalation") {
        const participants = Array.isArray(conv.participants) ? conv.participants : [];
        const others = participants.filter((uid: string) => uid && uid !== chat.userUID);
        const otherUID = others[0] || null;

        if (chat.userRole === "admin") {
          return `Escalation - ${otherUID ? chat.getPersonLabel(otherUID) : "Super Admin"}`;
        }
        if (chat.userRole === "superAdmin") {
          const adminUID = conv.adminUID || otherUID;
          return `Escalation - ${adminUID ? chat.getPersonLabel(adminUID) : "Admin"}`;
        }
        return "Escalation";
      }
      return "Conversation";
    },
    [chat]
  );

  // Load conversations on mount
  useEffect(() => {
    chat.loadConversations();
  }, []);

  const handleSelectConversation = async (conv: any) => {
    chat.setCurrentConversation(conv);
    setIsDetailsOpen(false);
    await chat.loadConversation(conv.conversationID);
    nav(`/chat/${conv.conversationID}`);
  };

  const openConversationById = React.useCallback(async (conversationID: string) => {
    // Prefer an existing conversation object if present; otherwise create a lightweight placeholder.
    const existing = chat.conversations.find((c) => c.conversationID === conversationID) || null;
    chat.setCurrentConversation(
      existing ||
        ({
          conversationID,
          type: conversationID === "staff:admins" ? "staff" : conversationID.startsWith("support:") ? "support" : "escalation",
          status: "active",
          participants: [],
          messageCount: 0,
          lastMessageAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any)
    );

    await chat.loadConversation(conversationID);
    await chat.loadConversations();
  }, [chat]);

  // Keep URL-selected conversation in sync with loaded state.
  useEffect(() => {
    if (!conversationId) return;
    if (chat.currentConversation?.conversationID === conversationId) return;
    openConversationById(conversationId);
  }, [conversationId, chat.currentConversation?.conversationID, openConversationById]);

  const handleStartNewChat = async (person: ChatPerson) => {
    const token = await (auth.currentUser?.getIdToken() ?? Promise.resolve(""));
    if (!token) throw new Error("Not authenticated");

    // Student: always their own support thread
    if (chat.userRole === "student") {
      // Create/get a dedicated support conversation for the selected admin.
      const supportRes = await fetch(`${API_BASE_URL}/api/chat/support/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ adminUID: person.uid }),
      });
      console.log('[Chat] Create student-admin support response:', supportRes.status, supportRes.ok);
      if (!supportRes.ok) {
        const error = await supportRes.text();
        console.error('[Chat] Failed to create student-admin support conversation:', error);
        throw new Error(`Failed to create student-admin support conversation: ${error}`);
      }

      const data = await supportRes.json();
      const conversationID = data?.conversation?.conversationID as string | undefined;
      if (!conversationID) throw new Error("Invalid support response");
      await openConversationById(conversationID);
      return;
    }

    // SuperAdmin: cannot start/enter student support threads (student↔admin only).
    if (chat.userRole === "superAdmin" && person.role === "student") {
      throw new Error("Super admins cannot start support chats with students.");
    }

    // Admin/SuperAdmin: chatting with a student opens that student's support thread
    if (person.role === "student") {
      const createRes = await fetch(`${API_BASE_URL}/api/chat/support/${person.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      console.log('[Chat] Create student support response:', createRes.status, createRes.ok);
      if (!createRes.ok) {
        const error = await createRes.text();
        console.error('[Chat] Failed to create student support conversation:', error);
        throw new Error(`Failed to create student support conversation: ${error}`);
      }

      const data = await createRes.json();
      const conversationID = data?.conversation?.conversationID as string | undefined;
      if (!conversationID) throw new Error("Invalid support response");
      await openConversationById(conversationID);
      return;
    }

    // Admin talking to superAdmin -> create escalation conversation
    if (chat.userRole === "admin" && person.isSuperAdmin) {
      const res = await fetch(`${API_BASE_URL}/api/chat/escalations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: "Direct escalation" }),
      });
      console.log('[Chat] Create escalation response:', res.status, res.ok);
      if (!res.ok) throw new Error("Failed to create escalation conversation");
      const data = await res.json();
      const conversationID = data?.conversation?.conversationID as string | undefined;
      if (!conversationID) throw new Error("Invalid escalation response");
      await openConversationById(conversationID);
      return;
    }

    // SuperAdmin starting a chat with an admin -> create an escalation conversation tied to that admin.
    if (chat.userRole === "superAdmin" && person.role === "admin") {
      const res = await fetch(`${API_BASE_URL}/api/chat/escalations/${person.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: "Direct escalation" }),
      });
      console.log('[Chat] Create escalation for admin response:', res.status, res.ok);
      if (!res.ok) throw new Error("Failed to create escalation conversation");
      const data = await res.json();
      const conversationID = data?.conversation?.conversationID as string | undefined;
      if (!conversationID) throw new Error("Invalid escalation response");
      await openConversationById(conversationID);
      return;
    }

    throw new Error("Unsupported chat target for your role");
  };

  const handleSendMessage = async (text: string) => {
    if (!chat.currentConversation) return;
    await chat.sendMessage(chat.currentConversation.conversationID, text);
  };

  const handleLoadMoreMessages = async () => {
    if (!chat.currentConversation || !chat.messages.length) return;
    const oldestMessage = chat.messages[0];
    await chat.loadMoreMessages(
      chat.currentConversation.conversationID,
      oldestMessage.createdAt
    );
  };

  if (chat.isLoading) {
    return (
      <div className="h-full min-h-64 flex items-center justify-center bg-base-100 rounded-box border border-base-300">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/60">Connecting...</p>
        </div>
      </div>
    );
  }

  if (!chat.isConnected) {
    return (
      <div className="h-full min-h-64 flex items-center justify-center bg-base-100 rounded-box border border-base-300">
        <div className="alert alert-error max-w-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2m8-8l2 2m0 0l2 2m-2-2l-2 2m2-2l2-2"
            />
          </svg>
          <div>
            <h3 className="font-bold">Connection Error</h3>
            <div className="text-sm">{chat.error || 'Failed to connect to chat server'}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-flex-container h-full flex flex-col bg-base-100 rounded-none lg:rounded-box border-0 lg:border border-base-300">
      {/* Toast notification */}
      {chat.toastNotification && (
        <ChatToast notification={chat.toastNotification} onDismiss={chat.dismissToast} />
      )}

      {/* Main chat container */}
      <div className="flex-1 flex overflow-hidden bg-base-200/40 lg:bg-transparent">
        {isNarrow ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {!conversationId ? (
              <div className="flex-1 min-h-0 overflow-hidden p-2 sm:p-3">
                <div className="h-full bg-base-100 rounded-box border border-base-300 shadow-sm overflow-hidden">
                  <ThreadList
                    conversations={chat.conversations}
                    currentConversationID={chat.currentConversation?.conversationID || null}
                    unreadCounts={chat.unreadCounts}
                    userUID={chat.userUID}
                    userRole={chat.userRole}
                    isLoading={chat.isLoadingConversations}
                    onSelectConversation={handleSelectConversation}
                    onNewChat={() => setIsNewChatOpen(true)}
                    getPersonLabel={chat.getPersonLabel}
                    isSuperAdminUID={(uid) => !!chat.peopleByUID[uid]?.isSuperAdmin}
                  />
                </div>
              </div>
            ) : (
              <div
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
                onTouchStart={onMobileTouchStart}
                onTouchMove={onMobileTouchMove}
                onTouchEnd={onMobileTouchEnd}
                onTouchCancel={onMobileTouchEnd}
              >
                <ChatThread
                  messages={chat.messages}
                  currentConversation={chat.currentConversation}
                  isLoading={chat.isLoadingMessages}
                  hasMoreMessages={chat.hasMoreMessages}
                  userUID={chat.userUID}
                  userRole={chat.userRole}
                  peopleByUID={chat.peopleByUID}
                  typingUsers={
                    chat.currentConversation
                      ? chat.typingUsersByConversation[chat.currentConversation.conversationID] || []
                      : []
                  }
                  getPersonLabel={chat.getPersonLabel}
                  onLoadMore={handleLoadMoreMessages}
                  title={getConversationTitle(chat.currentConversation)}
                  onOpenDetails={() => setIsDetailsOpen((v) => !v)}
                  onBack={() => {
                    setIsDetailsOpen(false);
                    chat.setCurrentConversation(null);
                    nav("/chat");
                  }}
                />

                {chat.currentConversation && (
                  <MessageComposer
                    onSend={handleSendMessage}
                    onTyping={() => chat.signalTyping(chat.currentConversation!.conversationID)}
                    disabled={!chat.isConnected}
                    messageInput={chat.messageInput}
                    setMessageInput={chat.setMessageInput}
                    isSendingMessage={chat.isSendingMessage}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Thread list sidebar */}
            <div className="w-80 shrink-0 overflow-hidden p-3">
              <div className="flex-1 min-h-0 bg-base-100 rounded-box border border-base-300 shadow-sm overflow-hidden h-full">
                <ThreadList
                  conversations={chat.conversations}
                  currentConversationID={chat.currentConversation?.conversationID || null}
                  unreadCounts={chat.unreadCounts}
                  userUID={chat.userUID}
                  userRole={chat.userRole}
                  isLoading={chat.isLoadingConversations}
                  onSelectConversation={handleSelectConversation}
                  onNewChat={() => setIsNewChatOpen(true)}
                  getPersonLabel={chat.getPersonLabel}
                  isSuperAdminUID={(uid) => !!chat.peopleByUID[uid]?.isSuperAdmin}
                />
              </div>
            </div>

            {/* Desktop chat area */}
            <div className="flex-1 flex-col overflow-hidden min-h-0 flex">
              <div className="flex-1 flex overflow-hidden min-h-0 gap-3 p-3">
                <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-base-100 rounded-box border border-base-300 shadow-sm">
                  <ChatThread
                    messages={chat.messages}
                    currentConversation={chat.currentConversation}
                    isLoading={chat.isLoadingMessages}
                    hasMoreMessages={chat.hasMoreMessages}
                    userUID={chat.userUID}
                    userRole={chat.userRole}
                    peopleByUID={chat.peopleByUID}
                    typingUsers={
                      chat.currentConversation
                        ? chat.typingUsersByConversation[chat.currentConversation.conversationID] || []
                        : []
                    }
                    getPersonLabel={chat.getPersonLabel}
                    onLoadMore={handleLoadMoreMessages}
                    title={getConversationTitle(chat.currentConversation)}
                    onOpenDetails={() => setIsDetailsOpen((v) => !v)}
                  />

                  {chat.currentConversation && (
                    <MessageComposer
                      onSend={handleSendMessage}
                      onTyping={() => chat.signalTyping(chat.currentConversation!.conversationID)}
                      disabled={!chat.isConnected}
                      messageInput={chat.messageInput}
                      setMessageInput={chat.setMessageInput}
                      isSendingMessage={chat.isSendingMessage}
                    />
                  )}
                </div>

                {/* Right panel: always visible on xl+, optional on lg */}
                {chat.currentConversation && (
                  <div className="hidden xl:flex">
                    <ChatDetailsPanel
                      open={isDetailsOpen}
                      onClose={() => setIsDetailsOpen(false)}
                      conversation={chat.currentConversation}
                      userUID={chat.userUID}
                      userRole={chat.userRole}
                      peopleByUID={chat.peopleByUID}
                      getPersonLabel={chat.getPersonLabel}
                      title={getConversationTitle(chat.currentConversation)}
                      showClose={false}
                      containerClassName="w-80 xl:w-96 bg-base-100 rounded-box border border-base-300 shadow-sm flex flex-col min-h-0"
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Narrow screens: slide-in details panel */}
      {chat.currentConversation && (
        <div className={`lg:hidden fixed inset-0 z-50 ${isDetailsOpen ? "" : "pointer-events-none"}`}>
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity ${isDetailsOpen ? "opacity-100" : "opacity-0"}`}
            onClick={() => setIsDetailsOpen(false)}
          />
          <div
            className={`absolute right-0 top-0 h-full w-[min(92vw,28rem)] bg-base-100 border-l border-base-300 transition-transform ${
              isDetailsOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <ChatDetailsPanel
              open={isDetailsOpen}
              onClose={() => setIsDetailsOpen(false)}
              conversation={chat.currentConversation}
              userUID={chat.userUID}
              userRole={chat.userRole}
              peopleByUID={chat.peopleByUID}
              getPersonLabel={chat.getPersonLabel}
              title={getConversationTitle(chat.currentConversation)}
              containerClassName="h-full bg-base-100 flex flex-col min-h-0"
              showClose={true}
            />
          </div>
        </div>
      )}

      <NewChatModal
        open={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onStart={handleStartNewChat}
        currentUserRole={chat.userRole}
      />
    </div>
  );
};
