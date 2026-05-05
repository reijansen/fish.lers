/**
 * Admin Support Queue Dashboard
 * 
 * Shows all student support conversations in a queue for admins to manage.
 * 
 * File: client/src/pages/admin/AdminSupportQueue.tsx
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { MessageSquare, AlertCircle, Loader, Filter } from 'lucide-react';

export default function AdminSupportQueue() {
  const navigate = useNavigate();
  const {
    userRole,
    isConnected,
    isLoading,
    error,
    conversations,
    isLoadingConversations,
    loadConversations,
  } = useChat();

  const [filterStatus, setFilterStatus] = useState<'active' | 'closed' | 'all'>('active');
  const [searchTerm, setSearchTerm] = useState('');

  // ========================================================================
  // LIFECYCLE: Load conversations on mount
  // ========================================================================

  useEffect(() => {
    if (isConnected && (userRole === 'admin' || userRole === 'superAdmin')) {
      loadConversations({
        type: 'student_support',
        status: filterStatus === 'all' ? undefined : filterStatus,
      });
    }
  }, [isConnected, userRole, filterStatus]);

  // ========================================================================
  // FILTERS
  // ========================================================================

  const filteredConversations = conversations.filter((conv) => {
    if (filterStatus !== 'all' && conv.status !== filterStatus) {
      return false;
    }

    if (
      searchTerm &&
      !conv.studentUID?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !conv.lastMessageText?.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  // ========================================================================
  // PERMISSION CHECK
  // ========================================================================

  if (userRole !== 'admin' && userRole !== 'superAdmin') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-base-100">
        <div className="alert alert-error shadow-lg gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>You don't have permission to access this page</span>
        </div>
      </div>
    );
  }

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* HEADER */}
      <div className="bg-primary text-primary-content sticky top-0 z-10 p-4 sm:p-6 shadow">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Student Support Queue</h1>
              <p className="text-sm opacity-75 mt-1">
                Manage and respond to student equipment support requests
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-error'}`}
              />
              <span className="text-sm">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
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

      {/* FILTERS & SEARCH */}
      <div className="bg-base-200 p-4 sm:p-6 border-b border-base-300 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-base-content/60" />
            <span className="text-sm font-semibold">Status:</span>
            <div className="join gap-1">
              {(['active', 'closed', 'all'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`btn btn-sm ${
                    filterStatus === status ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status === 'active' && (
                    <span className="badge badge-sm badge-primary">
                      {conversations.filter((c) => c.status === 'active').length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="Search by student UID or message preview..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input input-bordered input-sm w-full"
          />
        </div>
      </div>

      {/* CONVERSATIONS LIST */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <Loader className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-base-content/60">Loading conversations...</p>
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-base-content/30 mb-4" />
              <h3 className="text-lg font-semibold">No conversations found</h3>
              <p className="text-sm text-base-content/60">
                {searchTerm
                  ? 'Try adjusting your search filters'
                  : 'Waiting for students to request support'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.conversationID}
                  onClick={() =>
                    navigate(`/admin/support-queue/${conv.conversationID}`)
                  }
                  className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="card-body p-4 gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="card-title text-sm">
                            {conv.studentUID}
                          </h3>
                          <span
                            className={`badge badge-sm ${
                              conv.status === 'active'
                                ? 'badge-success'
                                : 'badge-neutral'
                            }`}
                          >
                            {conv.status}
                          </span>
                        </div>

                        <p className="text-sm text-base-content/70 line-clamp-2 mt-1">
                          {conv.lastMessageText || 'No messages yet'}
                        </p>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-base-content/50">
                            {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-base-content/50">
                            {new Date(conv.updatedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <MessageSquare className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
