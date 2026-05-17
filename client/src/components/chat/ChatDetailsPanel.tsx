import React, { useMemo, useState } from "react";
import { Copy, Users, Info, X } from "lucide-react";
import type { Conversation, ChatPerson } from "../../context/ChatContext";

type Props = {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  userUID: string | null;
  userRole: "student" | "admin" | "superAdmin" | null;
  peopleByUID: Record<string, ChatPerson>;
  getPersonLabel: (uid: string) => string;
  title: string;
  containerClassName?: string;
  showClose?: boolean;
};

function roleLabel(role: Conversation["lastMessageSenderRole"] | ChatPerson["role"] | undefined, isSuperAdmin?: boolean) {
  if (isSuperAdmin) return "SuperAdmin";
  if (role === "admin") return "Admin";
  if (role === "student") return "Student";
  if (role === "superAdmin") return "SuperAdmin";
  return "User";
}

function formatWhen(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const ChatDetailsPanel: React.FC<Props> = ({
  open,
  onClose,
  conversation,
  userUID,
  userRole,
  peopleByUID,
  getPersonLabel,
  title,
  containerClassName,
  showClose = true,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const typeLabel = useMemo(() => {
    if (conversation.type === "staff") return "Staff";
    if (conversation.type === "support") return "Support";
    if (conversation.type === "escalation") return "Escalation";
    return "Conversation";
  }, [conversation.type]);

  const participants = useMemo(() => {
    const ids = Array.isArray(conversation.participants) ? conversation.participants : [];
    const unique = Array.from(new Set(ids.filter(Boolean)));
    return unique.map((uid) => {
      const person = peopleByUID[uid];
      return {
        uid,
        name: getPersonLabel(uid),
        role: roleLabel(person?.role, person?.isSuperAdmin),
        isYou: !!userUID && uid === userUID,
        email: person?.email,
      };
    });
  }, [conversation.participants, getPersonLabel, peopleByUID, userUID]);

  const lastSender = useMemo(() => {
    if (!conversation.lastMessageSenderUID) return null;
    const uid = conversation.lastMessageSenderUID;
    const person = peopleByUID[uid];
    const role = conversation.lastMessageSenderRole
      ? roleLabel(conversation.lastMessageSenderRole)
      : roleLabel(person?.role, person?.isSuperAdmin);
    return { uid, name: getPersonLabel(uid), role };
  }, [conversation.lastMessageSenderRole, conversation.lastMessageSenderUID, getPersonLabel, peopleByUID]);

  const doCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 900);
    } catch {
      // ignore clipboard failures
    }
  };

  const staffMembers = useMemo(() => {
    if (conversation.type !== "staff") return null;
    const all = Object.values(peopleByUID || {});
    const admins = all.filter((p) => p.role === "admin" || p.isSuperAdmin);
    const unique = Array.from(new Map(admins.map((p) => [p.uid, p])).values());
    unique.sort((a, b) => (a.displayName || a.email || a.uid).localeCompare(b.displayName || b.email || b.uid));
    return unique;
  }, [conversation.type, peopleByUID]);

  const memberItems = useMemo(() => {
    if (conversation.type === "staff") {
      const list = staffMembers || [];
      return list.map((p) => ({
        uid: p.uid,
        name: p.displayName || p.email || p.uid,
        email: p.email,
        role: roleLabel(p.role, p.isSuperAdmin),
        isYou: !!userUID && p.uid === userUID,
      }));
    }
    return participants;
  }, [conversation.type, participants, staffMembers, userUID]);

  if (!open) return null;

  return (
    <div className={containerClassName || "w-80 xl:w-96 border-l border-base-300 bg-base-100 flex flex-col min-h-0"}>
      <div className="p-4 border-b border-base-300">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="min-w-0">
                <div className="font-bold truncate">{title}</div>
                <div className="text-sm text-base-content/60">
                  <span className="badge badge-outline badge-sm">{typeLabel}</span>
                </div>
              </div>
            </div>
          </div>
          {showClose && (
            <button type="button" className="btn btn-ghost btn-sm btn-square" aria-label="Close details" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto chat-scrollbar">
        <div className="p-3 sm:p-4 space-y-3">
          {/* Chat members */}
          <details className="collapse collapse-arrow bg-base-200/40 rounded-box" open>
            <summary className="collapse-title text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> Chat members
              <span className="badge badge-ghost badge-sm ml-auto">
                {memberItems.length}
              </span>
            </summary>
            <div className="collapse-content">
              <div className="space-y-2">
                {memberItems.map((p: any, idx: number) => (
                  <div
                    key={`${p.uid || "unknown"}:${p.email || p.name || idx}`}
                    className="flex items-center justify-between gap-3 p-2 rounded-box bg-base-100 border border-base-300/60"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-semibold truncate">{p.name}</div>
                        <span className="badge badge-ghost badge-sm">{p.role}</span>
                        {p.isYou && <span className="badge badge-primary badge-sm">You</span>}
                      </div>
                      {p.email && <div className="text-xs text-base-content/60 truncate">{p.email}</div>}
                      <div className="text-[11px] text-base-content/50 truncate">UID: {p.uid}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square"
                      aria-label="Copy UID"
                      onClick={() => doCopy(`uid:${p.uid}`, p.uid)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {copiedKey && <div className="mt-2 text-xs text-success">Copied.</div>}
            </div>
          </details>

          {/* About */}
          <details className="collapse collapse-arrow bg-base-200/40 rounded-box" open>
            <summary className="collapse-title text-sm font-semibold flex items-center gap-2">
              <Info className="w-4 h-4" /> About
            </summary>
            <div className="collapse-content">
              {conversation.type === "support" && (
                <div className="space-y-1 text-sm">
                  <div className="text-base-content/80">Student support thread.</div>
                  {conversation.studentUID && (
                    <div className="text-base-content/60">
                      Student: <span className="font-medium">{getPersonLabel(conversation.studentUID)}</span>
                    </div>
                  )}
                  {conversation.adminUID && (
                    <div className="text-base-content/60">
                      Assigned admin: <span className="font-medium">{getPersonLabel(conversation.adminUID)}</span>
                    </div>
                  )}
                </div>
              )}
              {conversation.type === "escalation" && (
                <div className="space-y-1 text-sm">
                  <div className="text-base-content/80">Escalation thread between admins and super admins.</div>
                  {conversation.escalationReason && (
                    <div className="text-base-content/60">
                      Reason: <span className="font-medium">{conversation.escalationReason}</span>
                    </div>
                  )}
                </div>
              )}
              {conversation.type === "staff" && (
                <div className="space-y-1 text-sm">
                  <div className="text-base-content/80">Internal staff chat for admins & super admins.</div>
                  <div className="text-base-content/60">Includes all users with role Admin or SuperAdmin.</div>
                  <div className="text-base-content/60">Use this channel for coordination, not student support.</div>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
