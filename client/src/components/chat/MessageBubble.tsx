/**
 * MessageBubble Component
 * 
 * Displays individual message with role label and styling.
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
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleLabel = (role: string) => {
    if (role === 'superAdmin') return '🔴 SuperAdmin';
    if (role === 'admin') return '🔵 Admin';
    return 'Student';
  };

  return (
    <div className={`chat ${isOwn ? 'chat-end' : 'chat-start'} mb-4`}>
      <div className="chat-bubble" style={{
        backgroundColor: isOwn ? 'rgb(59, 130, 246)' : 'rgb(107, 114, 128)',
        color: 'white',
      }}>
        {/* Role label for non-student view */}
        {(userRole === 'admin' || userRole === 'superAdmin') && !isOwn && (
          <div className="text-xs opacity-75 mb-1 font-semibold">
            {(getPersonLabel ? getPersonLabel(message.senderUID) : message.senderUID) +
              ' • ' +
              getRoleLabel(message.senderRole)}
          </div>
        )}
        
        {/* Message content */}
        <p className="break-words">{message.content}</p>
        
        {/* Timestamp */}
        <div className="text-xs opacity-75 mt-1">
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
};
