import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, CheckCircle, XCircle, AlertCircle, User, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAnnouncementManagement } from '../../hooks/useAnnouncementManagement';
import LoadingOverlay from '../../components/LoadingOverlay';
import MobileStatsPager from '../../components/MobileStatsPager';
import { Announcement } from '../../db';
import { useToast } from '../../context/toastContext';

export default function ManageAnnouncements() {
  const { isSuperAdmin, user } = useAuth();
  const { announcements, loading, createAnnouncement, approveAnnouncement, rejectAnnouncement, archiveAnnouncement, restoreAnnouncement, updateAnnouncement, deleteAnnouncementPermanently } = useAnnouncementManagement();
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    const aTime = a.submittedAt ? Date.parse(a.submittedAt as any) : 0;
    const bTime = b.submittedAt ? Date.parse(b.submittedAt as any) : 0;
    return bTime - aTime;
  });
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<
    "active" | "pending" | "approved" | "rejected" | "inactive" | "archived" | "all"
  >("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<Announcement | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    message: "",
    type: "info" as "info" | "success" | "warning" | "error",
    visibleTo: ["student"] as ("student" | "admin" | "superadmin")[],
    startDate: "",
    endDate: "",
    active: true,
  });

  const { showToast } = useToast();

  useEffect(() => {
    const anyState = (location.state || {}) as any;
    if (anyState?.openCreate) {
      setCreateOpen(true);
      navigate("/admin/announcements", { replace: true });
    }
  }, [location.state, navigate]);

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <AlertCircle className="w-5 h-5" />
          <span>Access denied. Superadmin privileges required.</span>
        </div>
      </div>
    );
  }

  const handleAction = async () => {
    if (!selectedAnnouncement || !action) return;

    setProcessing(true);
    try {
      if (action === 'approve') {
        await approveAnnouncement(selectedAnnouncement.announcementID!, reviewNotes.trim() || undefined);

        showToast("Announcement approved successfully!", "success");

        setTimeout(() => {
          navigate("/admin/announcements");
        }, 300);
      } else {
        await rejectAnnouncement(selectedAnnouncement.announcementID!, reviewNotes.trim() || undefined);

        showToast("Announcement rejected.", "error");
      }
      setSelectedAnnouncement(null);
      setAction(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Failed to process announcement:', error);
      
      showToast("Failed to process announcement.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setProcessing(true);
    try {
      await archiveAnnouncement(deleteTarget.announcementID!);

      showToast("Announcement archived successfully!", "info");

      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete announcement:', error);

      showToast("Failed to archive announcement.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-error" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'info':
      default:
        return <AlertCircle className="w-4 h-4 text-info" />;
    }
  };

  const closeCreateModal = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError(null);
    setCreateForm({
      title: "",
      message: "",
      type: "info",
      visibleTo: ["student"],
      startDate: "",
      endDate: "",
      active: true,
    });
  };

  const toggleVisibleTo = (role: "student" | "admin" | "superadmin", checked: boolean) => {
    setCreateForm((prev) => ({
      ...prev,
      visibleTo: checked ? [...prev.visibleTo, role] : prev.visibleTo.filter((r) => r !== role),
    }));
  };

  const handleCreate = async () => {
    setCreateError(null);
    try {
      if (!user) throw new Error("Not authenticated.");
      if (!createForm.title.trim() || !createForm.message.trim()) {
        throw new Error("Title and message are required.");
      }
      if (!createForm.visibleTo.length) {
        throw new Error("Select at least one audience.");
      }
      if (createForm.startDate && createForm.endDate) {
        const start = new Date(createForm.startDate);
        const end = new Date(createForm.endDate);
        if (start >= end) throw new Error("End date must be after start date.");
      }

      setCreating(true);
      await createAnnouncement({
        title: createForm.title.trim(),
        message: createForm.message.trim(),
        type: createForm.type,
        visibleTo: createForm.visibleTo,
        active: createForm.active,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        ...(createForm.startDate ? { startDate: createForm.startDate } : {}),
        ...(createForm.endDate ? { endDate: createForm.endDate } : {}),
      });

      showToast("Announcement created.", "success");
      closeCreateModal();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create announcement.");
    } finally {
      setCreating(false);
    }
  };

  const openDetails = (announcement: Announcement) => {
    setDetailsTarget(announcement);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    if (processing) return;
    setDetailsOpen(false);
    setDetailsTarget(null);
  };

  const typeAccentClass = (type?: string) => {
    const normalized = (type || "info").toLowerCase();
    if (normalized === "success") return "border-l-success";
    if (normalized === "warning") return "border-l-warning";
    if (normalized === "error") return "border-l-error";
    return "border-l-info";
  };

  const statusBadge = (status?: string) => {
    const normalized = (status || "pending").toLowerCase();
    if (normalized === "approved")
      return <span className="badge badge-success badge-sm whitespace-nowrap">Approved</span>;
    if (normalized === "rejected")
      return <span className="badge badge-error badge-sm whitespace-nowrap">Rejected</span>;
    return <span className="badge badge-warning badge-sm whitespace-nowrap">Pending</span>;
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const isArchived = (a: Announcement) => a.archivedAt != null;
  const isActive = (a: Announcement) => a.active !== false;

  const baseAnnouncements = sortedAnnouncements.filter(a => !isArchived(a));
  
  const activeAnnouncements = baseAnnouncements.filter(isActive);

  const inactiveAnnouncements = baseAnnouncements.filter(a => a.active === false);

  const pendingAnnouncements = baseAnnouncements.filter(
    (a) => a.status === 'pending'
  );

  const approvedAnnouncements = baseAnnouncements.filter(
    (a) => a.status === 'approved'
  );

  const rejectedAnnouncements = baseAnnouncements.filter(
    (a) => a.status === 'rejected'
  );

  const archivedAnnouncements = sortedAnnouncements.filter(
    (a) => a.archivedAt != null
  );

  const activeOngoingAnnouncements = approvedAnnouncements
    .filter(isActive)
    .filter(a => {
      const now = Date.now();
      const start = a.startDate ? Date.parse(a.startDate) : -Infinity;
      const end = a.endDate ? Date.parse(a.endDate) : Infinity;
      return start <= now && now <= end;
    });

  const matchesSearch = React.useCallback(
    (announcement: Announcement) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      const hay = [
        announcement.title,
        announcement.message,
        announcement.status,
        announcement.type,
        (announcement.visibleTo || []).join(", "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    },
    [search]
  );

  const filteredBaseAnnouncements = React.useMemo(
    () => baseAnnouncements.filter(matchesSearch),
    [baseAnnouncements, matchesSearch]
  );
  const filteredActiveOngoingAnnouncements = React.useMemo(
    () => activeOngoingAnnouncements.filter(matchesSearch),
    [activeOngoingAnnouncements, matchesSearch]
  );
  const filteredInactiveAnnouncements = React.useMemo(
    () => inactiveAnnouncements.filter(matchesSearch),
    [inactiveAnnouncements, matchesSearch]
  );
  const filteredPendingAnnouncements = React.useMemo(
    () => pendingAnnouncements.filter(matchesSearch),
    [pendingAnnouncements, matchesSearch]
  );
  const filteredApprovedAnnouncements = React.useMemo(
    () => approvedAnnouncements.filter(matchesSearch),
    [approvedAnnouncements, matchesSearch]
  );
  const filteredRejectedAnnouncements = React.useMemo(
    () => rejectedAnnouncements.filter(matchesSearch),
    [rejectedAnnouncements, matchesSearch]
  );
  const filteredArchivedAnnouncements = React.useMemo(
    () => archivedAnnouncements.filter(matchesSearch),
    [archivedAnnouncements, matchesSearch]
  );

  const tabCounts = {
    all: filteredBaseAnnouncements.length,
    active: filteredActiveOngoingAnnouncements.length,
    inactive: filteredInactiveAnnouncements.length,
    pending: filteredPendingAnnouncements.length,
    approved: filteredApprovedAnnouncements.length,
    rejected: filteredRejectedAnnouncements.length,
    archived: filteredArchivedAnnouncements.length,
  } as const;

  const tabLabel = (key: keyof typeof tabCounts) => {
    switch (key) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      case "archived":
        return "Archived";
      case "all":
      default:
        return "All";
    }
  };

  const listForTab = React.useMemo(() => {
    switch (tab) {
      case "active":
        return filteredActiveOngoingAnnouncements;
      case "inactive":
        return filteredInactiveAnnouncements;
      case "pending":
        return filteredPendingAnnouncements;
      case "approved":
        return filteredApprovedAnnouncements;
      case "rejected":
        return filteredRejectedAnnouncements;
      case "archived":
        return filteredArchivedAnnouncements;
      case "all":
      default:
        return filteredBaseAnnouncements;
    }
  }, [
    tab,
    filteredActiveOngoingAnnouncements,
    filteredInactiveAnnouncements,
    filteredPendingAnnouncements,
    filteredApprovedAnnouncements,
    filteredRejectedAnnouncements,
    filteredArchivedAnnouncements,
    filteredBaseAnnouncements,
  ]);

  const scheduleLabel = (announcement: Announcement) => {
    const start = announcement.startDate ? new Date(announcement.startDate) : null;
    const end = announcement.endDate ? new Date(announcement.endDate) : null;
    if (!start && !end) return "No schedule";
    try {
      if (start && end) return `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
      if (start) return `Starts ${start.toLocaleDateString()}`;
      return `Ends ${end!.toLocaleDateString()}`;
    } catch {
      return "Schedule unavailable";
    }
  };

  return (
    <>
      <LoadingOverlay show={loading || processing} message={processing ? "Processing..." : "Loading announcements..."} />
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Manage Announcements</h1>
            <p className="text-base-content/70">Review and manage system announcements</p>
          </div>
          <button
            className="btn btn-primary btn-sm sm:btn-md gap-2 w-full sm:w-auto"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Create Announcement</span>
          </button>
        </div>
      
        {/* Stats */}
        <MobileStatsPager
          breakpoint="lg"
          items={[
            { label: "Pending", value: pendingAnnouncements.length, colorClass: "text-warning" },
            { label: "Approved", value: approvedAnnouncements.length, colorClass: "text-success" },
            { label: "Rejected", value: rejectedAnnouncements.length, colorClass: "text-error" },
          ]}
        />
        <div className="hidden lg:flex stats stats-horizontal shadow bg-base-200 w-full">
          <div className="stat">
            <div className="stat-title">Pending</div>
            <div className="stat-value text-warning">{pendingAnnouncements.length}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Approved</div>
            <div className="stat-value text-success">{approvedAnnouncements.length}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Rejected</div>
            <div className="stat-value text-error">{rejectedAnnouncements.length}</div>
          </div>
        </div>

        {/* Search */}
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4">
            <input
              className="input input-bordered w-full"
              placeholder="Search announcements (title, message, audience, status)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="text-xs text-base-content/60 mt-2">
              Tip: use this to quickly find items across all tabs.
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="card bg-base-200 shadow">
          <div className="card-body p-0">
            <div className="p-4 border-b border-base-300">
              <div role="tablist" className="tabs tabs-boxed bg-base-300 overflow-x-auto">
                {(
                  ["all", "active", "inactive", "pending", "approved", "rejected", "archived"] as const
                ).map((key) => (
                  <a
                    key={key}
                    role="tab"
                    className={`tab whitespace-nowrap transition-all duration-200 ${
                      tab === key ? "tab-active bg-primary text-white font-semibold" : ""
                    }`}
                    onClick={() => setTab(key)}
                  >
                    {tabLabel(key)} ({tabCounts[key]})
                  </a>
                ))}
              </div>
            </div>

            <div className="p-4">
              {listForTab.length === 0 ? (
                <div className="text-center py-10 text-base-content/60">
                  No announcements
                </div>
              ) : (
                <div className="space-y-4">
                  {listForTab.map((announcement) => (
                    <div
                      key={announcement.announcementID}
                      className={`rounded-box border border-base-300 border-l-4 ${typeAccentClass(
                        announcement.type
                      )} bg-base-100 shadow-sm hover:shadow transition-shadow cursor-pointer`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetails(announcement)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openDetails(announcement);
                      }}
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="min-w-0 flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">{getTypeIcon(announcement.type)}</div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold truncate">{announcement.title}</h4>
                                {statusBadge(announcement.status)}
                                {announcement.archivedAt && (
                                  <span className="badge badge-outline badge-sm whitespace-nowrap">
                                    Archived
                                  </span>
                                )}
                                {tab === "active" && (
                                  <span className="badge badge-success badge-sm whitespace-nowrap">
                                    Ongoing
                                  </span>
                                )}
                                {(announcement.startDate || announcement.endDate) && (
                                  <span className="badge badge-outline badge-sm whitespace-nowrap">
                                    {scheduleLabel(announcement)}
                                  </span>
                                )}
                                {tab === "inactive" && (
                                  <span className="badge badge-ghost badge-sm whitespace-nowrap">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-base-content/70 mt-1 whitespace-pre-wrap break-words">
                                {announcement.message}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                                <span className="badge badge-ghost badge-sm whitespace-nowrap">
                                  Visible: {(announcement.visibleTo || []).join(", ") || "N/A"}
                                </span>
                                {announcement.submittedAt && (
                                  <span className="whitespace-nowrap">
                                    Submitted {formatDate(announcement.submittedAt)}
                                  </span>
                                )}
                                {announcement.reviewedAt && announcement.status !== "pending" && (
                                  <span className="whitespace-nowrap">
                                    Reviewed {formatDate(announcement.reviewedAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tab === "pending" || announcement.status === "pending" ? (
                              <>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => {
                                    setSelectedAnnouncement(announcement);
                                    setAction("approve");
                                  }}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  className="btn btn-error btn-sm"
                                  onClick={() => {
                                    setSelectedAnnouncement(announcement);
                                    setAction("reject");
                                  }}
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : null}

                            {announcement.archivedAt ? (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={async () => {
                                  try {
                                    setProcessing(true);
                                    await restoreAnnouncement(announcement.announcementID!);
                                    showToast("Announcement restored successfully.", "success");
                                  } catch (error) {
                                    console.error("Failed to restore announcement:", error);
                                    showToast("Failed to restore announcement.", "error");
                                  } finally {
                                    setProcessing(false);
                                  }
                                }}
                                disabled={processing}
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => setDeleteTarget(announcement)}
                              >
                                <XCircle className="w-4 h-4" />
                                <span>Archive</span>
                              </button>
                            )}

                            {announcement.status === "approved" && !announcement.archivedAt && (
                              <label className="flex items-center justify-between sm:justify-start gap-2 text-xs bg-base-200/60 rounded-btn px-3 py-2">
                                <span className="text-base-content/70 whitespace-nowrap">
                                  {announcement.active !== false ? "Active" : "Inactive"}
                                </span>
                                <input
                                  type="checkbox"
                                  className="toggle toggle-sm toggle-success"
                                  checked={announcement.active !== false}
                                  onChange={async (e) => {
                                    await updateAnnouncement(announcement.announcementID!, {
                                      active: e.target.checked,
                                    });
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {createOpen && (
        <dialog
          className="modal modal-open sm:modal-middle"
          onCancel={closeCreateModal}
          onClose={closeCreateModal}
        >
          <div className="modal-box w-11/12 max-w-3xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg truncate">Create Announcement</h3>
                </div>
                <p className="text-sm text-base-content/70 mt-1">
                  Publish an announcement for students/admins/superadmin.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={closeCreateModal}
                aria-label="Close"
                disabled={creating}
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="alert alert-error mt-4">
                <AlertCircle className="w-5 h-5" />
                <span>{createError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Title</span>
                  </label>
                  <input
                    className="input input-bordered w-full"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Short, clear headline"
                    disabled={creating}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Type</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, type: e.target.value as any }))
                    }
                    disabled={creating}
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-between">
                    <span className="label-text font-medium">Active</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-success"
                      checked={createForm.active}
                      onChange={(e) =>
                        setCreateForm((p) => ({ ...p, active: e.target.checked }))
                      }
                      disabled={creating}
                    />
                  </label>
                  <p className="text-xs text-base-content/60">
                    Active announcements show up in the banner when within the schedule.
                  </p>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Visible To</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(["student", "admin", "superadmin"] as const).map((role) => (
                      <label
                        key={role}
                        className="flex items-center justify-between gap-2 rounded-btn border border-base-300 bg-base-100 px-3 py-2 cursor-pointer"
                      >
                        <span className="capitalize text-sm">{role}</span>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={createForm.visibleTo.includes(role)}
                          onChange={(e) => toggleVisibleTo(role, e.target.checked)}
                          disabled={creating}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Start Date</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered w-full"
                      value={createForm.startDate}
                      onChange={(e) =>
                        setCreateForm((p) => ({ ...p, startDate: e.target.value }))
                      }
                      disabled={creating}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">End Date</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered w-full"
                      value={createForm.endDate}
                      onChange={(e) =>
                        setCreateForm((p) => ({ ...p, endDate: e.target.value }))
                      }
                      disabled={creating}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Message</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered min-h-44 w-full"
                    value={createForm.message}
                    onChange={(e) => setCreateForm((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Write the announcement message…"
                    disabled={creating}
                  />
                </div>

                <div className="rounded-box border border-base-300 bg-base-200 p-4">
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Preview
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <div className="mt-0.5">{getTypeIcon(createForm.type)}</div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {createForm.title.trim() || "Announcement title"}
                      </div>
                      <div className="text-sm text-base-content/70 whitespace-pre-wrap break-words mt-1">
                        {createForm.message.trim() || "Announcement message preview…"}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                        <span className="badge badge-ghost badge-sm">
                          Visible: {createForm.visibleTo.join(", ") || "N/A"}
                        </span>
                        {(createForm.startDate || createForm.endDate) && (
                          <span className="badge badge-outline badge-sm">
                            {createForm.startDate && createForm.endDate
                              ? `${createForm.startDate} to ${createForm.endDate}`
                              : createForm.startDate
                              ? `Starts ${createForm.startDate}`
                              : `Ends ${createForm.endDate}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action mt-6">
              <button className="btn" onClick={closeCreateModal} disabled={creating}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                <Send className="w-4 h-4" />
                Create
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeCreateModal}>close</button>
          </form>
        </dialog>
      )}

      {/* Details Modal */}
      {detailsOpen && detailsTarget && (
        <dialog
          className="modal modal-open sm:modal-middle"
          onCancel={closeDetails}
          onClose={closeDetails}
        >
          <div className="modal-box w-11/12 max-w-4xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="shrink-0">{getTypeIcon(detailsTarget.type)}</div>
                  <h3 className="font-bold text-lg truncate">{detailsTarget.title}</h3>
                  {statusBadge(detailsTarget.status)}
                  {detailsTarget.archivedAt && (
                    <span className="badge badge-outline badge-sm whitespace-nowrap">Archived</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                  <span className="badge badge-ghost badge-sm whitespace-nowrap">
                    Visible: {(detailsTarget.visibleTo || []).join(", ") || "N/A"}
                  </span>
                  {(detailsTarget.startDate || detailsTarget.endDate) && (
                    <span className="badge badge-outline badge-sm whitespace-nowrap">
                      {scheduleLabel(detailsTarget)}
                    </span>
                  )}
                  {detailsTarget.active === false ? (
                    <span className="badge badge-ghost badge-sm whitespace-nowrap">Inactive</span>
                  ) : (
                    <span className="badge badge-success badge-sm whitespace-nowrap">Active</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={closeDetails}
                aria-label="Close"
                disabled={processing}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-box border border-base-300 bg-base-200 p-4">
              <div className="text-xs uppercase tracking-wide text-base-content/60">Message</div>
              <div className="mt-2 whitespace-pre-wrap break-words text-sm text-base-content/80">
                {detailsTarget.message}
              </div>
              {detailsTarget.reviewNotes && (
                <div className="mt-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm">
                  <div className="font-semibold text-error">Review Notes</div>
                  <div className="mt-1 whitespace-pre-wrap text-base-content/80">
                    {detailsTarget.reviewNotes}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="text-xs uppercase tracking-wide text-base-content/60">Audit</div>
                <div className="mt-2 space-y-1 text-base-content/70">
                  <div>Submitted: {formatDate(detailsTarget.submittedAt)}</div>
                  <div>Reviewed: {formatDate(detailsTarget.reviewedAt)}</div>
                  <div>Archived: {formatDate(detailsTarget.archivedAt)}</div>
                  <div>Restored: {formatDate(detailsTarget.restoredAt)}</div>
                </div>
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="text-xs uppercase tracking-wide text-base-content/60">Controls</div>
                <div className="mt-3 space-y-2">
                  <label className="flex items-center justify-between gap-3 bg-base-200/60 rounded-btn px-3 py-2">
                    <span className="text-sm text-base-content/70">Active</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-success"
                      checked={detailsTarget.active !== false}
                      onChange={async (e) => {
                        await updateAnnouncement(detailsTarget.announcementID!, { active: e.target.checked });
                      }}
                      disabled={processing || !!detailsTarget.archivedAt}
                    />
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {detailsTarget.status === "pending" && (
                      <>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => {
                            closeDetails();
                            setSelectedAnnouncement(detailsTarget);
                            setAction("approve");
                            setReviewNotes("");
                          }}
                          disabled={processing}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          className="btn btn-error btn-sm"
                          onClick={() => {
                            closeDetails();
                            setSelectedAnnouncement(detailsTarget);
                            setAction("reject");
                            setReviewNotes("");
                          }}
                          disabled={processing}
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}

                    {detailsTarget.archivedAt ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          try {
                            setProcessing(true);
                            await restoreAnnouncement(detailsTarget.announcementID!);
                            showToast("Announcement restored.", "success");
                          } catch (e) {
                            console.error(e);
                            showToast("Failed to restore announcement.", "error");
                          } finally {
                            setProcessing(false);
                          }
                        }}
                        disabled={processing}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setDeleteTarget(detailsTarget)}
                        disabled={processing}
                      >
                        <XCircle className="w-4 h-4" />
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action mt-6">
              <button className="btn" onClick={closeDetails} disabled={processing}>
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeDetails}>close</button>
          </form>
        </dialog>
      )}

      {/* Review Modal */}
      {selectedAnnouncement && action && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <h3 className="font-bold text-lg">
              {action === 'approve' ? 'Approve' : 'Reject'} Announcement
            </h3>
            <div className="py-4">
              <div className="bg-base-200 p-4 rounded-lg mb-4">
                <h4 className="font-semibold">{selectedAnnouncement.title}</h4>
                <p className="text-sm mt-1">{selectedAnnouncement.message}</p>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Review Notes (Optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={action === 'reject' ? 'Reason for rejection...' : 'Additional notes...'}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setSelectedAnnouncement(null);
                  setAction(null);
                  setReviewNotes('');
                }}
              >
                Cancel
              </button>
              <button
                className={`btn ${action === 'approve' ? 'btn-success' : 'btn-error'}`}
                onClick={handleAction}
                disabled={processing}
              >
                {action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              onClick={() => {
                setSelectedAnnouncement(null);
                setAction(null);
                setReviewNotes("");
              }}
            >
              close
            </button>
          </form>
        </dialog>
      )}

      {deleteTarget && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-md max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <h3 className="font-bold text-lg">Confirm Archive</h3>
            <p className="py-4">
              Are you sure you want to archive the announcement &quot;{deleteTarget.title}&quot;? It can be restored later.
            </p>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => setDeleteTarget(null)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning"
                onClick={handleDelete}
                disabled={processing}
              >
                Archive
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setDeleteTarget(null)}>close</button>
          </form>
        </dialog>
      )}
    </>
  );
}
