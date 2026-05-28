import type { ChatPerson, Conversation } from "../../context/ChatContext";

export function getSupportConversationLabel(
  conversation: Conversation,
  userUID: string | null,
  peopleByUID: Record<string, ChatPerson>
): string {
  const participants = Array.isArray(conversation.participants) ? conversation.participants : [];

  const otherUID =
    participants.find((uid) => uid && uid !== userUID) ||
    (conversation.studentUID && conversation.studentUID !== userUID ? conversation.studentUID : null) ||
    (conversation.adminUID && conversation.adminUID !== userUID ? conversation.adminUID : null) ||
    null;

  if (!otherUID) return "Support Chat";

  const person = peopleByUID[otherUID];
  if (!person) return "Support Chat";

  return person.displayName || person.email || "Support Chat";
}