/**
 * Chat Page
 * 
 * Main chat interface for all users.
 */

import React from 'react';
import { ChatLayout } from '../components/chat/ChatLayout';

const ChatPage: React.FC = () => {
  return (
    <div className="w-full h-full min-h-0">
      <ChatLayout />
    </div>
  );
};

export default ChatPage;
