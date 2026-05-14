/**
 * ThreadList Component
 * 
 * Displays inbox with conversations, search, and unread badges.
 */

import React, { useState, useMemo } from 'react';
import { Conversation } from '../../context/ChatContext';
import { Plus, Pin } from "lucide-react";

interface ThreadListProps {
  conversations: Conversation[];
  currentConversationID: string | null;
  unreadCounts: Record<string, number>;
  userUID: string | null;
  userRole: 'student' | 'admin' | 'superAdmin' | null;
  isLoading: boolean;
  onSelectConversation: (conv: Conversation) => void;
  onNewChat: () => void;
  getPersonLabel: (uid: string) => string;
  isSuperAdminUID?: (uid: string) => boolean;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  conversations,
  currentConversationID,
  unreadCounts,
  userUID,
  userRole,
  isLoading,
  onSelectConversation,
  onNewChat,
  getPersonLabel,
  isSuperAdminUID,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'support' | 'escalation'>('all');
  const unreadThreadCount = useMemo(
    () => Object.values(unreadCounts).filter((n) => (n || 0) > 0).length,
    [unreadCounts]
  );
  const unreadThreadCountLabel = unreadThreadCount > 9 ? '9+' : `${unreadThreadCount}`;

  // Filter conversations
  const filtered = useMemo(() => {
    const staff = conversations.find((c) => c.type === "staff" || c.conversationID === "staff:admins") || null;
    const base = conversations.filter((conv) => {
      if (staff && conv.conversationID === staff.conversationID) return false;

      // Type filter
      if (filterType !== 'all' && conv.type !== filterType) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const conversationID = conv.conversationID.toLowerCase();
        const preview = conv.lastMessagePreview?.toLowerCase() || '';
        return conversationID.includes(query) || preview.includes(query);
      }

      return true;
    });

    // When not searching, collapse duplicate escalation threads per adminUID.
    // (Escalations are per-admin threads; multiple documents can exist historically but the inbox should be person-centric.)
    const includeStaff = !!staff && (filterType === "all" || searchQuery.trim().length > 0);

    if (searchQuery.trim()) {
      return includeStaff ? [staff!, ...base] : base;
    }

    const sorted = [...base].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    const seenEscalationAdmins = new Set<string>();
    const collapsed: Conversation[] = [];

    for (const conv of sorted) {
      if (conv.type !== "escalation") {
        collapsed.push(conv);
        continue;
      }

      const key = conv.adminUID || conv.conversationID;
      if (seenEscalationAdmins.has(key)) continue;
      seenEscalationAdmins.add(key);
      collapsed.push(conv);
    }

    return includeStaff ? [staff!, ...collapsed] : collapsed;
  }, [conversations, filterType, searchQuery]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getEscalationLabel = (conv: Conversation): string => {
    const roleLabel = (role: Conversation["lastMessageSenderRole"]): string => {
      if (role === "superAdmin") return "SuperAdmin";
      if (role === "admin") return "Admin";
      if (role === "student") return "Student";
      return "User";
    };

    // Prefer last sender identity (matches "who sent the chat").
    if (conv.lastMessageSenderUID && conv.lastMessageSenderRole) {
      // If the last sender is "me", show the other party instead (more useful for an inbox).
      if (userUID && conv.lastMessageSenderUID === userUID) {
        const participants = Array.isArray(conv.participants) ? conv.participants : [];
        const others = participants.filter((uid) => uid && uid !== userUID);
        const otherUID = others[0];
        if (otherUID) {
          // For an admin's escalation thread, the "other" side is always a superAdmin group.
          const inferredRole = userRole === "admin" ? "SuperAdmin" : isSuperAdminUID?.(otherUID) ? "SuperAdmin" : "Admin";
          return `${getPersonLabel(otherUID)} (${inferredRole})`;
        }
      }

      return `${getPersonLabel(conv.lastMessageSenderUID)} (${roleLabel(conv.lastMessageSenderRole)})`;
    }

    if (userRole === "superAdmin") {
      return conv.adminUID ? `${getPersonLabel(conv.adminUID)} (Admin)` : "Escalation";
    }

    // Admin view: escalation is with superAdmins; don't show own name.
    if (userRole === "admin") {
      const participants = Array.isArray(conv.participants) ? conv.participants : [];
      const others = participants.filter((uid) => uid && uid !== userUID);
      // Prefer showing a specific superAdmin participant if known.
      const superAdminUID = isSuperAdminUID ? others.find((uid) => isSuperAdminUID(uid)) : undefined;
      if (superAdminUID) return `${getPersonLabel(superAdminUID)} (SuperAdmin)`;

      const firstOther = others[0];
      if (firstOther) {
        // Escalations are admin↔superAdmin by design; if we can't detect role, default to SuperAdmin.
        const suffix = isSuperAdminUID ? (isSuperAdminUID(firstOther) ? " (SuperAdmin)" : " (Admin)") : " (SuperAdmin)";
        return `${getPersonLabel(firstOther)}${suffix}`;
      }

      return "Super Admins";
    }

    return conv.adminUID ? getPersonLabel(conv.adminUID) : "Escalation";
  };

