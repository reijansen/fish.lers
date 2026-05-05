import React from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  Activity,
  AlertCircle,
  BarChart3,
  ClipboardList,
  Clock,
  Download,
  Filter,
  Flame,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { db } from "../../firebase";
import AnalyticsSection from "../../components/analytics/AnalyticsSection";
import KpiCard from "../../components/analytics/KpiCard";
import StatusPill from "../../components/analytics/StatusPill";
import LineChart from "../../components/analytics/charts/LineChart";
import StackedBars from "../../components/analytics/charts/StackedBars";
import Heatmap from "../../components/analytics/charts/Heatmap";
import RankedBarList from "../../components/analytics/RankedBarList";
import { downloadCsv } from "../../features/analytics/exportCsv";
import type {
  AnalyticsEquipment,
  AnalyticsRequest,
  AnalyticsUser,
  TimeGranularity,
} from "../../features/analytics/analyticsTypes";
import { clampDateRange, formatDateTime, formatDuration, resolveDate, startOfDay, endOfDay } from "../../features/analytics/dateUtils";
import {
  buildUserLabelMap,
  computeApprovalMetrics,
  computeCategoryDemand,
  computeDisposableReusableTrend,
  computeEquipmentDemand,
  computeEquipmentUtilizationRate,
  computeHeatmap,
  computePendingAging,
  computeRequestsByRole,
  computeRequestsSeries,
  computeStatusStackedSeries,
  computeTopRequesters,
  filterRequests,
  normalizeStatus,
  resolveRequesterLabel,
} from "../../features/analytics/analyticsSelectors";
import { normalizeRequestItems } from "../../features/analytics/normalize";
import { buildInsights } from "../../features/analytics/analyticsInsights";

