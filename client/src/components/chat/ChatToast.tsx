/**
 * ChatToast Component
 * 
 * Displays inbox notifications as a toast/alert.
 */

import React from 'react';
import { InboxNotification } from '../../context/ChatContext';

interface ChatToastProps {
  notification: InboxNotification;
  onDismiss: () => void;
}

export const ChatToast: React.FC<ChatToastProps> = ({ notification, onDismiss }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'student_message':
        return '💬';
      case 'admin_reply':
        return '✉️';
      case 'escalation_created':
        return '⚠️';
      case 'superadmin_reply':
        return '🔔';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="toast toast-top toast-end z-50">
      <div className="alert alert-info">
        <span>
          {getIcon()} {notification.message}
        </span>
        <button className="btn btn-sm btn-ghost" onClick={onDismiss}>
          ✕
        </button>
      </div>
    </div>
  );
};
