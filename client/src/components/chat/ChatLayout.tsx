/**
 * ChatLayout Component
 * 
 * Main container for 2-pane chat UI (desktop) / stacked (mobile).
 */

import React, { useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { ThreadList } from './ThreadList';
import { ChatThread } from './ChatThread';
import { MessageComposer } from './MessageComposer';
import { ChatToast } from './ChatToast';
import { NewChatModal, type ChatPerson } from './NewChatModal';
import { auth } from '../../firebase';
import { ChatDetailsPanel } from "./ChatDetailsPanel";

export const ChatLayout: React.FC = () => {
  const chat = useChat();
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);

  const getConversationTitle = React.useCallback(
    (conv: any | null): string => {
      if (!conv) return "Conversation";
      if (conv.type === "staff") return "Staff Chat (Admins)";
      if (conv.type === "support") {
        return `Support Chat${
          conv.studentUID ? ` - ${chat.getPersonLabel(conv.studentUID)}` : ""
        }`;
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
  };

  const openConversationById = async (conversationID: string) => {
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
  };

  const handleStartNewChat = async (person: ChatPerson) => {
    const token = await (auth.currentUser?.getIdToken() ?? Promise.resolve(""));
    if (!token) throw new Error("Not authenticated");

    // Student: always their own support thread
    if (chat.userRole === "student") {
      // Ensure support conversation exists, then assign it to the selected admin/superAdmin target if applicable.
      const supportRes = await fetch("http://localhost:5000/api/chat/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      console.log('[Chat] Create support conversation response:', supportRes.status, supportRes.ok);
      if (!supportRes.ok) {
        const error = await supportRes.text();
        console.error('[Chat] Failed to create support conversation:', error);
        throw new Error(`Failed to create support conversation: ${error}`);
      }

      if (person.role === "admin") {
        const assignRes = await fetch("http://localhost:5000/api/chat/support/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ adminUID: person.uid }),
        });
        console.log('[Chat] Assign admin response:', assignRes.status, assignRes.ok);
        if (!assignRes.ok) {
          const error = await assignRes.text();
          console.error('[Chat] Failed to assign admin:', error);
        }
      }
      await openConversationById(`support:${chat.userUID}`);
      return;
    }

    // SuperAdmin: cannot start/enter student support threads (student↔admin only).
    if (chat.userRole === "superAdmin" && person.role === "student") {
      throw new Error("Super admins cannot start support chats with students.");
    }

    // Admin/SuperAdmin: chatting with a student opens that student's support thread
    if (person.role === "student") {
      const createRes = await fetch(`http://localhost:5000/api/chat/support/${person.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      console.log('[Chat] Create student support response:', createRes.status, createRes.ok);
      if (!createRes.ok) {
        const error = await createRes.text();
        console.error('[Chat] Failed to create student support conversation:', error);
        throw new Error(`Failed to create student support conversation: ${error}`);
      }

      // Claim/assign the support conversation to the current admin if needed (privacy: directed inbox).
      // For superAdmins this will be enforced by join rules instead.
      if (chat.userRole === "admin") {
        // Student assignment endpoint requires student auth, so admins claim on join; open triggers join.
      }
      await openConversationById(`support:${person.uid}`);
      return;
    }

    // Admin talking to superAdmin -> create escalation conversation
    if (chat.userRole === "admin" && person.isSuperAdmin) {
      const res = await fetch("http://localhost:5000/api/chat/escalations", {
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
      const res = await fetch(`http://localhost:5000/api/chat/escalations/${person.uid}`, {
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
      <div className="h-full min-h-[16rem] flex items-center justify-center bg-base-100 rounded-box border border-base-300">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/60">Connecting...</p>
        </div>
      </div>
    );
  }

  if (!chat.isConnected) {
    return (
      <div className="h-full min-h-[16rem] flex items-center justify-center bg-base-100 rounded-box border border-base-300">
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
    <div className="chat-flex-container h-full flex flex-col bg-base-100 rounded-none md:rounded-box border-0 md:border border-base-300">
      {/* Toast notification */}
      {chat.toastNotification && (
        <ChatToast notification={chat.toastNotification} onDismiss={chat.dismissToast} />
      )}

      {/* Main chat container */}
      <div className="flex-1 flex overflow-hidden bg-base-200/40 md:bg-transparent">
        {/* Thread list - hidden on mobile, sidebar on desktop */}
        <div className="hidden md:flex md:w-80 flex-shrink-0 overflow-hidden p-3">
          <div className="flex-1 min-h-0 bg-base-100 rounded-box border border-base-300 shadow-sm overflow-hidden">
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

        {/* Mobile thread list modal */}
        <div className="md:hidden drawer flex-1 overflow-hidden">
          <input id="my-drawer" type="checkbox" className="drawer-toggle" />
          <div className="drawer-content flex flex-col h-full overflow-hidden">
            {/* Mobile chat area */}
            <div className="flex-1 flex flex-col min-h-0">
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

            {/* Mobile drawer button */}
            <label
              htmlFor="my-drawer"
              className="btn btn-primary btn-xs sm:btn-sm md:hidden sticky bottom-3 sm:bottom-4 self-start m-2 sm:m-4"
            >
              <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Chats</span>
            </label>
          </div>

          {/* Mobile drawer side */}
          <div className="drawer-side">
            <label htmlFor="my-drawer" className="drawer-overlay"></label>
            <div className="w-72 sm:w-80 h-full bg-base-100">
              <ThreadList
                conversations={chat.conversations}
                currentConversationID={chat.currentConversation?.conversationID || null}
                unreadCounts={chat.unreadCounts}
                userUID={chat.userUID}
                userRole={chat.userRole}
                isLoading={chat.isLoadingConversations}
                onSelectConversation={(conv) => {
                  handleSelectConversation(conv);
                  // Close drawer on selection
                  const checkbox = document.getElementById('my-drawer') as HTMLInputElement;
                  if (checkbox) checkbox.checked = false;
                }}
                onNewChat={() => setIsNewChatOpen(true)}
                getPersonLabel={chat.getPersonLabel}
                isSuperAdminUID={(uid) => !!chat.peopleByUID[uid]?.isSuperAdmin}
              />
            </div>
          </div>
        </div>

        {/* Desktop chat area */}
        <div className="hidden md:flex md:flex-1 flex-col overflow-hidden min-h-0">
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

            {/* Right panel: always visible on lg+, optional on md */}
            {chat.currentConversation && (
              <div className="hidden lg:flex">
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
      </div>

      {/* Small screens: slide-in details panel (no modal) */}
      {chat.currentConversation && (
        <div className={`md:hidden fixed inset-0 z-50 ${isDetailsOpen ? "" : "pointer-events-none"}`}>
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
      />
    </div>
  );
};
