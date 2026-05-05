/**
 * ChatThread Component
 * 
 * Displays message list with autoscroll and pagination.
 */

import React, { useEffect, useRef } from 'react';
import { ChatMessage, Conversation } from '../../context/ChatContext';
import { MessageBubble } from './MessageBubble';

interface ChatThreadProps {
  messages: ChatMessage[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  hasMoreMessages: boolean;
  userUID: string | null;
  userRole: 'student' | 'admin' | 'superAdmin' | null;
  typingUsers?: Array<{ userUID: string; userRole: ChatMessage["senderRole"] }>;
  getPersonLabel?: (uid: string) => string;
  onLoadMore: () => Promise<void>;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  currentConversation,
  isLoading,
  hasMoreMessages,
  userUID,
  userRole,
  typingUsers,
  getPersonLabel,
  onLoadMore,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-base-200">
        <div className="text-center">
          <p className="text-lg text-base-content/60">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-base-100 flex flex-col"
    >
      {/* Header */}
      <div className="border-b border-base-300 p-4 sticky top-0 bg-base-100 z-10">
        <div>
          <h3 className="font-semibold text-lg">
            {currentConversation.type === 'support'
              ? `Support Chat${
                  currentConversation.studentUID
                    ? ` - ${getPersonLabel ? getPersonLabel(currentConversation.studentUID) : currentConversation.studentUID}`
                    : ''
                }`
              : `Escalation${currentConversation.escalationReason ? ` - ${currentConversation.escalationReason}` : ''}`}
          </h3>
          <p className="text-sm text-base-content/60">
            {currentConversation.messageCount} messages
            {currentConversation.status === 'closed' && (
              <span className="ml-2 badge badge-warning">Closed</span>
            )}
          </p>
          {typingUsers && typingUsers.length > 0 && (
            <p className="text-sm text-base-content/70 mt-1">
              {typingUsers.length === 1
                ? `${typingUsers[0].userRole} is typing...`
                : `Multiple people are typing...`}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Load More Button */}
        {hasMoreMessages && (
          <div className="flex justify-center mb-4">
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleLoadMore}
              disabled={isLoading || isLoadingMore}
            >
              {isLoadingMore ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Loading...
                </>
              ) : (
                'Load earlier messages'
              )}
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex justify-center items-center h-full">
            <p className="text-base-content/60">No messages yet. Start the conversation!</p>
          </div>
        )}

        {/* Messages list */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.messageID}
            message={msg}
            isOwn={msg.senderUID === userUID}
            userRole={userRole}
            getPersonLabel={getPersonLabel}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