type DatePreset = "7d" | "30d" | "90d" | "custom";

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computePrevRange(from: Date, to: Date) {
  const a = startOfDay(from).getTime();
  const b = endOfDay(to).getTime();
  const span = Math.max(1, b - a);
  const prevTo = new Date(a - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return clampDateRange(prevFrom, prevTo);
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function computeAvgItemsPerRequest(requests: AnalyticsRequest[]) {
  if (!requests.length) return 0;
  const totalQty = requests.reduce((sum, r) => {
    const items = normalizeRequestItems(r.items);
    return sum + items.reduce((inner, it) => inner + (it.qty || 0), 0);
  }, 0);
  return totalQty / requests.length;
}

function computeConflicts(requests: AnalyticsRequest[]) {
  // Simple indicator: overlapping approved/ongoing schedules for same equipmentID.
  // If schedule data is missing, we gracefully return 0.
  type Reservation = { equipmentID: string; startMs: number; endMs: number; requestId: string };
  const reservations: Reservation[] = [];

  for (const r of requests) {
    const status = normalizeStatus(r.status as any);
    if (!(status === "approved" || status === "ongoing")) continue;
    if (!r.startDate || !r.endDate) continue;
    const startMs = new Date(`${r.startDate}T00:00:00`).getTime();
    const endMs = new Date(`${r.endDate}T23:59:59`).getTime();
    if (!startMs || !endMs || Number.isNaN(startMs) || Number.isNaN(endMs)) continue;

    for (const it of normalizeRequestItems(r.items)) {
      if (!it.equipmentID) continue;
      reservations.push({ equipmentID: it.equipmentID, startMs, endMs, requestId: r.id });
    }
  }

  const byEquipment: Record<string, Reservation[]> = {};
  for (const res of reservations) {
    (byEquipment[res.equipmentID] ||= []).push(res);
  }

  let conflicts = 0;
  for (const eqId of Object.keys(byEquipment)) {
    const list = byEquipment[eqId].sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      if (curr.startMs <= prev.endMs) conflicts += 1;
    }
  }
  return conflicts;
}

export default function Analytics() {
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [requests, setRequests] = React.useState<AnalyticsRequest[]>([]);
  const [equipment, setEquipment] = React.useState<AnalyticsEquipment[]>([]);
  const [users, setUsers] = React.useState<AnalyticsUser[]>([]);

  const [datePreset, setDatePreset] = React.useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");

  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<"all" | string>("all");
  const [userTypeFilter, setUserTypeFilter] = React.useState<"all" | "student" | "admin" | string>("all");
  const [granularity, setGranularity] = React.useState<TimeGranularity>("daily");

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    let cancelled = false;

    const requestsQ = query(collection(db, "requests"), orderBy("createdAt", "desc"), limit(1000));
    const unsub = onSnapshot(
      requestsQ,
      (snap) => {
        if (cancelled) return;
        setRequests(
          snap.docs.map((doc) => {
            const data: any = doc.data();
            return {
              id: doc.id,
              status: data.status || "unknown",
              createdAt: data.createdAt,
              createdAtClient: data.createdAtClient,
              createdBy: data.createdBy || data.userID || data.userId || "",
              userID: data.userID || data.userId || data.createdBy || "",
              purpose: data.purpose || "",
              adviser: data.adviser || "",
              startDate: data.startDate,
              endDate: data.endDate,
              approvedBy: data.approvedBy,
              approvedAt: data.approvedAt,
              rejectedBy: data.rejectedBy,
              rejectedAt: data.rejectedAt,
              returnedAt: data.returnedAt,
              cancelledAt: data.cancelledAt,
              items: data.items || [],
            } as AnalyticsRequest;
          })
        );
      },
      (err) => {
        console.error("Analytics requests listener failed", err);
        if (!cancelled) setError(err?.message || "Failed to load requests.");
      }
    );

    (async () => {
      try {
        const [equipmentSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "equipment")),
          getDocs(collection(db, "users")),
        ]);

        if (cancelled) return;

        setEquipment(
          equipmentSnap.docs.map((doc) => {
            const data: any = doc.data();
            return {
              equipmentID: doc.id,
              name: data.name || doc.id,
              totalInventory: data.totalInventory || 0,
              category: data.category || "Uncategorized",
              isDisposable: !!data.isDisposable,
            } as AnalyticsEquipment;
          })
        );

        setUsers(
          usersSnap.docs.map((doc) => {
            const data: any = doc.data();
            return {
              uid: doc.id,
              role: data.role || "student",
              displayName: data.displayName || "",
              email: data.email || "",
              department: data.department || data.dept || "",
              course: data.course || "",
              section: data.section || data.labSection || "",
              isActive: typeof data.isActive === "boolean" ? data.isActive : true,
            } as AnalyticsUser;
          })
        );
      } catch (err: any) {
        console.error("Analytics equipment/users load failed", err);
        if (!cancelled) setError(err?.message || "Failed to load analytics data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const equipmentById = React.useMemo(() => {
    const map: Record<string, AnalyticsEquipment> = {};
    for (const e of equipment) map[e.equipmentID] = e;
    return map;
  }, [equipment]);

  const usersById = React.useMemo(() => {
    const map: Record<string, AnalyticsUser> = {};
    for (const u of users) map[u.uid] = u;
    return map;
  }, [users]);

  const userLabelMap = React.useMemo(() => buildUserLabelMap(users), [users]);

  const categoryOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of equipment) set.add((e.category || "Uncategorized").trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [equipment]);

  const computedRange = React.useMemo(() => {
    const now = new Date();
    if (datePreset === "7d") return clampDateRange(new Date(now.getTime() - 7 * 86400000), now);
    if (datePreset === "90d") return clampDateRange(new Date(now.getTime() - 90 * 86400000), now);
    if (datePreset === "custom") {
      const from = parseDateInput(customFrom) || new Date(now.getTime() - 30 * 86400000);
      const to = parseDateInput(customTo) || now;
      return clampDateRange(from, to);
    }
    return clampDateRange(new Date(now.getTime() - 30 * 86400000), now);
  }, [datePreset, customFrom, customTo]);

  const filters = React.useMemo(
    () => ({
      dateFrom: computedRange.from,
      dateTo: computedRange.to,
      status: statusFilter,
      equipmentCategory: categoryFilter,
      userType: userTypeFilter,
    }),
    [computedRange, statusFilter, categoryFilter, userTypeFilter]
  );

  const filteredRequests = React.useMemo(
    () => filterRequests(requests, usersById, equipmentById, filters),
    [requests, usersById, equipmentById, filters]
  );

  const prevRange = React.useMemo(() => computePrevRange(filters.dateFrom, filters.dateTo), [filters.dateFrom, filters.dateTo]);
  const prevRequests = React.useMemo(() => {
    const prevFilters = { ...filters, dateFrom: prevRange.from, dateTo: prevRange.to };
    return filterRequests(requests, usersById, equipmentById, prevFilters);
  }, [filters, prevRange, requests, usersById, equipmentById]);

  const requestGrowthPct = React.useMemo(() => {
    if (!prevRequests.length) return null;
    return Math.round(((filteredRequests.length - prevRequests.length) / prevRequests.length) * 100);
  }, [filteredRequests.length, prevRequests.length]);

  const totals = React.useMemo<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    ongoing: number;
    returned: number;
    cancelled: number;
  }>(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, ongoing: 0, returned: 0, cancelled: 0 };
    for (const r of filteredRequests) {
      const s = normalizeStatus(r.status as any);
      if (s in counts) counts[s as keyof typeof counts] += 1;
    }
    return {
      total: filteredRequests.length,
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      ongoing: counts.ongoing,
      returned: counts.returned,
      cancelled: counts.cancelled,
    };
  }, [filteredRequests]);

  const approval = React.useMemo(() => computeApprovalMetrics(filteredRequests), [filteredRequests]);
  const pendingAging = React.useMemo(() => computePendingAging(filteredRequests), [filteredRequests]);
  const avgItemsPerRequest = React.useMemo(() => computeAvgItemsPerRequest(filteredRequests), [filteredRequests]);
  const utilization = React.useMemo(() => computeEquipmentUtilizationRate(filteredRequests, equipmentById), [filteredRequests, equipmentById]);

  const requestSeries = React.useMemo(() => computeRequestsSeries(filteredRequests, granularity).slice(-18), [filteredRequests, granularity]);
  const stackedStatuses = React.useMemo(() => {
    const statuses = ["pending", "approved", "rejected", "ongoing", "returned", "cancelled"];
    return computeStatusStackedSeries(filteredRequests, granularity, statuses).slice(-12);
  }, [filteredRequests, granularity]);

  const heatmap = React.useMemo(() => computeHeatmap(filteredRequests), [filteredRequests]);

  const equipmentDemand = React.useMemo(() => computeEquipmentDemand(filteredRequests, equipmentById), [filteredRequests, equipmentById]);
  const demandByCategory = React.useMemo(() => computeCategoryDemand(equipmentDemand), [equipmentDemand]);
  const disposableTrend = React.useMemo(
    () => computeDisposableReusableTrend(filteredRequests, granularity, equipmentById).slice(-12),
    [filteredRequests, granularity, equipmentById]
  );

  const topRequesters = React.useMemo(() => computeTopRequesters(filteredRequests).slice(0, 8), [filteredRequests]);
  const requestsByRole = React.useMemo(() => computeRequestsByRole(filteredRequests, usersById), [filteredRequests, usersById]);
  const activeUserStats = React.useMemo(() => {
    const active = new Set<string>();
    for (const r of filteredRequests) {
      const uid = r.createdBy || r.userID || "";
      if (uid) active.add(uid);
    }
    const pool = userTypeFilter === "all" ? users : users.filter((u) => (u.role || "student") === userTypeFilter);
    const totalInPool = pool.length;
    const activeInPool = pool.reduce((sum, u) => sum + (active.has(u.uid) ? 1 : 0), 0);
    const inactiveInPool = Math.max(0, totalInPool - activeInPool);
    return { totalInPool, activeInPool, inactiveInPool };
  }, [filteredRequests, users, userTypeFilter]);
  const cancellationFlags = React.useMemo(() => {
    const byUser: Record<string, number> = {};
    for (const r of filteredRequests) {
      const s = normalizeStatus(r.status as any);
      if (s !== "cancelled") continue;
      const uid = r.createdBy || r.userID || "";
      if (!uid) continue;
      byUser[uid] = (byUser[uid] || 0) + 1;
    }
    return Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredRequests]);

  const demandMix = React.useMemo(() => {
    let disposableQty = 0;
    let reusableQty = 0;
    for (const r of filteredRequests) {
      const status = normalizeStatus(r.status as any);
      if (status === "cancelled") continue;
      for (const it of normalizeRequestItems(r.items)) {
        if (!it.equipmentID) continue;
        const eq = equipmentById[it.equipmentID];
        if (eq?.isDisposable) disposableQty += it.qty || 0;
        else reusableQty += it.qty || 0;
      }
    }
    const total = disposableQty + reusableQty;
    const disposablePct = total ? Math.round((disposableQty / total) * 100) : 0;
    return { disposableQty, reusableQty, total, disposablePct };
  }, [filteredRequests, equipmentById]);

  const topDepartment = React.useMemo(() => {
    const byDept: Record<string, number> = {};
    for (const r of filteredRequests) {
      const uid = r.createdBy || r.userID || "";
      if (!uid) continue;
      const dept = (usersById[uid]?.department || "").trim();
      if (!dept) continue;
      byDept[dept] = (byDept[dept] || 0) + 1;
    }
    const sorted = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5);
  }, [filteredRequests, usersById]);

  const conflicts = React.useMemo(() => computeConflicts(filteredRequests), [filteredRequests]);

  const turnaroundByAdmin = React.useMemo(() => {
    const rows: Record<string, { uid: string; count: number; totalMs: number }> = {};
    for (const r of filteredRequests) {
      const status = normalizeStatus(r.status as any);
      if (!(status === "approved" || status === "rejected")) continue;
      const created = resolveDate(r.createdAtClient || r.createdAt);
      const done = resolveDate(r.approvedAt || r.rejectedAt);
      if (!created || !done) continue;
      const actor = (status === "approved" ? r.approvedBy : r.rejectedBy) || "";
      if (!actor) continue;
      const diff = done.getTime() - created.getTime();
      if (diff <= 0) continue;
      const entry = rows[actor] || { uid: actor, count: 0, totalMs: 0 };
      entry.count += 1;
      entry.totalMs += diff;
      rows[actor] = entry;
    }
    return Object.values(rows)
      .map((r) => ({ ...r, avgMs: r.totalMs / Math.max(1, r.count) }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 6);
  }, [filteredRequests]);

  const insights = React.useMemo(
    () =>
      buildInsights({
        requestsInRange: filteredRequests,
        requestsPrevRange: prevRequests,
        equipmentById,
        usersById,
      }).slice(0, 6),
    [filteredRequests, prevRequests, equipmentById, usersById]
  );

  const recentRequests = React.useMemo(() => {
    return filteredRequests
      .slice()
      .sort((a, b) => {
        const aa = resolveDate(a.createdAtClient || a.createdAt)?.getTime() || 0;
        const bb = resolveDate(b.createdAtClient || b.createdAt)?.getTime() || 0;
        return bb - aa;
      })
      .slice(0, 8);
  }, [filteredRequests]);

  const statusColors: Record<string, string> = {
    pending: "bg-warning",
    approved: "bg-success",
    rejected: "bg-error",
    ongoing: "bg-primary",
    returned: "bg-info",
    cancelled: "bg-neutral",
  };

  const exportRows = React.useCallback(() => {
    return filteredRequests.map((r) => {
      const requesterId = r.createdBy || r.userID;
      const requester = resolveRequesterLabel(requesterId, userLabelMap);
      const items = normalizeRequestItems(r.items);
      const itemQty = items.reduce((sum, it) => sum + (it.qty || 0), 0);
      return {
        request_id: r.id,
        requester,
        requester_id: requesterId || "",
        status: normalizeStatus(r.status as any),
        purpose: r.purpose || "",
        items_qty: itemQty,
        created_at: formatDateTime(r.createdAtClient || r.createdAt),
        start_date: r.startDate || "",
        end_date: r.endDate || "",
      };
    });
  }, [filteredRequests, userLabelMap]);

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col items-center justify-center gap-4 h-72">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-base-content/70 text-sm">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <div className="relative overflow-hidden rounded-box border border-base-300 bg-gradient-to-br from-primary/10 via-base-100 to-secondary/10 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Analytics Command Center</h1>
            <p className="text-sm sm:text-base text-base-content/70">
              Operational visibility for approvals, demand, equipment stress, and user patterns.
            </p>
            {error && (
              <div className="alert alert-warning mt-3">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>

          <div className="w-full lg:w-auto">
            <div className="card bg-base-100/70 border border-base-300 shadow-sm">
              <div className="card-body p-3 sm:p-4 gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Filter className="w-4 h-4" />
                    Global filters
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-sm btn-outline gap-2"
                      onClick={() => downloadCsv(`fishlers_analytics_${new Date().toISOString().slice(0, 10)}.csv`, exportRows())}
                      type="button"
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </button>
                    <button className="btn btn-sm btn-outline gap-2" onClick={() => window.print()} type="button">
                      <Printer className="w-4 h-4" />
                      Print/PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <label className="form-control">
                    <div className="label py-0">
                      <span className="label-text text-xs">Date range</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={datePreset}
                      onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                    >
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>

                  <label className="form-control">
                    <div className="label py-0">
                      <span className="label-text text-xs">Request status</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="returned">Returned</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>

                  <label className="form-control">
                    <div className="label py-0">
                      <span className="label-text text-xs">Equipment category</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="all">All categories</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-control">
                    <div className="label py-0">
                      <span className="label-text text-xs">User type</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={userTypeFilter}
                      onChange={(e) => setUserTypeFilter(e.target.value)}
                    >
                      <option value="all">All users</option>
                      <option value="student">Students</option>
                      <option value="admin">Admins</option>
                    </select>
                  </label>
                </div>

                {datePreset === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="form-control">
                      <div className="label py-0">
                        <span className="label-text text-xs">From</span>
                      </div>
                      <input
                        type="date"
                        className="input input-bordered input-sm"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                    </label>
                    <label className="form-control">
                      <div className="label py-0">
                        <span className="label-text text-xs">To</span>
                      </div>
                      <input
                        type="date"
                        className="input input-bordered input-sm"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnalyticsSection
        id="command"
        title="Command Center"
        subtitle="Top KPIs that answer: what needs attention now?"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Total requests"
              value={totals.total}
              hint={`${startOfDay(filters.dateFrom).toLocaleDateString()} – ${endOfDay(filters.dateTo).toLocaleDateString()}${
                requestGrowthPct == null ? "" : ` • ${requestGrowthPct >= 0 ? "+" : ""}${requestGrowthPct}% vs prev`
              }`}
              icon={<ClipboardList className="w-5 h-5 text-primary" />}
              onClick={() => navigate("/admin/history")}
            />
            <KpiCard
              label="Active pending (needs action)"
              value={totals.pending}
              hint={`${pendingAging.gt48} over 48h`}
              tone={pendingAging.gt48 > 0 ? "danger" : totals.pending > 0 ? "warning" : "default"}
              icon={<ShieldAlert className="w-5 h-5 text-warning" />}
              onClick={() => navigate("/admin/history?status=pending")}
            />
            <KpiCard
              label="Avg approval turnaround"
              value={formatDuration(approval.avgTurnaroundMs)}
              hint={`${approval.approvalRate}% approval rate • ${approval.completedCount} decisions`}
              tone={approval.avgTurnaroundMs > 48 * 3600000 ? "warning" : "default"}
              icon={<Clock className="w-5 h-5 text-info" />}
              onClick={() => navigate("/analytics#ops")}
            />
            <KpiCard
              label="Equipment utilization rate"
              value={formatPct(utilization.utilizationPct)}
              hint={`${utilization.activeQty} active qty / ${utilization.totalInventory} inventory`}
              tone={utilization.utilizationPct >= 85 ? "danger" : utilization.utilizationPct >= 70 ? "warning" : "default"}
              icon={<Activity className="w-5 h-5 text-secondary" />}
              onClick={() => navigate("/analytics#equipment")}
            />
          </div>

          <div className="lg:col-span-4 card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  <Flame className="w-5 h-5 text-error" />
                  Alerts & next actions
                </div>
                <span className="badge badge-outline">{insights.length}</span>
              </div>
              {insights.length === 0 ? (
                <div className="text-sm text-base-content/60">No critical alerts in the selected range.</div>
              ) : (
                <div className="space-y-2">
                  {insights.map((i) => (
                    <button
                      key={i.title}
                      type="button"
                      className={`w-full text-left rounded-box border border-base-300 p-3 hover:bg-primary/5 transition-colors ${
                        i.severity === "critical"
                          ? "bg-error/5"
                          : i.severity === "warning"
                          ? "bg-warning/10"
                          : "bg-base-100"
                      }`}
                      onClick={() => {
                        if (i.ctaHref) navigate(i.ctaHref);
                      }}
                      disabled={!i.ctaHref}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">{i.title}</div>
                          <div className="text-xs text-base-content/60 mt-0.5">{i.detail}</div>
                        </div>
                        <span
                          className={`badge ${
                            i.severity === "critical"
                              ? "badge-error"
                              : i.severity === "warning"
                              ? "badge-warning"
                              : "badge-info"
                          }`}
                        >
                          {i.severity}
                        </span>
                      </div>
                      {i.ctaLabel && <div className="text-xs mt-2 font-semibold text-primary">{i.ctaLabel} →</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <div className="font-bold">Signals</div>
                <span className="badge badge-outline">context</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-box border border-base-300 bg-base-200/60 p-3">
                  <div className="text-[11px] text-base-content/60">Avg items / request</div>
                  <div className="text-xl font-extrabold">{avgItemsPerRequest ? avgItemsPerRequest.toFixed(1) : "—"}</div>
                </div>
                <div className="rounded-box border border-base-300 bg-base-200/60 p-3">
                  <div className="text-[11px] text-base-content/60">Disposable mix (demand)</div>
                  <div className="text-xl font-extrabold">{formatPct(demandMix.disposablePct)}</div>
                </div>
                <div className="rounded-box border border-base-300 bg-base-200/60 p-3">
                  <div className="text-[11px] text-base-content/60">Top requester</div>
                  <div className="text-sm font-bold truncate">
                    {topRequesters[0] ? resolveRequesterLabel(topRequesters[0][0], userLabelMap) : "—"}
                  </div>
                  <div className="text-[11px] text-base-content/60">{topRequesters[0] ? `${topRequesters[0][1]} requests` : ""}</div>
                </div>
                <div className="rounded-box border border-base-300 bg-base-200/60 p-3">
                  <div className="text-[11px] text-base-content/60">Active vs inactive users</div>
                  <div className="text-sm font-bold">
                    {activeUserStats.activeInPool} active • {activeUserStats.inactiveInPool} inactive
                  </div>
                  <div className="text-[11px] text-base-content/60">{activeUserStats.totalInPool} total users</div>
                </div>
              </div>
              {topDepartment.length > 0 && (
                <div className="rounded-box border border-base-300 bg-primary/5 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-base-content/60">Top departments</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {topDepartment.map(([dept, count]) => (
                      <span key={dept} className="badge badge-outline">
                        {dept}: <span className="font-semibold ml-1">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-4 card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <div className="font-bold">Overuse risk</div>
                <span className="badge badge-outline">qty ÷ inventory</span>
              </div>
              {equipmentDemand.length === 0 ? (
                <div className="text-sm text-base-content/60">No demand data available.</div>
              ) : (
                <RankedBarList
                  items={equipmentDemand
                    .map((e) => ({
                      key: e.equipmentID,
                      label: e.name,
                      value: e.inventory > 0 ? Math.round((e.qty / e.inventory) * 10) / 10 : e.qty,
                      meta: <span>{e.category} • {e.qty} qty • inv {e.inventory || "—"}</span>,
                    }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 6)}
                  valueLabel={(v) => `${v}x`}
                  onItemClick={() => navigate("/inventory")}
                />
              )}
            </div>
          </div>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        id="trend"
        title="Trend Analytics"
        subtitle="What’s trending, shifting, and spiking right now?"
        right={
          <div className="join">
            <button
              className={`btn btn-sm join-item ${granularity === "daily" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setGranularity("daily")}
              type="button"
            >
              Daily
            </button>
            <button
              className={`btn btn-sm join-item ${granularity === "weekly" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setGranularity("weekly")}
              type="button"
            >
              Weekly
            </button>
            <button
              className={`btn btn-sm join-item ${granularity === "monthly" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setGranularity("monthly")}
              type="button"
            >
              Monthly
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Requests over time
                </h3>
                <div className="text-sm text-base-content/60">{requestSeries.reduce((a, b) => a + b.value, 0)} total</div>
              </div>
              {requestSeries.length < 2 ? (
                <div className="text-sm text-base-content/60 mt-3">Not enough data for a trend line.</div>
              ) : (
                <LineChart points={requestSeries.map((p) => ({ label: p.label, value: p.value }))} />
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Request status trend</h3>
                <div className="text-xs text-base-content/60">Stacked by status</div>
              </div>
              {stackedStatuses.length === 0 ? (
                <div className="text-sm text-base-content/60 mt-3">No status data in range.</div>
              ) : (
                <StackedBars
                  buckets={stackedStatuses.map((b) => ({ label: b.label, values: b.values, total: b.total }))}
                  keys={["pending", "approved", "rejected", "ongoing", "returned", "cancelled"]}
                  colors={statusColors}
                />
              )}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Peak request periods</h3>
                <p className="text-xs text-base-content/60">Created-at heatmap (weekday × hour)</p>
              </div>
              <span className="badge badge-outline">{filteredRequests.length} req</span>
            </div>
            <div className="mt-3">
              <Heatmap grid={heatmap} />
            </div>
          </div>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        id="equipment"
        title="Equipment Intelligence"
        subtitle="Overuse, underuse, and category-level demand signals."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Most requested equipment</h3>
                <span className="badge badge-outline">{equipmentDemand.length} items</span>
              </div>
              {equipmentDemand.length === 0 ? (
                <div className="text-sm text-base-content/60">No equipment demand in this range.</div>
              ) : (
                <RankedBarList
                  items={equipmentDemand.slice(0, 8).map((e) => ({
                    key: e.equipmentID,
                    label: e.name,
                    value: e.qty,
                    meta: (
                      <span>
                        {e.category} • inv {e.inventory || "—"} • {e.isDisposable ? "disposable" : "reusable"}
                      </span>
                    ),
                  }))}
                  valueLabel={(v) => `${v} qty`}
                  onItemClick={() => navigate("/inventory")}
                />
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Least used / idle equipment</h3>
                <span className="badge badge-outline">{equipment.length} total</span>
              </div>
              {equipment.length === 0 ? (
                <div className="text-sm text-base-content/60">No equipment records found.</div>
              ) : (
                <RankedBarList
                  items={(() => {
                    const used = new Set(equipmentDemand.map((d) => d.equipmentID));
                    const idle = equipment
                      .filter((e) => !used.has(e.equipmentID))
                      .slice(0, 8)
                      .map((e) => ({
                        key: e.equipmentID,
                        label: e.name,
                        value: 0,
                        meta: <span>{(e.category || "Uncategorized").trim()} • inv {e.totalInventory || "—"}</span>,
                      }));
                    return idle.length ? idle : equipmentDemand.slice(-8).reverse().map((e) => ({
                      key: e.equipmentID,
                      label: e.name,
                      value: e.qty,
                      meta: <span>Low usage • {(e.category || "Uncategorized").trim()}</span>,
                    }));
                  })()}
                  valueLabel={(v) => (v ? `${v} qty` : "idle")}
                  onItemClick={() => navigate("/inventory")}
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Utilization by category</h3>
                <span className="badge badge-outline">{demandByCategory.sorted.length} categories</span>
              </div>
              {demandByCategory.sorted.length === 0 ? (
                <div className="text-sm text-base-content/60">No category demand in this range.</div>
              ) : (
                <RankedBarList
                  items={demandByCategory.sorted.slice(0, 8).map(([cat, qty]) => ({
                    key: cat,
                    label: cat,
                    value: qty,
                    meta: <span>{formatPct(demandByCategory.total ? (qty / demandByCategory.total) * 100 : 0)} of demand</span>,
                  }))}
                  valueLabel={(v) => `${v} qty`}
                />
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Disposable vs reusable demand</h3>
                <span className="badge badge-outline">{granularity}</span>
              </div>
              {disposableTrend.length < 2 ? (
                <div className="text-sm text-base-content/60">Not enough data for a trend.</div>
              ) : (
                <StackedBars
                  buckets={disposableTrend.map((b) => ({
                    label: b.label,
                    total: b.total,
                    values: { disposable: b.disposable, reusable: b.reusable },
                  }))}
                  keys={["disposable", "reusable"]}
                  colors={{ disposable: "bg-secondary", reusable: "bg-primary" }}
                />
              )}
            </div>
          </div>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        id="users"
        title="User Behavior Insights"
        subtitle="Who’s driving demand, and what patterns matter?"
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Top requesters</h3>
                <span className="badge badge-outline">{topRequesters.length}</span>
              </div>
              {topRequesters.length === 0 ? (
                <div className="text-sm text-base-content/60">No requests in this range.</div>
              ) : (
                <RankedBarList
                  items={topRequesters.map(([uid, count]) => ({
                    key: uid,
                    label: resolveRequesterLabel(uid, userLabelMap),
                    value: count,
                    meta: <span className="font-mono text-[11px]">{uid}</span>,
                  }))}
                  valueLabel={(v) => `${v} req`}
                  onItemClick={() => navigate("/admin/history")}
                />
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Requests by user role</h3>
                <span className="badge badge-outline">{requestsByRole.total}</span>
              </div>
              {requestsByRole.sorted.length === 0 ? (
                <div className="text-sm text-base-content/60">No role data available.</div>
              ) : (
                <RankedBarList
                  items={requestsByRole.sorted.map(([role, count]) => ({
                    key: role,
                    label: role,
                    value: count,
                    meta: <span>{formatPct(requestsByRole.total ? (count / requestsByRole.total) * 100 : 0)}</span>,
                  }))}
                  valueLabel={(v) => `${v} req`}
                />
              )}

              {cancellationFlags.length > 0 && (
                <div className="mt-2 rounded-box border border-base-300 bg-warning/10 p-3">
                  <div className="font-bold text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Repeated cancellations
                  </div>
                  <div className="text-xs text-base-content/70 mt-1">
                    Users with multiple cancellations in the selected range.
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cancellationFlags.map(([uid, c]) => (
                      <span key={uid} className="badge badge-warning gap-2">
                        {resolveRequesterLabel(uid, userLabelMap)}
                        <span className="opacity-80">({c})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        id="ops"
        title="Operations & Bottlenecks"
        subtitle="Aging, turnaround, conflicts, and the live request queue."
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Pending aging buckets</h3>
                <span className="badge badge-outline">{totals.pending} pending</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-box border border-base-300 bg-base-200/60 p-3">
                  <div className="text-[11px] text-base-content/60">{"<24h"}</div>
                  <div className="text-xl font-extrabold">{pendingAging.lt24}</div>
                </div>
                <div className="rounded-box border border-base-300 bg-warning/10 p-3">
                  <div className="text-[11px] text-base-content/60">24–48h</div>
                  <div className="text-xl font-extrabold">{pendingAging.h24to48}</div>
                </div>
                <div className="rounded-box border border-base-300 bg-error/5 p-3">
                  <div className="text-[11px] text-base-content/60">{">48h"}</div>
                  <div className="text-xl font-extrabold text-error">{pendingAging.gt48}</div>
                </div>
              </div>
              <button className="btn btn-sm btn-primary mt-2" type="button" onClick={() => navigate("/admin/history?status=pending&quick=aged48")}>
                Review aged pending
              </button>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Approval turnaround by admin</h3>
                <span className="badge badge-outline">{turnaroundByAdmin.length}</span>
              </div>
              {turnaroundByAdmin.length === 0 ? (
                <div className="text-sm text-base-content/60">No approval timing data available.</div>
              ) : (
                <RankedBarList
                  items={turnaroundByAdmin.map((a) => ({
                    key: a.uid,
                    label: resolveRequesterLabel(a.uid, userLabelMap),
                    value: Math.round(a.avgMs / 3600000),
                    meta: <span>{a.count} decisions</span>,
                  }))}
                  valueLabel={(v) => `${v}h avg`}
                />
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Conflict indicators</h3>
                <span className={`badge ${conflicts > 0 ? "badge-error" : "badge-success"}`}>{conflicts}</span>
              </div>
              <div className="text-sm text-base-content/70">
                {conflicts > 0
                  ? "Potential schedule overlaps detected for the same equipment across approved/ongoing requests."
                  : "No overlaps detected from available schedule data."}
              </div>
              <div className="text-xs text-base-content/60">
                This is a lightweight heuristic; use Request History to confirm details.
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <a className="btn btn-sm btn-outline" href="/admin/history">
                  Open request history
                </a>
                <a className="btn btn-sm btn-outline" href="/admindashboard">
                  Manage requests
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Recent requests (live feed)</h3>
                <span className="badge badge-outline">{recentRequests.length}</span>
              </div>
              {recentRequests.length === 0 ? (
                <div className="text-sm text-base-content/60">No requests recorded in this range.</div>
              ) : (
                <div className="space-y-2">
                  {recentRequests.map((r) => {
                    const requesterId = r.createdBy || r.userID;
                    const requester = resolveRequesterLabel(requesterId, userLabelMap);
                    const items = normalizeRequestItems(r.items);
                    const qty = items.reduce((sum, it) => sum + (it.qty || 0), 0);
                    const status = normalizeStatus(r.status as any);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className="w-full text-left rounded-box border border-base-300 bg-base-100 hover:bg-primary/5 transition-colors p-3"
                        onClick={() => navigate(`/admin/history?requestId=${encodeURIComponent(r.id)}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold truncate">{r.purpose || "Untitled request"}</span>
                              <StatusPill status={status} />
                            </div>
                            <div className="text-xs text-base-content/60 mt-1 truncate">
                              {requester} • {qty} item{qty === 1 ? "" : "s"} • {formatDateTime(r.createdAtClient || r.createdAt)}
                            </div>
                            <div className="text-[11px] font-mono text-base-content/50 mt-1">ID: {r.id}</div>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-2">
                            {status === "pending" && (
                              <span className="badge badge-warning">needs review</span>
                            )}
                            <span className="text-xs font-semibold text-primary">Open →</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-4 sm:p-5 gap-3">
              <h3 className="font-bold">Quick actions</h3>
              <p className="text-xs text-base-content/60">
                High-leverage shortcuts for admin operations.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href="/admindashboard" className="btn btn-primary btn-sm">
                  Manage requests
                </a>
                <a href="/admin/history?status=pending" className="btn btn-secondary btn-sm">
                  Pending queue
                </a>
                <a href="/inventory" className="btn btn-outline btn-sm">
                  Inventory
                </a>
                <a href="/admin/users" className="btn btn-outline btn-sm">
                  Users
                </a>
                <a href="/admin/accountabilities" className="btn btn-outline btn-sm">
                  Accountabilities
                </a>
              </div>
              <div className="mt-3 rounded-box border border-base-300 bg-base-200/60 p-3">
                <div className="text-[11px] uppercase tracking-wide text-base-content/60">Status snapshot</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["pending", "approved", "rejected", "ongoing", "returned", "cancelled"] as const).map((s) => (
                    <span key={s} className="badge badge-outline gap-2">
                      <span className={`inline-block w-2 h-2 rounded-sm ${statusColors[s]}`} />
                      {s}: <span className="font-semibold">{(totals as any)[s] || 0}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        id="insights"
        title="Recommended Actions"
        subtitle="Rule-based insights that turn analytics into decisions."
      >
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-4 sm:p-5 gap-3">
            {insights.length === 0 ? (
              <div className="text-sm text-base-content/60">No recommendations for the selected filters.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {insights.map((i) => (
                  <div
                    key={i.title}
                    className={`rounded-box border border-base-300 p-4 ${
                      i.severity === "critical"
                        ? "bg-error/5"
                        : i.severity === "warning"
                        ? "bg-warning/10"
                        : "bg-base-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold">{i.title}</div>
                        <div className="text-sm text-base-content/70 mt-1">{i.detail}</div>
                      </div>
                      <span
                        className={`badge ${
                          i.severity === "critical"
                            ? "badge-error"
                            : i.severity === "warning"
                            ? "badge-warning"
                            : "badge-info"
                        }`}
                      >
                        {i.severity}
                      </span>
                    </div>
                    {i.ctaHref && (
                      <button className="btn btn-sm btn-outline mt-3" type="button" onClick={() => navigate(i.ctaHref!)}>
                        {i.ctaLabel || "Open"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-base-content/60 mt-1">
              Insights are computed from the selected filters; refine filters to focus the recommendations.
            </div>
          </div>
        </div>
      </AnalyticsSection>
    </div>
  );
}
