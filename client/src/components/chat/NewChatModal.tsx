import React, { useEffect, useMemo, useState } from "react";
import { auth } from "../../firebase";

export type ChatPerson = {
  uid: string;
  displayName?: string;
  email: string;
  role: "student" | "admin";
  isSuperAdmin?: boolean;
};

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onStart: (person: ChatPerson) => Promise<void>;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ open, onClose, onStart }) => {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await (auth.currentUser?.getIdToken() ?? Promise.resolve(""));
        const url = new URL("http://localhost:5000/api/chat/people");
        if (query.trim()) url.searchParams.set("q", query.trim());
        url.searchParams.set("limit", "50");

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load people");
        const data = await res.json();
        setPeople(Array.isArray(data.people) ? data.people : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load people");
      } finally {
        setIsLoading(false);
      }
    };

    // slight debounce
    const t = setTimeout(run, 200);
    return () => clearTimeout(t);
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setPeople([]);
      setSelectedUid("");
      setError(null);
    }
  }, [open]);

  const selected = useMemo(
    () => people.find((p) => p.uid === selectedUid) || null,
    [people, selectedUid]
  );

  const handleStart = async () => {
    if (!selected) return;
    setIsStarting(true);
    setError(null);
    try {
      await onStart(selected);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to start chat");
    } finally {
      setIsStarting(false);
    }
  };

  if (!open) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-[calc(100%-1.5rem)] max-w-lg">
        <h3 className="font-bold text-lg">Start a new chat</h3>
        <p className="text-sm text-base-content/60 mt-1">
          Select a person from the list.
        </p>

        <div className="mt-4 space-y-3">
          <input
            className="input input-bordered w-full"
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <select
            className="select select-bordered w-full"
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            disabled={isLoading}
          >
            <option value="" disabled>
              {isLoading ? "Loading..." : "Choose a person"}
            </option>
            {people.map((p) => (
              <option key={p.uid} value={p.uid}>
                {(p.displayName || p.email) +
                  (p.isSuperAdmin ? " (Super Admin)" : p.role === "admin" ? " (Admin)" : " (Student)")}
              </option>
            ))}
          </select>

          {error && (
            <div className="alert alert-error py-2">
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <div className="modal-action">
          <button className="btn" onClick={onClose} disabled={isStarting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={!selected || isStarting}
          >
            {isStarting ? <span className="loading loading-spinner loading-sm"></span> : "Start Chat"}
          </button>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
};

