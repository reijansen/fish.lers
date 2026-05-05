/**
 * MessageComposer Component
 * 
 * Input area for composing and sending messages.
 */

import React, { useState } from 'react';

interface MessageComposerProps {
  onSend: (text: string) => Promise<void>;
  onTyping?: () => void;
  disabled: boolean;
  messageInput: string;
  setMessageInput: (text: string) => void;
  isSendingMessage: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSend,
  onTyping,
  disabled,
  messageInput,
  setMessageInput,
  isSendingMessage,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!messageInput.trim() || disabled || isLoading) return;

    setIsLoading(true);
    try {
      await onSend(messageInput);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-base-300 p-4 bg-base-100">
      <div className="flex gap-2">
        <textarea
          className="textarea textarea-bordered flex-1"
          placeholder="Type a message... (Shift+Enter for new line)"
          value={messageInput}
          onChange={(e) => {
            setMessageInput(e.target.value);
            if (e.target.value.trim()) onTyping?.();
          }}
          onKeyPress={handleKeyPress}
          disabled={disabled || isLoading}
          rows={3}
        />
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={
            disabled || isLoading || isSendingMessage || !messageInput.trim()
          }
        >
          {isLoading || isSendingMessage ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Send
            </>
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  );
};
