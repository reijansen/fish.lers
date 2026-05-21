import React from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import {
  Calendar,
  Clock,
  Filter,
  History as HistoryIcon,
  Layers,
  Package,
} from "lucide-react";
import LoadingOverlay from "../../components/LoadingOverlay";
import MobileStatsPager from "../../components/MobileStatsPager";
import { db } from "../../firebase";
import { formatDate, formatTime } from "../../utils/formatters";
import { logicEquipment } from "../equipment/logicEquipment";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

type RequestItem = {
  equipmentID: string;
  qty: number;
};

type AdminRequestRecord = {
  id: string;
  adviser?: string;
  purpose?: string;
  startDate?: string;
  endDate?: string;
  start?: string;
  end?: string;
  items?: RequestItem[];
  createdAt?: Date | null;
  createdAtClient?: string;
  status?: string;
  createdBy?: string;
  createdByName?: string;
  declinedRemarks?: string;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
  overriddenBy?: string;
  overriddenAt?: any;
  overrideReason?: string;
  overrideFromStatus?: string;
};

const getStatusBadgeClass = (status: string) => {
  const key = (status || "").toLowerCase();
  if (key === "approved") return "badge-success";
  if (key === "pending" || key === "ongoing" || key === "") return "badge-warning";
  if (key === "declined" || key === "rejected") return "badge-error";
  if (key === "cancelled") return "badge-info";
  if (key === "completed" || key === "returned") return "badge-primary";
  return "badge-outline";
};

// Aliases for the imported formatters to maintain existing code
const formatDateDisplay = (dateStr: string | undefined) => formatDate(dateStr);
const formatTimeDisplay = (timeStr: string | undefined) => formatTime(timeStr);

const formatUsageRange = (req: AdminRequestRecord) => {
  const startDate = req.startDate ? formatDateDisplay(req.startDate) : "";
  const endDate = req.endDate ? formatDateDisplay(req.endDate) : "";
  
  if (!startDate && !endDate) return "No schedule";
  if (startDate === endDate || !endDate) return startDate;
  return `${startDate} to ${endDate}`;
};

const formatRange = (req: AdminRequestRecord) => {
  const start = req.startDate ? `${req.startDate} ${req.start || ""}`.trim() : "";
  const end = req.endDate ? `${req.endDate} ${req.end || ""}`.trim() : "";
  if (!start && !end) return "No schedule provided";
  if (start && end) return `${start} to ${end}`;
  return start || end;
};

const formatScheduleDisplay = (req: AdminRequestRecord) => {
  if (!req.startDate) return "No schedule provided";
  
  const startDate = formatDateDisplay(req.startDate);
  const startTime = req.start ? formatTimeDisplay(req.start) : "";
  const endDate = req.endDate ? formatDateDisplay(req.endDate) : "";
  const endTime = req.end ? formatTimeDisplay(req.end) : "";
  
  let result = startDate;
  if (startTime) result += ` ${startTime}`;
  
  if (endDate && endDate !== startDate) {
    result += ` to ${endDate}`;
    if (endTime) result += ` ${endTime}`;
  } else if (endTime && endTime !== startTime) {
    result += ` to ${endTime}`;
  }
  
  return result;
};

