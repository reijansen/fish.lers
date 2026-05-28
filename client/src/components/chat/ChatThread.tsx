/**
 * ChatThread Component
 *
 * Displays message list with autoscroll and pagination.
 */

import React, { useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { ChatMessage, ChatPerson, Conversation } from '../../context/ChatContext';
import { MessageBubble } from './MessageBubble';
import { ChevronLeft, Info } from "lucide-react";
import { getSupportConversationLabel } from "./chatTitleUtils";

interface ChatThreadProps {
  messages: ChatMessage[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  hasMoreMessages: boolean;
  userUID: string | null;
  userRole: 'student' | 'admin' | 'superAdmin' | null;
  typingUsers?: Array<{ userUID: string; userRole: ChatMessage["senderRole"] }>;
  getPersonLabel?: (uid: string) => string;
  peopleByUID?: Record<string, ChatPerson>;
  onLoadMore: () => Promise<void>;
  onOpenDetails?: () => void;
  onBack?: () => void;
  title?: string;
}

const formatDateSeparator = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Today';
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  }
};

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  currentConversation,
  isLoading,
  hasMoreMessages,
  userUID,
  userRole,
  typingUsers,
  getPersonLabel,
  peopleByUID,
  onLoadMore,
  onOpenDetails,
  onBack,
  title,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const isOwnMessage = useCallback(
    (msg: ChatMessage) => {
      if (!userUID) return false;
      const current = userUID.trim().toLowerCase();
      const sender =
        ((msg as any).senderUID ?? (msg as any).senderUid ?? (msg as any).senderId ?? "")
          .toString()
          .trim()
          .toLowerCase();
      return sender.length > 0 && sender === current;
    },
    [userUID]
  );

  const shouldAutoScrollRef = useRef(true);
  const pendingPrependAdjustRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const prevFirstMessageIdRef = useRef<string | null>(null);
  const prevConversationIdRef = useRef<string | null>(null);

  const computeIsNearBottom = useCallback((el: HTMLElement): boolean => {
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom < 140;
  }, []);

  // Detect scroll to top for pagination
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    shouldAutoScrollRef.current = computeIsNearBottom(target);
    if (target.scrollTop < 50 && hasMoreMessages && !isLoadingMore) {
      setIsLoadingMore(true);
      pendingPrependAdjustRef.current = true;
      prevScrollHeightRef.current = target.scrollHeight;
      prevScrollTopRef.current = target.scrollTop;
      onLoadMore().finally(() => setIsLoadingMore(false));
    }
  }, [computeIsNearBottom, hasMoreMessages, isLoadingMore, onLoadMore]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    const el = messagesAreaRef.current;
    if (el) {
      pendingPrependAdjustRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      prevScrollTopRef.current = el.scrollTop;
    }
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Group messages by date
  const messagesByDate = useMemo(() => {
    const groups: { [key: string]: ChatMessage[] } = {};
    messages.forEach((msg) => {
      // Stable day key (avoids locale parsing issues / key instability)
      const dateKey = new Date(msg.createdAt).toISOString().slice(0, 10);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    return groups;
  }, [messages]);

  // Keep scroll stable when prepending older messages; auto-scroll only if user is near bottom.
  useLayoutEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;

    // If the user switched conversations, always jump to bottom.
    if (currentConversation) {
      const prevId = prevConversationIdRef.current;
      const nextId = currentConversation.conversationID;
      if (prevId !== nextId) {
        prevConversationIdRef.current = nextId;
        shouldAutoScrollRef.current = true;
        pendingPrependAdjustRef.current = false;
        el.scrollTop = el.scrollHeight;
        return;
      }
    }

    const firstMessageId = messages[0]?.messageID ?? null;
    const prevFirstMessageId = prevFirstMessageIdRef.current;
    prevFirstMessageIdRef.current = firstMessageId;

    // If we just prepended (older first message), maintain viewport by compensating scroll delta.
    if (pendingPrependAdjustRef.current && prevFirstMessageId && firstMessageId && firstMessageId !== prevFirstMessageId) {
      const newScrollHeight = el.scrollHeight;
      const delta = newScrollHeight - prevScrollHeightRef.current;
      el.scrollTop = prevScrollTopRef.current + delta;
      pendingPrependAdjustRef.current = false;
      return;
    }

    // Otherwise, follow conversation as long as user hasn't scrolled away from bottom.
    if (shouldAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [currentConversation?.conversationID, messages]);

  // Keep content pinned to the bottom when there's little/no scroll.
  useLayoutEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 2) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isLoading]);

  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-base-200">
        <div className="text-center">
          <p className="text-lg text-base-content/60">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  const computedTitle = (() => {
    if (currentConversation.type === "staff") return "Staff Chat (Admins)";

    if (currentConversation.type === "support") {
      return getSupportConversationLabel(
        currentConversation,
        userUID,
        peopleByUID || {}
      );
    }

    if (currentConversation.type === "escalation") {
      const participants = Array.isArray(currentConversation.participants) ? currentConversation.participants : [];
      const others = participants.filter((uid) => uid && uid !== userUID);
      const otherUID = others[0] || null;

      if (userRole === "admin") {
        return `Escalation - ${otherUID ? (getPersonLabel ? getPersonLabel(otherUID) : otherUID) : "Super Admin"}`;
      }

      if (userRole === "superAdmin") {
        const adminUID = currentConversation.adminUID || otherUID;
        return `Escalation - ${adminUID ? (getPersonLabel ? getPersonLabel(adminUID) : adminUID) : "Admin"}`;
      }

      return "Escalation";
    }

    return "Conversation";
  })();

  const conversationTitle = title || computedTitle;
  const memberCount = (() => {
    if (currentConversation.type === "staff") {
      const all = Object.values(peopleByUID || {});
      const admins = all.filter((p) => p.role === "admin" || p.isSuperAdmin);
      return new Set(admins.map((p) => p.uid).filter(Boolean)).size;
    }

    const ids = Array.isArray(currentConversation.participants) ? currentConversation.participants : [];
    return new Set(ids.filter(Boolean)).size;
  })();

  const showMemberCount = currentConversation.type === "staff" || memberCount > 2;

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col bg-base-100 overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-base-300 p-3 sm:p-4 sticky top-0 bg-base-100 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2">
            {onBack && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle shrink-0"
                aria-label="Back to conversations"
                onClick={onBack}
                title="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-base sm:text-lg">
                {conversationTitle}
              </h3>
          <p className="text-xs sm:text-sm text-base-content/60">
            {showMemberCount ? `${memberCount} members` : null}
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

          {onOpenDetails && (
            <button
              type="button"
              className="btn btn-primary btn-sm sm:btn-md btn-circle shrink-0 shadow-sm"
              aria-label="Conversation details"
              onClick={onOpenDetails}
              title="Details"
            >
              <Info className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesAreaRef}
        className="flex-1 min-h-0 messages-area p-2 sm:p-4 chat-scrollbar overflow-y-scroll"
        onScroll={handleScroll}
      >
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

        <div className="min-h-full flex flex-col justify-end">
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="flex justify-center items-center flex-1">
              <p className="text-base-content/60">No messages yet. Start the conversation!</p>
            </div>
          )}

        {/* Messages grouped by date */}
        {Object.keys(messagesByDate)
          .sort((a, b) => a.localeCompare(b))
          .map((dateKey) => {
            const dayMessages = messagesByDate[dateKey];
            return (
              <div key={dateKey}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-2 sm:my-4">
                  <div className="text-xs text-base-content/50 px-2 sm:px-3 py-1 rounded-full bg-base-200">
                    {formatDateSeparator(dayMessages[0].createdAt)}
                  </div>
                </div>

                {/* Messages for this day */}
                {dayMessages.map((msg) => (
                  <MessageBubble
                    key={msg.messageID}
                    message={msg}
                    isOwn={isOwnMessage(msg)}
                    userRole={userRole}
                    getPersonLabel={getPersonLabel}
                  />
                ))}
              </div>
            );
          })}

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
    </div>
  );
};
