/**
 * MessageBubble Component
 * 
 * Displays individual message with role label and styling (Messenger-like).
 */

import React from 'react';
import { ChatMessage } from '../../context/ChatContext';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  userRole: 'student' | 'admin' | 'superAdmin' | null;
  getPersonLabel?: (uid: string) => string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, userRole, getPersonLabel }) => {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getRoleLabel = (role: string) => {
    if (role === 'superAdmin') return 'SuperAdmin';
    if (role === 'admin') return 'Admin';
    return 'Student';
  };

  const senderName = getPersonLabel ? getPersonLabel(message.senderUID) : (message.senderRole === 'student' ? 'Student' : 'Admin');

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2 px-2 sm:px-0`}>
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-sm`}>
        {/* Sender name - only show for others' messages */}
        {!isOwn && (
          <span className="text-xs font-semibold text-base-content/70 mb-1 px-3">
            {senderName}
            {userRole !== 'student' && ` (${getRoleLabel(message.senderRole)})`}
          </span>
        )}
        
        {/* Message bubble */}
        <div
          className={`rounded-3xl px-3 sm:px-4 py-2 break-words ${
            isOwn
              ? 'bg-primary text-primary-content rounded-br-none'
              : 'bg-base-200 text-base-content rounded-bl-none'
          }`}
        >
          <p className="text-xs sm:text-sm">{message.content}</p>
        </div>
        
        {/* Timestamp */}
        <span className="text-xs text-base-content/50 mt-1 px-3">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
};