const formatDateTime = (value: any) => {
  if (!value) return "";
  try {
    if (typeof value?.toDate === "function") return value.toDate().toLocaleString();
    if (value instanceof Date) return value.toLocaleString();
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
};

const formatStatusLabel = (value?: string) => {
  const normalized = (value || "").toString().trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const toMillis = (value: any) => {
  if (!value) return 0;
  try {
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    return new Date(value).getTime();
  } catch {
    return 0;
  }
};

const AdminRequestHistory: React.FC = () => {
  const location = useLocation();
  const [requests, setRequests] = React.useState<AdminRequestRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [yearFilter, setYearFilter] = React.useState<"all" | string>("all");
  const [quickFilter, setQuickFilter] = React.useState<"all" | "overridden" | "super-admin-actions" | "aged48">("all");
  const [sortOrder, setSortOrder] = React.useState<"desc" | "asc">("desc");
  const [selectedRequest, setSelectedRequest] = React.useState<AdminRequestRecord | null>(null);
  const [nameMap, setNameMap] = React.useState<Record<string, string>>({});
  const [superAdminMap, setSuperAdminMap] = React.useState<Record<string, boolean>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const { equipmentList, isLoading: isEquipmentLoading } = logicEquipment();
  const requestIdFromQuery = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("requestId") || "";
  }, [location.search]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get("status");
    const term = params.get("search");
    const year = params.get("year");
    const quick = params.get("quick");
    const sort = params.get("sort");

    if (status) setStatusFilter(status);
    if (term) setSearch(term);
    if (year) setYearFilter(year);
    if (quick === "overridden" || quick === "super-admin-actions" || quick === "aged48") {
      setQuickFilter(quick);
    }
    if (sort === "asc" || sort === "desc") setSortOrder(sort);
  }, [location.search]);

  React.useEffect(() => {
    const q = query(
      collection(db, "requests"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs: AdminRequestRecord[] = snapshot.docs.map((doc) => {
          const data = doc.data() as any;
          let createdAt: Date | null = null;
          try {
            if (data.createdAt && typeof data.createdAt.toDate === "function") {
              createdAt = data.createdAt.toDate();
            } else if (data.createdAt) {
              createdAt = new Date(data.createdAt);
            } else if (data.createdAtClient) {
              createdAt = new Date(data.createdAtClient);
            }
          } catch {
            createdAt = null;
          }
          // Prefer the actual requester (student) id fields. Some legacy documents may
          // have `createdBy` set to an admin actor, so keep it as a last-resort fallback.
          const requesterId =
            data.userID ||
            data.studentId ||
            data.studentID ||
            data.createdBy;

          return {
            id: doc.id,
            adviser: data.adviser,
            purpose: data.purpose,
            startDate: data.startDate,
            endDate: data.endDate,
            start: data.start,
            end: data.end,
            items: data.items || [],
            createdAt,
            createdAtClient: data.createdAtClient,
            status: data.status,
            createdBy: requesterId,
            createdByName: data.createdByName,
            declinedRemarks: data.declinedRemarks || data.remarks,
            approvedBy: data.approvedBy,
            approvedAt: data.approvedAt,
            rejectedBy: data.rejectedBy,
            rejectedAt: data.rejectedAt,
            overriddenBy: data.overriddenBy,
            overriddenAt: data.overriddenAt,
            overrideReason: data.overrideReason,
            overrideFromStatus: data.overrideFromStatus,
          };
        });
        setRequests(docs);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  React.useEffect(() => {
    const getRequesterId = (req: any): string | undefined =>
      req?.studentUid ||
      req?.studentUID ||
      req?.userID ||
      req?.studentId ||
      req?.studentID ||
      req?.createdBy ||
      undefined;

  const missing = Array.from(
    new Set(
      requests
        .flatMap((req) => [
          getRequesterId(req),
          req.approvedBy,
          req.rejectedBy,
          req.overriddenBy,
        ])
        .filter((uid): uid is string => !!uid && !nameMap[uid])
    )
  );

    if (!missing.length) return;

    missing.forEach(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setNameMap((prev) => ({
            ...prev,
            [uid]: data.displayName || data.email || uid,
          }));
          setSuperAdminMap((prev) => ({
            ...prev,
            [uid]: !!data.isSuperAdmin,
          }));
        }
      } catch (e) {
        console.warn("Failed to fetch user profile", e);
      }
    });
  }, [requests, nameMap]);

  const years = React.useMemo(() => {
    const set = new Set<string>();
    requests.forEach((req) => {
      if (req.createdAt) {
        set.add(req.createdAt.getFullYear().toString());
      }
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [requests]);

  const stats = React.useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((req) =>
      ["pending", "ongoing", ""].includes((req.status || "").toLowerCase())
    ).length;
    const approved = requests.filter(
      (req) => (req.status || "").toLowerCase() === "approved"
    ).length;
    const declined = requests.filter((req) =>
      ["declined", "rejected"].includes((req.status || "").toLowerCase())
    ).length;
    const cancelled = requests.filter(
      (req) => (req.status || "").toLowerCase() === "cancelled"
    ).length;
    return { total, pending, approved, declined, cancelled };
  }, [requests]);
  
  const getRequester = (req: AdminRequestRecord) => {
    if (
      req.createdBy &&
      nameMap[req.createdBy]
    ) {
      return nameMap[req.createdBy];
    }

    // Fallback to whatever was stored on the request doc (may be legacy/migrated).
    if (
      req.createdByName &&
      req.createdByName.trim() !== ""
    ) {
      return req.createdByName;
    }

    return req.createdBy || "Unknown Requester";
  };

  const getActorName = (uid?: string) => {
    if (!uid) return "System";
    return nameMap[uid] || uid;
  };

  const OverrideBadge: React.FC<{ compact?: boolean }> = ({ compact }) => (
    <span
      className={`badge badge-secondary whitespace-nowrap ${
        compact ? "badge-sm px-2 text-[10px]" : ""
      }`}
    >
      super admin
    </span>
  );

  const timelineEvents = React.useMemo(() => {
    if (!selectedRequest) return [];
    const events: Array<{
      key: string;
      label: string;
      badgeClass: string;
      actor: string;
      at: any;
      reason?: string;
    }> = [];

    if (selectedRequest.approvedAt) {
      events.push({
        key: "approved",
        label: "Approved",
        badgeClass: "badge-success",
        actor: getActorName(selectedRequest.approvedBy),
        at: selectedRequest.approvedAt,
      });
    }

    if (selectedRequest.rejectedAt || selectedRequest.status?.toLowerCase() === "declined" || selectedRequest.status?.toLowerCase() === "rejected") {
      events.push({
        key: "rejected",
        label: "Rejected",
        badgeClass: "badge-error",
        actor: getActorName(selectedRequest.rejectedBy),
        at: selectedRequest.rejectedAt,
        reason: selectedRequest.declinedRemarks || undefined,
      });
    }

    if (selectedRequest.overriddenAt || selectedRequest.overriddenBy || selectedRequest.overrideReason) {
      events.push({
        key: "overridden",
        label: "Overridden",
        badgeClass: "badge-secondary",
        actor: getActorName(selectedRequest.overriddenBy),
        at: selectedRequest.overriddenAt,
        reason: selectedRequest.overrideReason || undefined,
      });
    }

    return events.sort((a, b) => toMillis(b.at) - toMillis(a.at));
  }, [selectedRequest, nameMap]);

  const filtered = React.useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const hasOverride = (req: AdminRequestRecord) =>
      !!req.overriddenAt || !!req.overriddenBy || !!req.overrideReason;
    const isSuperAdminActor = (uid?: string) => !!uid && !!superAdminMap[uid];
    const isAged48 = (req: AdminRequestRecord) => {
      const statusKey = (req.status || "").toLowerCase();
      if (statusKey !== "pending" && statusKey !== "" && statusKey !== "ongoing") return false;
      const createdMs = toMillis(req.createdAt || req.createdAtClient);
      if (!createdMs) return false;
      return Date.now() - createdMs >= 48 * 3600000;
    };
    const list = requests.filter((req) => {
      const statusKey = (req.status || "").toLowerCase();
      const statusMatch = statusFilter === "all" || statusKey === statusFilter;
      const requester = getRequester(req).toLowerCase();
      const yearMatch =
        yearFilter === "all" ||
        (req.createdAt && req.createdAt.getFullYear().toString() === yearFilter);
      const matchesSearch =
        !term ||
        requester.includes(term) ||
        (req.purpose || "").toLowerCase().includes(term) ||
        (req.id || "").toLowerCase().includes(term);
      const quickFilterMatch =
        quickFilter === "all"
          ? true
          : quickFilter === "overridden"
          ? hasOverride(req)
          : quickFilter === "aged48"
          ? isAged48(req)
          : hasOverride(req) ||
            isSuperAdminActor(req.approvedBy) ||
            isSuperAdminActor(req.rejectedBy) ||
            isSuperAdminActor(req.overriddenBy);
      return statusMatch && yearMatch && matchesSearch && quickFilterMatch;
    });

    const getSortValue = (req: AdminRequestRecord) => {
      if (req.createdAt) return req.createdAt.getTime();
      if (req.createdAtClient) return new Date(req.createdAtClient).getTime();
      return 0;
    };

    return list.sort((a, b) => {
      const diff = getSortValue(a) - getSortValue(b);
      return sortOrder === "asc" ? diff : -diff;
    });
  }, [requests, debouncedSearch, statusFilter, yearFilter, sortOrder, nameMap, quickFilter, superAdminMap]);

  React.useEffect(() => {
    if (!requestIdFromQuery) return;
    const match = filtered.find((r) => r.id === requestIdFromQuery);
    if (match) setSelectedRequest(match);
  }, [requestIdFromQuery, filtered]);

  const grouped = React.useMemo(() => {
    const buckets: Record<string, AdminRequestRecord[]> = {};
    filtered.forEach((req) => {
      const date =
        req.createdAt ||
        (req.createdAtClient ? new Date(req.createdAtClient) : null);
      const key = date
        ? `${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`
        : "Undated";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(req);
    });
    return Object.entries(buckets);
  }, [filtered]);

  const activeFilters =
    search.trim().length > 0 || statusFilter !== "all" || yearFilter !== "all" || quickFilter !== "all";

  const filterChips = React.useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (search.trim()) chips.push({ key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") });
    if (statusFilter !== "all")
      chips.push({
        key: "status",
        label: `Status: ${formatStatusLabel(statusFilter)}`,
        onRemove: () => setStatusFilter("all"),
      });
    if (yearFilter !== "all")
      chips.push({
        key: "year",
        label: `Year: ${yearFilter}`,
        onRemove: () => setYearFilter("all"),
      });
    if (quickFilter !== "all")
      chips.push({
        key: "quick",
        label:
          quickFilter === "overridden"
            ? "Quick: Overridden"
            : quickFilter === "aged48"
            ? "Quick: Pending 48h+"
            : "Quick: Super Admin actions",
        onRemove: () => setQuickFilter("all"),
      });
    return chips;
  }, [search, statusFilter, yearFilter, quickFilter]);

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <LoadingOverlay
        show={loading || isEquipmentLoading}
        message="Loading full request history..."
      />

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HistoryIcon className="w-6 h-6" />
            Request History
          </h1>
          <p className="text-base-content/70">
            Audit every student request with filters for quick investigations.
          </p>
        </div>
      </div>

      <MobileStatsPager
        breakpoint="lg"
        items={[
          { label: "Total", value: stats.total },
          { label: "Pending/Ongoing", value: stats.pending, colorClass: "text-warning" },
          { label: "Approved", value: stats.approved, colorClass: "text-success" },
          { label: "Declined", value: stats.declined, colorClass: "text-error" },
          { label: "Cancelled", value: stats.cancelled, colorClass: "text-info" },
        ]}
      />
      <div className="hidden lg:flex stats stats-horizontal shadow bg-base-200 w-full">
        <div className="stat">
          <div className="stat-title">Total Requests</div>
          <div className="stat-value">{stats.total}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Pending / Ongoing</div>
          <div className="stat-value text-warning">{stats.pending}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Approved</div>
          <div className="stat-value text-success">{stats.approved}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Declined</div>
          <div className="stat-value text-error">{stats.declined}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Cancelled</div>
          <div className="stat-value text-info">{stats.cancelled}</div>
          
        </div>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body space-y-4">
          {/* Desktop filters */}
          <div className="hidden lg:grid grid-cols-5 gap-4">
            <label className="form-control">
              <div className="label">
                <span className="label-text flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Search
                </span>
              </div>
              <input
                type="text"
                className="input input-bordered"
                placeholder="Search by requester, purpose, or ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Status
                </span>
              </div>
              <select
                className="select select-bordered"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | string)}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="ongoing">Ongoing</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
                <option value="returned">Returned</option>
              </select>
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Year
                </span>
              </div>
              <select
                className="select select-bordered"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value as "all" | string)}
              >
                <option value="all">All years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text">Sort</span>
              </div>
              <select
                className="select select-bordered"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text">View</span>
              </div>
              <select
                className="select select-bordered"
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value as "all" | "overridden" | "super-admin-actions" | "aged48")}
              >
                <option value="all">Show all requests</option>
                <option value="overridden">Only overridden requests</option>
                <option value="super-admin-actions">Only super-admin actions</option>
                <option value="aged48">Pending over 48 hours</option>
              </select>
            </label>
          </div>

          {/* Mobile filters */}
          <div className="lg:hidden space-y-3">
            <div className="flex items-end gap-2">
              <label className="form-control flex-1">
                <div className="label py-1">
                  <span className="label-text text-sm font-medium flex items-center gap-2">
                    <Filter className="w-4 h-4" /> Search
                  </span>
                </div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Requester, purpose, or ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary gap-2 h-11"
                onClick={() => setMobileFiltersOpen(true)}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {filterChips.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="badge badge-outline gap-2 py-3 px-3"
                    onClick={chip.onRemove}
                    title="Remove filter"
                  >
                    <span className="truncate max-w-[14rem]">{chip.label}</span>
                    <span className="font-bold">×</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-base-content/60">No filters applied</div>
            )}
          </div>

          <div className="hidden lg:flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 items-center">
              {activeFilters ? (
                <>
                  <span className="badge badge-lg badge-primary gap-1">
                    <span className="font-semibold">{filtered.length}</span> result{filtered.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm gap-1"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setYearFilter("all");
                      setQuickFilter("all");
                      setSortOrder("desc");
                    }}
                  >
                    ✕ Reset
                  </button>
                </>
              ) : (
                <span className="text-sm text-base-content/60">No filters applied</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile filter modal */}
      {mobileFiltersOpen && (
        <div
          className="modal modal-open modal-bottom sm:modal-middle"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileFiltersOpen(false);
          }}
        >
          <div className="modal-box w-full max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
              onClick={() => setMobileFiltersOpen(false)}
            >
              ✕
            </button>
            <h3 className="text-lg font-bold mb-3">Filters</h3>
            <div className="space-y-3">
              <label className="form-control w-full">
                <div className="label py-1">
                  <span className="label-text text-sm font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Status
                  </span>
                </div>
                <select
                  className="select select-bordered"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | string)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                  <option value="returned">Returned</option>
                </select>
              </label>

              <label className="form-control w-full">
                <div className="label py-1">
                  <span className="label-text text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Year
                  </span>
                </div>
                <select
                  className="select select-bordered"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value as "all" | string)}
                >
                  <option value="all">All years</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control w-full">
                <div className="label py-1">
                  <span className="label-text text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Sort
                  </span>
                </div>
                <select
                  className="select select-bordered"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </label>

              <label className="form-control w-full">
                <div className="label py-1">
                  <span className="label-text text-sm font-medium flex items-center gap-2">
                    <Filter className="w-4 h-4" /> View
                  </span>
                </div>
                <select
                  className="select select-bordered"
                  value={quickFilter}
                  onChange={(e) => setQuickFilter(e.target.value as any)}
                >
                  <option value="all">Show all requests</option>
                  <option value="overridden">Only overridden requests</option>
                  <option value="super-admin-actions">Only super-admin actions</option>
                  <option value="aged48">Pending over 48 hours</option>
                </select>
              </label>
            </div>
            <div className="modal-action sticky bottom-0 bg-base-100 pt-3">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setYearFilter("all");
                  setQuickFilter("all");
                  setSortOrder("desc");
                }}
              >
                Reset
              </button>
              <button className="btn btn-primary" onClick={() => setMobileFiltersOpen(false)}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="card bg-base-100 shadow text-center py-12">
          <p className="font-medium">No history matches your filters.</p>
          <p className="text-sm text-base-content/60">
            Adjust filters above to see archived requests.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([bucket, entries]) => (
            <div key={bucket} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{bucket}</h2>
                <span className="badge badge-outline">{entries.length}</span>
              </div>
              <div className="card bg-base-100 border border-base-300 shadow">
                <div className="card-body p-0">
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="table w-full min-w-[720px]">
                      <thead>
                        <tr>
                          <th className="w-[32%]">Request</th>
                          <th className="w-[22%]">Requester</th>
                          <th className="w-[20%]">Date of Usage</th>
                          <th className="w-[14%]">Items</th>
                          <th className="w-[12%]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((req) => {
                          const requester = getRequester(req);
                          const itemCount =
                            req.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
                          const itemsList = (req.items || [])
                            .map((it) => `${equipmentList.find((eq) => eq.equipmentID === it.equipmentID)?.name || it.equipmentID || 'Unknown'}: ${it.qty || 0}`)
                            .join(', ');
                          const submittedOn = req.createdAt
                            ? req.createdAt.toLocaleString()
                            : req.createdAtClient || "—";
                          return (
                            <tr
                              key={req.id}
                              className="hover:bg-primary/10 cursor-pointer transition-colors"
                              onClick={() => setSelectedRequest(req)}
                            >
                              <td>
                                <div className="font-semibold">{req.purpose || "Untitled Request"}</div>
                                <div className="text-xs text-base-content/60">
                                  Submitted {submittedOn}
                                </div>
                                <div className="text-xs text-base-content/60 font-mono">
                                  ID: {req.id}
                                </div>
                              </td>
                              <td>
                                <div className="font-semibold">{requester}</div>
                                <div className="text-xs text-base-content/60">
                                  Adviser: {req.adviser || "Not provided"}
                                </div>
                              </td>
                              <td>
                                <div className="text-sm space-y-0.5">
                                  <div className="font-medium">{req.startDate ? formatDateDisplay(req.startDate) : "No schedule"}</div>
                                  {req.endDate && (
                                    <div className="text-xs text-base-content/60">to {formatDateDisplay(req.endDate)}</div>
                                  )}
                                </div>
                              </td>
                              <td>
                                {itemsList ? (
                                  <div className="tooltip" data-tip={itemsList}>
                                    <div className="flex items-center gap-2">
                                      <Package className="w-4 h-4" />
                                      {itemCount} items
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    {itemCount} items
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`badge ${getStatusBadgeClass(req.status || "")}`}>
                                    {req.status || "Pending"}
                                  </span>
                                  {(req.overriddenAt || req.overriddenBy) && (
                                    <OverrideBadge compact />
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="lg:hidden p-3 space-y-2">
                    {entries.map((req) => {
                      const requester = getRequester(req);
                      const itemCount =
                        req.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
                      const submittedOn = req.createdAt
                        ? req.createdAt.toLocaleDateString()
                        : req.createdAtClient
                        ? new Date(req.createdAtClient).toLocaleDateString()
                        : "â€”";
                      const usageRange = formatUsageRange(req);
                      const statusKey = (req.status || "pending").toLowerCase();
                      const isOngoing = statusKey === "ongoing";

                      return (
                        <div
                          key={req.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedRequest(req)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setSelectedRequest(req);
                          }}
                          className="card bg-base-100 border border-base-300 shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
                        >
                          <div className="card-body p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold truncate">
                                  {req.purpose || "Untitled Request"}
                                </div>
                                <div className="text-xs text-base-content/60 truncate">
                                  {requester}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className={`badge ${getStatusBadgeClass(req.status || "")}`}>
                                  {formatStatusLabel(req.status || "pending")}
                                </span>
                                <span className="text-[11px] text-base-content/60 whitespace-nowrap">
                                  {submittedOn}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70">
                              <span className="badge badge-outline">{usageRange}</span>
                              <span className="badge badge-ghost">{itemCount} items</span>
                              {isOngoing && <span className="badge badge-success">Ongoing</span>}
                              {(req.overriddenAt || req.overriddenBy) && (
                                <OverrideBadge compact />
                              )}
                            </div>

                            <div className="text-[11px] text-base-content/50 font-mono truncate">
                              ID: {req.id}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRequest && (
        <div
          className="modal modal-open modal-bottom sm:modal-middle"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRequest(null);
          }}
        >
          <div className="modal-box w-full max-w-3xl max-h-[90dvh] overflow-y-auto">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4"
              onClick={() => setSelectedRequest(null)}
            >
              ✕
            </button>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-base-content/60">
                  Request Purpose
                </p>
                <h3 className="text-2xl font-bold break-words">
                  {selectedRequest.purpose || "Untitled Request"}
                </h3>
                <p className="text-sm text-base-content/70">
                  {getRequester(selectedRequest)} •{" "}
                  {selectedRequest.createdAt
                    ? selectedRequest.createdAt.toLocaleString()
                    : selectedRequest.createdAtClient || "—"}
                </p>
                <p className="text-xs text-base-content/60 font-mono mt-1">
                  ID: {selectedRequest.id}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-base-200 rounded-lg p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Purpose
                  </p>
                  <p className="font-semibold">
                    {selectedRequest.purpose || "No purpose provided"}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Adviser
                  </p>
                  <p>{selectedRequest.adviser || "Not provided"}</p>
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Schedule
                  </p>
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {selectedRequest.startDate
                        ? `${formatDateDisplay(selectedRequest.startDate)}${selectedRequest.start ? ` ${formatTimeDisplay(selectedRequest.start)}` : ""}`
                        : "No schedule provided"}
                    </div>
                    {selectedRequest.endDate && selectedRequest.startDate !== selectedRequest.endDate && (
                      <div className="text-sm text-base-content/70">
                        to {formatDateDisplay(selectedRequest.endDate)}{selectedRequest.end ? ` ${formatTimeDisplay(selectedRequest.end)}` : ""}
                      </div>
                    )}
                    {selectedRequest.endDate === selectedRequest.startDate && selectedRequest.end && selectedRequest.start !== selectedRequest.end && (
                      <div className="text-sm text-base-content/70">
                        to {formatTimeDisplay(selectedRequest.end)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-base-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Status
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${getStatusBadgeClass(selectedRequest.status || "")}`}>
                      {selectedRequest.status || "Pending"}
                    </span>
                    {(selectedRequest.overriddenAt || selectedRequest.overriddenBy) && (
                      <OverrideBadge />
                    )}
                  </div>
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Remarks
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {selectedRequest.declinedRemarks || "N/A"}
                  </p>
                  {(selectedRequest.overriddenAt ||
                    selectedRequest.overriddenBy ||
                    selectedRequest.overrideReason) && (
                    <>
                      <p className="text-xs uppercase tracking-wide text-base-content/60">
                        Override Audit
                      </p>
                      <div className="rounded border border-base-300 bg-base-100 p-3 space-y-2 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <span className="badge badge-secondary badge-sm">Super Admin</span>
                          {(selectedRequest.overrideFromStatus || selectedRequest.status) && (
                            <span className="badge badge-outline badge-sm">
                              {formatStatusLabel(selectedRequest.overrideFromStatus)} to{" "}
                              {formatStatusLabel(selectedRequest.status)}
                            </span>
                          )}
                        </div>
                        <p>
                          <span className="font-medium">Overridden by:</span>{" "}
                          {selectedRequest.overriddenBy || "N/A"}
                        </p>
                        <p>
                          <span className="font-medium">Overridden at:</span>{" "}
                          {formatDateTime(selectedRequest.overriddenAt) || "N/A"}
                        </p>
                        <p className="whitespace-pre-wrap">
                          <span className="font-medium">Reason:</span>{" "}
                          {selectedRequest.overrideReason || "N/A"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="bg-base-200 rounded-lg p-4 space-y-3">
                <p className="text-xs uppercase tracking-wide text-base-content/60">
                  Decision Timeline
                </p>
                {timelineEvents.length === 0 ? (
                  <p className="text-sm text-base-content/70">
                    No approval, rejection, or override events recorded.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {timelineEvents.map((event) => (
                      <div
                        key={`${selectedRequest.id}-${event.key}`}
                        className="rounded border border-base-300 bg-base-100 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`badge ${event.badgeClass}`}>{event.label}</span>
                          <span className="text-xs text-base-content/60">
                            {formatDateTime(event.at) || "Time not available"}
                          </span>
                        </div>
                        <p className="text-sm mt-1">
                          <span className="font-medium">Actor:</span> {event.actor}
                        </p>
                        {event.reason && (
                          <p className="text-sm whitespace-pre-wrap">
                            <span className="font-medium">Reason:</span> {event.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-base-content/60 mb-2">
                  Items requested
                </p>
                {selectedRequest.items && selectedRequest.items.length > 0 ? (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="table min-w-[720px]">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRequest.items.map((item) => {
                            const equipment = equipmentList.find(
                              (eq) => eq.equipmentID === item.equipmentID
                            );
                            return (
                              <tr key={item.equipmentID}>
                                <td>{equipment?.name || item.equipmentID}</td>
                                <td>{item.qty || 0}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden space-y-2">
                      {selectedRequest.items.map((item) => {
                        const equipment = equipmentList.find(
                          (eq) => eq.equipmentID === item.equipmentID
                        );
                        const name = equipment?.name || item.equipmentID;
                        return (
                          <div
                            key={item.equipmentID}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-base-200"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{name}</div>
                              <div className="text-[11px] text-base-content/60 font-mono truncate">
                                {item.equipmentID}
                              </div>
                            </div>
                            <div className="badge badge-ghost">Qty: {item.qty || 0}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-base-content/70">
                    No items recorded for this request.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setSelectedRequest(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRequestHistory;

