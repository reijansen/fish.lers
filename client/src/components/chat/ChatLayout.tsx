/**
 * ChatLayout Component
 * 
 * Main container for 2-pane chat UI (desktop) / stacked (mobile).
 */

import React, { useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { ThreadList } from './ThreadList';
import { ChatThread } from './ChatThread';
import { MessageComposer } from './MessageComposer';
import { ChatToast } from './ChatToast';

export const ChatLayout: React.FC = () => {
  const chat = useChat();

  // Load conversations on mount
  useEffect(() => {
    chat.loadConversations();
  }, []);

  const handleSelectConversation = async (conv: any) => {
    chat.setCurrentConversation(conv);
    await chat.loadConversation(conv.conversationID);
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
      <div className="h-screen flex items-center justify-center bg-base-100">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/60">Connecting...</p>
        </div>
      </div>
    );
  }

  if (!chat.isConnected) {
    return (
      <div className="h-screen flex items-center justify-center bg-base-100">
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
    <div className="h-screen flex flex-col bg-base-100">
      {/* Toast notification */}
      {chat.toastNotification && (
        <ChatToast notification={chat.toastNotification} onDismiss={chat.dismissToast} />
      )}

      {/* Main chat container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thread list - hidden on mobile, sidebar on desktop */}
        <div className="hidden md:flex md:w-80 flex-shrink-0">
          <ThreadList
            conversations={chat.conversations}
            currentConversationID={chat.currentConversation?.conversationID || null}
            unreadCounts={chat.unreadCounts}
            userRole={chat.userRole}
            isLoading={chat.isLoadingConversations}
            onSelectConversation={handleSelectConversation}
          />
        </div>

        {/* Mobile thread list modal */}
        <div className="md:hidden drawer">
          <input id="my-drawer" type="checkbox" className="drawer-toggle" />
          <div className="drawer-content flex flex-col">
            {/* Mobile chat area */}
            <div className="flex-1 flex flex-col">
              <ChatThread
                messages={chat.messages}
                currentConversation={chat.currentConversation}
                isLoading={chat.isLoadingMessages}
                hasMoreMessages={chat.hasMoreMessages}
                userUID={chat.userUID}
                userRole={chat.userRole}
                typingUsers={
                  chat.currentConversation
                    ? chat.typingUsersByConversation[chat.currentConversation.conversationID] || []
                    : []
                }
                onLoadMore={handleLoadMoreMessages}
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
              className="btn btn-primary btn-sm md:hidden fixed bottom-20 left-4"
            >
              Conversations
            </label>
          </div>

          {/* Mobile drawer side */}
          <div className="drawer-side">
            <label htmlFor="my-drawer" className="drawer-overlay"></label>
            <div className="w-80 h-full bg-base-100">
              <ThreadList
                conversations={chat.conversations}
                currentConversationID={chat.currentConversation?.conversationID || null}
                unreadCounts={chat.unreadCounts}
                userRole={chat.userRole}
                isLoading={chat.isLoadingConversations}
                onSelectConversation={(conv) => {
                  handleSelectConversation(conv);
                  // Close drawer on selection
                  const checkbox = document.getElementById('my-drawer') as HTMLInputElement;
                  if (checkbox) checkbox.checked = false;
                }}
              />
            </div>
          </div>
        </div>

        {/* Desktop chat area */}
        <div className="hidden md:flex md:flex-1 flex-col">
          <ChatThread
            messages={chat.messages}
            currentConversation={chat.currentConversation}
            isLoading={chat.isLoadingMessages}
            hasMoreMessages={chat.hasMoreMessages}
            userUID={chat.userUID}
            userRole={chat.userRole}
            typingUsers={
              chat.currentConversation
                ? chat.typingUsersByConversation[chat.currentConversation.conversationID] || []
                : []
            }
            onLoadMore={handleLoadMoreMessages}
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
      </div>
    </div>
  );
};
