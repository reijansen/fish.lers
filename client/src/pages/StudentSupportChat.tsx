/**
 * Student Support Chat Component
 * 
 * Main UI for students to communicate with admins.
 * 
 * File: client/src/pages/StudentSupportChat.tsx
 */

import React, { useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { Send, AlertCircle, Loader } from 'lucide-react';

export default function StudentSupportChat() {
  const {
    userUID,
    userRole,
    isConnected,
    isLoading,
    error,
    currentConversation,
    messages,
    isLoadingMessages,
    messageInput,
    setMessageInput,
    isSendingMessage,
    loadConversation,
    sendMessage,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isOwnMessage = (msg: { senderUID?: string; senderUid?: string; senderId?: string }) => {
    if (!userUID) return false;
    const current = userUID.trim().toLowerCase();
    const sender = (msg.senderUID ?? msg.senderUid ?? msg.senderId ?? "")
      .toString()
      .trim()
      .toLowerCase();
    return sender.length > 0 && sender === current;
  };

  // ========================================================================
  // LIFECYCLE: Initialize conversation on mount
  // ========================================================================

  useEffect(() => {
    if (userUID && userRole === 'student' && isConnected) {
      initializeChat();
    }
  }, [userUID, userRole, isConnected]);

  const initializeChat = async () => {
    const conversationID = `support:${userUID}`;
    await loadConversation(conversationID);
  };

  // ========================================================================
  // SCROLL TO BOTTOM ON NEW MESSAGES
  // ========================================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ========================================================================
  // HANDLE SEND MESSAGE
  // ========================================================================

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || !currentConversation) {
      return;
    }

    await sendMessage(currentConversation.conversationID, messageInput.trim());
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-base-100">
        <div className="card bg-base-200 shadow-lg p-6 max-w-sm w-full mx-4">
          <div className="card-body text-center gap-4">
            <Loader className="w-8 h-8 animate-spin mx-auto text-primary" />
            <h2 className="card-title">Connecting...</h2>
            <p className="text-sm text-base-content/60">
              Establishing connection to support chat
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* HEADER */}
      <div className="bg-primary text-primary-content sticky top-0 z-10 p-4 shadow">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Equipment Support Chat</h1>
            <p className="text-xs opacity-75">
              {currentConversation?.status === 'closed' ? 'Conversation closed' : 'Chat with admin'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-error'}`}
            />
            <span className="text-xs">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="alert alert-error shadow-md m-4 gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* MESSAGES CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-100">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-lg font-semibold">No messages yet</h3>
            <p className="text-sm text-base-content/60">
              Send a message to get support from an admin
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.messageID}
              className={`chat ${isOwnMessage(msg as any) ? 'chat-end' : 'chat-start'}`}
            >
              <div className="chat-bubble max-w-xs lg:max-w-md">
                <p className="text-xs font-semibold text-base-content/70 mb-1">
                  {isOwnMessage(msg as any) ? 'You' : msg.senderUID} ({msg.senderRole})
                </p>
                <p>{msg.content}</p>
              </div>
              <time className="text-xs opacity-50 mt-1">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </time>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      {currentConversation?.status !== 'closed' ? (
        <form
          onSubmit={handleSendMessage}
          className="border-t border-base-300 p-4 bg-base-100"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="input input-bordered flex-1"
              disabled={isSendingMessage || !isConnected}
              maxLength={5000}
            />
            <button
              type="submit"
              disabled={isSendingMessage || !isConnected || !messageInput.trim()}
              className="btn btn-primary gap-2"
            >
              {isSendingMessage ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </div>
          <p className="text-xs text-base-content/50 mt-2">
            {messageInput.length}/5000 characters
          </p>
        </form>
      ) : (
        <div className="border-t border-base-300 p-4 bg-base-200 text-center">
          <p className="text-sm font-semibold text-base-content/70">
            This conversation has been closed by an admin
          </p>
        </div>
      )}
    </div>
  );
}
