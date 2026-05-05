/**
 * ThreadList Component
 * 
 * Displays inbox with conversations, search, and unread badges.
 */

import React, { useState, useMemo } from 'react';
import { Conversation } from '../../context/ChatContext';
import { Plus } from "lucide-react";

interface ThreadListProps {
  conversations: Conversation[];
  currentConversationID: string | null;
  unreadCounts: Record<string, number>;
  userRole: 'student' | 'admin' | 'superAdmin' | null;
  isLoading: boolean;
  onSelectConversation: (conv: Conversation) => void;
  onNewChat: () => void;
  getPersonLabel: (uid: string) => string;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  conversations,
  currentConversationID,
  unreadCounts,
  userRole,
  isLoading,
  onSelectConversation,
  onNewChat,
  getPersonLabel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'support' | 'escalation'>('all');

  // Filter conversations
  const filtered = useMemo(() => {
    return conversations.filter((conv) => {
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

  return (
    <div className="w-full h-full flex flex-col bg-base-100 border-r border-base-300">
      {/* Header */}
      <div className="border-b border-base-300 p-4 sticky top-0 bg-base-100">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold">Messages</h2>
          <button className="btn btn-sm btn-primary gap-2" onClick={onNewChat}>
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          className="input input-bordered input-sm w-full mb-3"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Filters - show tabs for admin/superAdmin */}
        {(userRole === 'admin' || userRole === 'superAdmin') && (
          <div className="tabs tabs-boxed tabs-sm">
            <button
              className={`tab ${filterType === 'all' ? 'tab-active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All
            </button>
            <button
              className={`tab ${filterType === 'support' ? 'tab-active' : ''}`}
              onClick={() => setFilterType('support')}
            >
              Support
            </button>
            <button
              className={`tab ${filterType === 'escalation' ? 'tab-active' : ''}`}
              onClick={() => setFilterType('escalation')}
            >
              Escalations
            </button>
          </div>
        )}
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
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
              const isSelected = currentConversationID === conv.conversationID;

              return (
                <button
                  key={conv.conversationID}
                  onClick={() => onSelectConversation(conv)}
                  className={`w-full text-left p-4 hover:bg-base-200 transition-colors ${
                    isSelected ? 'bg-base-200' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-sm">
                        {conv.type === 'support'
                          ? `Support: ${conv.studentUID ? getPersonLabel(conv.studentUID) : 'Unknown'}`
                          : `Escalation${conv.escalationReason ? ': ' + conv.escalationReason : ''}`}
                      </h3>
                    </div>
                    <div className="ml-2 flex items-center gap-2 flex-shrink-0">
                      {unreadCount > 0 && (
                        <div className="badge badge-primary badge-sm">
                          {unreadCount}
                        </div>
                      )}
                      <span className="text-xs text-base-content/60">
                        {formatDate(conv.lastMessageAt)}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-base-content/60 truncate">
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
