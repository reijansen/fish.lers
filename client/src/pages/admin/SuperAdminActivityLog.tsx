import React from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Activity, Calendar, Filter, Search, ShieldCheck } from "lucide-react";
import LoadingOverlay from "../../components/LoadingOverlay";
import MobileStatsPager from "../../components/MobileStatsPager";
import { db } from "../../firebase";
import { formatRoleLabel } from "../../utils/roleLabel";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

type RequestDoc = {
  id: string;
  purpose?: string;
  status?: string;
  overriddenBy?: string;
  overriddenAt?: any;
  overrideReason?: string;
  overrideFromStatus?: string;
  updatedAt?: any;
};

type UserDoc = {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  isSuperAdmin?: boolean;
  updatedAt?: any;
};

type ActivityType = "override" | "privilege";

type ActivityEvent = {
  id: string;
  type: ActivityType;
  occurredAt: Date | null;
  actorUid?: string;
  actorLabel: string;
  title: string;
  description: string;
  requestId?: string;
  targetUid?: string;
  meta?: Record<string, any>;
};

function parseTimestamp(value: any): Date | null {
  try {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (value instanceof Date) return value;
  } catch {
    return null;
  }
  return null;
}

function normalizeStatus(status?: string): string {
  const s = (status || "").toLowerCase();
  if (!s) return "Unknown";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function describeDateRange(fromDate: string, toDate: string) {
  if (!fromDate && !toDate) return "";
  if (fromDate && toDate) return `${fromDate} → ${toDate}`;
  if (fromDate) return `From ${fromDate}`;
  return `Until ${toDate}`;
}

function formatOccurredAt(occurredAt: Date | null) {
  if (!occurredAt) return "Unknown";
  return occurredAt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Chip({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <div className="badge badge-outline gap-2 py-3 px-3">
      <span className="text-xs">{label}</span>
      {onRemove ? (
        <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={onRemove}>
          ✕
        </button>
      ) : null}
    </div>
  );
}

const SuperAdminActivityLog: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [requests, setRequests] = React.useState<RequestDoc[]>([]);
  const [users, setUsers] = React.useState<UserDoc[]>([]);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [typeFilter, setTypeFilter] = React.useState<"all" | ActivityType>("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<"desc" | "asc">("desc");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = React.useState(false);
  const [activeEventId, setActiveEventId] = React.useState<string | null>(null);
  const [mobileVisibleCount, setMobileVisibleCount] = React.useState(20);

  React.useEffect(() => {
    const reqQuery = query(collection(db, "requests"), orderBy("updatedAt", "desc"));
    const userQuery = query(collection(db, "users"), orderBy("updatedAt", "desc"));

    let requestsReady = false;
    let usersReady = false;

    const finishLoading = () => {
      if (requestsReady && usersReady) {
        setLoading(false);
      }
    };

    const unsubRequests = onSnapshot(
      reqQuery,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as RequestDoc[];
        setRequests(next);
        requestsReady = true;
        finishLoading();
      },
      () => {
        requestsReady = true;
        finishLoading();
      }
    );

    const unsubUsers = onSnapshot(
      userQuery,
      (snap) => {
        const next = snap.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as any),
        })) as UserDoc[];
        setUsers(next);
        usersReady = true;
        finishLoading();
      },
      () => {
        usersReady = true;
        finishLoading();
      }
    );

    return () => {
      unsubRequests();
      unsubUsers();
    };
  }, []);

  const userNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => {
      map[u.uid] = u.displayName || u.email || u.uid;
    });
    return map;
  }, [users]);

  const allEvents = React.useMemo(() => {
    const overrideEvents: ActivityEvent[] = requests
      .filter((r) => !!r.overriddenBy || !!r.overriddenAt || !!r.overrideReason)
      .map((r) => {
        const actorUid = r.overriddenBy;
        const actorLabel = actorUid ? userNameMap[actorUid] || actorUid : "Unknown actor";
        const from = normalizeStatus(r.overrideFromStatus);
        const to = normalizeStatus(r.status);
        return {
          id: `override-${r.id}`,
          type: "override",
          occurredAt: parseTimestamp(r.overriddenAt) || parseTimestamp(r.updatedAt),
          actorUid,
          actorLabel,
          title: "Request Decision Overridden",
          description: `${from} to ${to}${r.purpose ? ` • ${r.purpose}` : ""}${r.overrideReason ? ` • Reason: ${r.overrideReason}` : ""}`,
          requestId: r.id,
          meta: {
            fromStatus: from,
            toStatus: to,
            purpose: r.purpose,
            overrideReason: r.overrideReason,
            overriddenBy: r.overriddenBy,
          },
        };
      });

    const privilegeEvents: ActivityEvent[] = users
      .filter((u) => u.role === "admin" || !!u.isSuperAdmin)
      .map((u) => {
        const roleLabel = formatRoleLabel(u.role || "student", !!u.isSuperAdmin);
        return {
          id: `privilege-${u.uid}-${u.updatedAt || "na"}`,
          type: "privilege",
          occurredAt: parseTimestamp(u.updatedAt),
          actorUid: u.uid,
          actorLabel: u.displayName || u.email || u.uid,
          title: "Privilege State Updated",
          description: `Current role: ${roleLabel}`,
          targetUid: u.uid,
          meta: {
            role: u.role,
            isSuperAdmin: u.isSuperAdmin,
            roleLabel,
            email: u.email,
            displayName: u.displayName,
          },
        };
      });

    return [...overrideEvents, ...privilegeEvents];
  }, [requests, users, userNameMap]);

  const stats = React.useMemo(() => {
    const total = allEvents.length;
    const overrides = allEvents.filter((e) => e.type === "override").length;
    const privileges = allEvents.filter((e) => e.type === "privilege").length;
    return { total, overrides, privileges };
  }, [allEvents]);

  const filteredEvents = React.useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    const next = allEvents.filter((event) => {
      if (typeFilter !== "all" && event.type !== typeFilter) return false;

      const matchesTerm =
        !term ||
        event.actorLabel.toLowerCase().includes(term) ||
        event.title.toLowerCase().includes(term) ||
        event.description.toLowerCase().includes(term) ||
        (event.requestId || "").toLowerCase().includes(term) ||
        (event.targetUid || "").toLowerCase().includes(term);

      if (!matchesTerm) return false;

      if (from || to) {
        if (!event.occurredAt) return false;
        if (from && event.occurredAt < from) return false;
        if (to && event.occurredAt > to) return false;
      }

      return true;
    });

    return next.sort((a, b) => {
      const aVal = a.occurredAt ? a.occurredAt.getTime() : 0;
      const bVal = b.occurredAt ? b.occurredAt.getTime() : 0;
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [allEvents, debouncedSearch, typeFilter, fromDate, toDate, sortOrder]);

  const hasFilters =
    !!search.trim() || typeFilter !== "all" || !!fromDate || !!toDate || sortOrder !== "desc";

  const activeEvent = React.useMemo(
    () => filteredEvents.find((e) => e.id === activeEventId) ?? null,
    [filteredEvents, activeEventId]
  );

  const mobileEvents = React.useMemo(
    () => filteredEvents.slice(0, mobileVisibleCount),
    [filteredEvents, mobileVisibleCount]
  );

  const resetFilters = React.useCallback(() => {
    setSearch("");
    setTypeFilter("all");
    setFromDate("");
    setToDate("");
    setSortOrder("desc");
    setMobileVisibleCount(20);
  }, []);

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <LoadingOverlay show={loading} message="Loading super admin activity..." />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" />
          Super Admin Activity
        </h1>
        <p className="text-base-content/70">
          Track override decisions and privilege-state updates with searchable audit filters.
        </p>
      </div>

      <MobileStatsPager
        breakpoint="lg"
        items={[
          { label: "Total Events", value: stats.total },
          { label: "Overrides", value: stats.overrides, colorClass: "text-secondary" },
          { label: "Privilege Updates", value: stats.privileges, colorClass: "text-accent" },
        ]}
      />
      <div className="hidden lg:flex stats stats-horizontal shadow bg-base-200 w-full">
        <div className="stat">
          <div className="stat-title">Total Events</div>
          <div className="stat-value">{stats.total}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Overrides</div>
          <div className="stat-value text-secondary">{stats.overrides}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Privilege Updates</div>
          <div className="stat-value text-accent">{stats.privileges}</div>
          
        </div>
      </div>

      {/* Mobile: sticky header + chips + feed */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-10 -mx-3 px-3 pt-2 pb-3 bg-base-100/95 backdrop-blur border-b border-base-200 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-base-content/50 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                className="input input-bordered w-full pl-9"
                placeholder="Search activity…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsMobileFiltersOpen(true)}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {hasFilters ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {search.trim() ? (
                <Chip label={`Search: ${search.trim()}`} onRemove={() => setSearch("")} />
              ) : null}
              {typeFilter !== "all" ? (
                <Chip
                  label={typeFilter === "override" ? "Type: Override" : "Type: Privilege"}
                  onRemove={() => setTypeFilter("all")}
                />
              ) : null}
              {fromDate || toDate ? (
                <Chip
                  label={describeDateRange(fromDate, toDate)}
                  onRemove={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                />
              ) : null}
              {sortOrder !== "desc" ? (
                <Chip label="Sort: Oldest" onRemove={() => setSortOrder("desc")} />
              ) : null}
              <Chip label="Reset" onRemove={resetFilters} />
            </div>
          ) : (
            <div className="text-xs text-base-content/60 pt-1">No filters applied.</div>
          )}
        </div>

        {filteredEvents.length === 0 ? (
          <div className="card bg-base-100 border border-base-300 shadow text-center py-12 mt-3">
            <p className="font-medium">No activity found.</p>
            <p className="text-sm text-base-content/60">Try adjusting your filters or search term.</p>
            {hasFilters ? (
              <div className="pt-4">
                <button className="btn btn-outline" onClick={resetFilters}>
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 mt-3">
            {mobileEvents.map((event) => (
              <div
                key={event.id}
                role="button"
                tabIndex={0}
                className="card bg-base-100 border border-base-300 shadow hover:shadow-md transition cursor-pointer"
                onClick={() => setActiveEventId(event.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActiveEventId(event.id);
                }}
              >
                <div className="card-body p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-base-content/70" />
                        <div className="font-semibold truncate">{event.title}</div>
                      </div>
                      <div className="text-xs text-base-content/60 mt-0.5">
                        {formatOccurredAt(event.occurredAt)}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        event.type === "override" ? "badge-secondary" : "badge-accent"
                      }`}
                    >
                      {event.type === "override" ? "Override" : "Privilege"}
                    </span>
                  </div>

                  <div className="text-sm text-base-content/80 line-clamp-2">
                    {event.description}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70">
                    <span className="badge badge-ghost">{event.actorLabel}</span>
                    {event.requestId ? (
                      <span className="badge badge-outline font-mono">Req: {event.requestId}</span>
                    ) : null}
                    {event.targetUid && !event.requestId ? (
                      <span className="badge badge-outline font-mono">UID: {event.targetUid}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {mobileVisibleCount < filteredEvents.length ? (
              <div className="pt-2">
                <button
                  type="button"
                  className="btn btn-outline w-full"
                  onClick={() =>
                    setMobileVisibleCount((c) => Math.min(c + 20, filteredEvents.length))
                  }
                >
                  Load more
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="hidden lg:block card bg-base-200 shadow-xl">
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <label className="form-control lg:col-span-2">
              <div className="label">
                <span className="label-text flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Search
                </span>
              </div>
              <input
                type="text"
                className="input input-bordered"
                placeholder="Actor, request ID, title, description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text">Type</span>
              </div>
              <select
                className="select select-bordered"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | ActivityType)}
              >
                <option value="all">All types</option>
                <option value="override">Override</option>
                <option value="privilege">Privilege</option>
              </select>
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  From
                </span>
              </div>
              <input
                type="date"
                className="input input-bordered"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  To
                </span>
              </div>
              <input
                type="date"
                className="input input-bordered"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="form-control w-48">
              <div className="label py-0">
                <span className="label-text">Sort</span>
              </div>
              <select
                className="select select-bordered select-sm"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </label>

            {hasFilters && (
              <button className="btn btn-ghost btn-sm mt-6" onClick={resetFilters}>
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="hidden lg:block card bg-base-100 border border-base-300 shadow text-center py-12">
          <p className="font-medium">No activity matches your filters.</p>
          <p className="text-sm text-base-content/60">Try broadening the date range or search term.</p>
        </div>
      ) : (
        <div className="hidden lg:block card bg-base-100 border border-base-300 shadow">
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Actor</th>
                    <th>Details</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <span
                          className={`badge ${
                            event.type === "override" ? "badge-secondary" : "badge-accent"
                          }`}
                        >
                          {event.type === "override" ? "Override" : "Privilege"}
                        </span>
                      </td>
                      <td>
                        <div className="font-medium">{event.actorLabel}</div>
                        <div className="text-xs text-base-content/60 font-mono">
                          {event.actorUid || event.targetUid || "—"}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          {event.title}
                        </div>
                        <div className="text-sm text-base-content/70">{event.description}</div>
                        {event.requestId && (
                          <div className="text-xs text-base-content/60 font-mono">
                            Request: {event.requestId}
                          </div>
                        )}
                      </td>
                      <td>
                        {event.occurredAt ? event.occurredAt.toLocaleString() : "Unknown"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Mobile filter bottom-sheet */}
      {isMobileFiltersOpen ? (
        <div className="modal modal-open modal-bottom sm:modal-middle lg:hidden">
          <div className="modal-box w-11/12 max-w-lg p-0 overflow-hidden max-h-[85dvh]">
            <div className="sticky top-0 z-10 bg-base-100 border-b border-base-200 px-4 py-3 flex items-center justify-between gap-3">
              <div className="font-bold text-lg">Filters</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setIsMobileFiltersOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-4 py-4 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <div className="font-semibold text-sm">Date range</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      const today = new Date();
                      const ymd = toYmd(today);
                      setFromDate(ymd);
                      setToDate(ymd);
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(now);
                      start.setDate(now.getDate() - 7);
                      setFromDate(toYmd(start));
                      setToDate(toYmd(now));
                    }}
                  >
                    Last 7 days
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(now);
                      start.setDate(now.getDate() - 30);
                      setFromDate(toYmd(start));
                      setToDate(toYmd(now));
                    }}
                  >
                    Last 30 days
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                    }}
                  >
                    Clear dates
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="form-control">
                    <div className="label py-0">
                      <span className="label-text text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        From
                      </span>
                    </div>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </label>
                  <label className="form-control">
                    <div className="label py-0">
                      <span className="label-text text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        To
                      </span>
                    </div>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-sm">Type</div>
                <select
                  className="select select-bordered w-full"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "all" | ActivityType)}
                >
                  <option value="all">All types</option>
                  <option value="override">Override</option>
                  <option value="privilege">Privilege</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-sm">Sort</div>
                <select
                  className="select select-bordered w-full"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </div>
            </div>

            <div className="modal-action sticky bottom-0 bg-base-100 border-t border-base-200 px-4 py-3 flex items-center gap-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <button type="button" className="btn btn-ghost flex-1" onClick={resetFilters}>
                Clear all
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={() => setIsMobileFiltersOpen(false)}
              >
                Apply
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setIsMobileFiltersOpen(false)}>
            <button type="button">close</button>
          </div>
        </div>
      ) : null}

      {/* Mobile details bottom-sheet */}
      {activeEvent ? (
        <div className="modal modal-open modal-bottom sm:modal-middle lg:hidden">
          <div className="modal-box w-11/12 max-w-lg p-0 overflow-hidden max-h-[85dvh]">
            <div className="sticky top-0 z-10 bg-base-100 border-b border-base-200 px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`badge ${
                      activeEvent.type === "override" ? "badge-secondary" : "badge-accent"
                    }`}
                  >
                    {activeEvent.type === "override" ? "Override" : "Privilege"}
                  </span>
                  <div className="font-bold text-lg truncate">{activeEvent.title}</div>
                </div>
                <div className="text-xs text-base-content/60 mt-1">
                  {formatOccurredAt(activeEvent.occurredAt)}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setActiveEventId(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-4 py-4 space-y-4 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="space-y-2">
                <div className="font-semibold text-sm">Actor</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-ghost">{activeEvent.actorLabel}</span>
                  {activeEvent.actorUid ? (
                    <span className="badge badge-outline font-mono">{activeEvent.actorUid}</span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-sm">Details</div>
                <div className="text-sm text-base-content/80 whitespace-pre-wrap">
                  {activeEvent.description}
                </div>
                {activeEvent.requestId ? (
                  <div className="text-xs text-base-content/60 font-mono">
                    Request ID: {activeEvent.requestId}
                  </div>
                ) : null}
                {activeEvent.targetUid ? (
                  <div className="text-xs text-base-content/60 font-mono">
                    Target UID: {activeEvent.targetUid}
                  </div>
                ) : null}
              </div>

              {activeEvent.meta ? (
                <div className="card bg-base-200">
                  <div className="card-body p-4 space-y-2">
                    <div className="font-semibold text-sm">Metadata</div>
                    <div className="space-y-2">
                      {Object.entries(activeEvent.meta).map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-3">
                          <div className="text-xs text-base-content/60">{key}</div>
                          <div className="text-xs text-base-content/80 text-right break-all">
                            {value === undefined || value === null || value === "" ? "—" : String(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setActiveEventId(null)}>
            <button type="button">close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SuperAdminActivityLog;