  return (
    <div className="chat-flex-container bg-base-100 h-full flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="border-b border-base-300 p-3 sm:p-4 bg-base-100">
        <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold">Messages</h2>
            {unreadThreadCount > 0 && (
              <span className="badge badge-primary badge-sm">{unreadThreadCountLabel}</span>
            )}
          </div>
          <button className="btn btn-xs sm:btn-sm btn-primary gap-1 sm:gap-2" onClick={onNewChat}>
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          className="input input-bordered input-xs sm:input-sm w-full mb-2 sm:mb-3"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

      {/* Filters - show tabs for admin only */}
      {userRole === 'admin' && (
        <div className="join w-full">
          <button
            type="button"
            className={`join-item btn btn-xs sm:btn-sm flex-1 ${filterType === "all" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilterType("all")}
          >
            All
          </button>
          <button
            type="button"
            className={`join-item btn btn-xs sm:btn-sm flex-1 ${filterType === "support" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilterType("support")}
          >
            Support
          </button>
          <button
            type="button"
            className={`join-item btn btn-xs sm:btn-sm flex-1 ${filterType === "escalation" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilterType("escalation")}
          >
            Escalations
          </button>
        </div>
        )}
      </div>

      {/* Conversations list */}
      <div className="flex-1 min-h-0 overflow-y-auto chat-scrollbar pr-1">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <span className="loading loading-spinner"></span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-base-content/60">
            {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
          </div>
        ) : (
          <div className="divide-y divide-base-300">
            {filtered.map((conv) => {
              const unreadCount = unreadCounts[conv.conversationID] || 0;
              const unreadLabel = unreadCount > 9 ? "9+" : `${unreadCount}`;
              const isSelected = currentConversationID === conv.conversationID;
              const isUnread = unreadCount > 0;
              const isPinned = conv.type === "staff" || conv.conversationID === "staff:admins";

              return (
                <button
                  key={conv.conversationID}
                  onClick={() => onSelectConversation(conv)}
                  className={`w-full text-left p-3 sm:p-4 hover:bg-base-200 transition-colors border-l-4 ${
                    isSelected
                      ? 'bg-base-200 border-l-primary'
                      : isPinned
                      ? 'bg-primary/5 border-l-primary/70'
                      : isUnread
                      ? 'bg-base-200/50 border-l-transparent'
                      : 'border-l-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className={`truncate text-sm sm:text-base ${isUnread ? "font-bold" : "font-semibold"}`}>
                        {conv.type === "staff"
                          ? "Staff Chat (Admins)"
                          : conv.type === 'support' && conv.studentUID
                          ? getPersonLabel(conv.studentUID)
                          : conv.type === 'escalation' && conv.adminUID
                          ? getEscalationLabel(conv)
                          : `Escalation${conv.escalationReason ? ': ' + conv.escalationReason : ''}`}
                      </h3>
                    </div>
                    <div className="ml-2 flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      {isPinned && (
                        <span className="badge badge-primary badge-xs sm:badge-sm gap-1">
                          <Pin className="w-3 h-3" />
                          Pinned
                        </span>
                      )}
                      {unreadCount > 0 && (
                        <div className="badge badge-primary badge-xs sm:badge-sm">
                          {unreadLabel}
                        </div>
                      )}
                      <span className="text-xs text-base-content/60 whitespace-nowrap">
                        {formatDate(conv.lastMessageAt)}
                      </span>
                    </div>
                  </div>

                  <p className={`text-xs truncate ${isUnread ? "text-base-content/80 font-semibold" : "text-base-content/60"}`}>
                    {conv.lastMessagePreview || 'No messages yet'}
                  </p>

                  {conv.status === 'closed' && (
                    <span className="badge badge-warning badge-xs mt-2">Closed</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
