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
    <div className="sticky bottom-0 p-2 sm:p-4 bg-base-100 border-t border-base-300 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
      <div className="flex gap-2 items-end">
        <textarea
          className="textarea textarea-bordered textarea-xs sm:textarea-sm flex-1 resize-none"
          placeholder="Message..."
          value={messageInput}
          onChange={(e) => {
            setMessageInput(e.target.value);
            if (e.target.value.trim()) onTyping?.();
          }}
          onKeyPress={handleKeyPress}
          disabled={disabled || isLoading}
          rows={1}
        />
        <button
          className="btn btn-primary btn-xs sm:btn-sm h-10"
          onClick={handleSend}
          disabled={
            disabled || isLoading || isSendingMessage || !messageInput.trim()
          }
        >
          {isLoading || isSendingMessage ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <span className="hidden sm:inline">Send</span>
          )}
        </button>
      </div>
    </div>
  );
};
