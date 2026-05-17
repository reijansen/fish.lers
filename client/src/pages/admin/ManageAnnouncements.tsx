import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAnnouncementManagement } from '../../hooks/useAnnouncementManagement';
import LoadingOverlay from '../../components/LoadingOverlay';
import MobileStatsPager from '../../components/MobileStatsPager';
import { Announcement } from '../../db';
import { deleteField } from 'firebase/firestore';
import { useToast } from '../../context/toastContext';

export default function ManageAnnouncements() {
  const { isSuperAdmin } = useAuth();
  const { announcements, loading, approveAnnouncement, rejectAnnouncement, archiveAnnouncement, restoreAnnouncement, updateAnnouncement, deleteAnnouncementPermanently } = useAnnouncementManagement();
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    const aTime = a.submittedAt ? Date.parse(a.submittedAt as any) : 0;
    const bTime = b.submittedAt ? Date.parse(b.submittedAt as any) : 0;
    return bTime - aTime;
  });
  const navigate = useNavigate();

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const { showToast } = useToast();

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="badge badge-success">Approved</span>;
      case 'rejected':
        return <span className="badge badge-error">Rejected</span>;
      case 'pending':
      default:
        return <span className="badge badge-warning">Pending</span>;
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
  
    const now = Date.now();

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
            onClick={() => navigate('/admin/announcements/create')}
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

        {/* Tabs */}
        <div className="tabs tabs-lifted">
          <input type="radio" name="announcement-tabs" className="tab" aria-label="All" />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <h3 className="text-lg font-semibold mb-4">All ({baseAnnouncements.length})</h3>
            {baseAnnouncements.length === 0 ? (
              <div className="text-center py-8 text-base-content/60">No announcements</div>
            ) : (
              <div className="space-y-4">
                {baseAnnouncements.map((announcement) => (
                  <div key={announcement.announcementID} className="card bg-base-200">
                    <div className="card-body">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(announcement.type)}
                          <div className="flex-1">
                            <h4 className="font-semibold">{announcement.title}</h4>
                            <p className="text-sm text-base-content/70 mt-1">{announcement.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-base-content/60">
                              <span>Visible to: {announcement.visibleTo.join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setDeleteTarget(announcement)}
                          >
                            <XCircle className="w-4 h-4" />
                            Archive
                          </button>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-success"
                              checked={announcement.active !== false}
                              onChange={async (e) => {
                                if (announcement.archivedAt) return;

                                await updateAnnouncement(announcement.announcementID!, {
                                  active: e.target.checked
                                });
                              }}
                            />
                            <span>{announcement.active !== false ? "Active" : "Inactive"}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
            
          <input
            type="radio"
            name="announcement-tabs"
            className="tab"
            aria-label="Active"
            defaultChecked
          />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <h3 className="text-lg font-semibold mb-4">Active / Ongoing ({activeOngoingAnnouncements.length})</h3>
            {activeOngoingAnnouncements.length === 0 ? (
              <div className="text-center py-8 text-base-content/60">No active announcements</div>
            ) : (
              <div className="space-y-4">
                {activeOngoingAnnouncements.map((announcement) => (
                  <div key={announcement.announcementID} className="card bg-base-200">
                    <div className="card-body">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(announcement.type)}
                          <div className="flex-1">
                            <h4 className="font-semibold">{announcement.title}</h4>
                            <p className="text-sm text-base-content/70 mt-1">{announcement.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-base-content/60">
                              <span>Visible to: {announcement.visibleTo.join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setDeleteTarget(announcement)}
                          >
                            <XCircle className="w-4 h-4" />
                            Archive
                          </button>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-success"
                              checked={announcement.active !== false}
                              onChange={async (e) => {
                                await updateAnnouncement(announcement.announcementID!, {
                                  active: e.target.checked
                                });
                              }}
                            />
                            <span>{announcement.active !== false ? "Active" : "Inactive"}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input type="radio" name="announcement-tabs" className="tab" aria-label="Inactive" />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <h3 className="text-lg font-semibold mb-4">Inactive ({inactiveAnnouncements.length})</h3>
            {inactiveAnnouncements.length === 0 ? (
              <div className="text-center py-8 text-base-content/60">No inactive announcements</div>
            ) : (
              <div className="space-y-4">
                {inactiveAnnouncements.map((announcement) => (
                  <div key={announcement.announcementID} className="card bg-base-200">
                    <div className="card-body">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(announcement.type)}
                          <div className="flex-1">
                            <h4 className="font-semibold">{announcement.title}</h4>
                            <p className="text-sm text-base-content/70 mt-1">{announcement.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-base-content/60">
                              <span>Visible to: {announcement.visibleTo.join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setDeleteTarget(announcement)}
                          >
                            <XCircle className="w-4 h-4" />
                            Archive
                          </button>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-success"
                              checked={announcement.active !== false}
                              onChange={async (e) => {
                                await updateAnnouncement(announcement.announcementID!, {
                                  active: e.target.checked
                                });
                              }}
                            />
                            <span>{announcement.active !== false ? "Active" : "Inactive"}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            type="radio"
            name="announcement-tabs"
            className="tab"
            aria-label="Pending"
          />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Pending Approval ({pendingAnnouncements.length})</h3>
            {pendingAnnouncements.length === 0 ? (
              <div className="text-center py-8 text-base-content/60">
                No pending announcements
              </div>
            ) : (
              <div className="space-y-4">
                {pendingAnnouncements.map((announcement) => (
                  <div key={announcement.announcementID} className="card bg-base-200">
                    <div className="card-body">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(announcement.type)}
                          <div className="flex-1">
                            <h4 className="font-semibold">{announcement.title}</h4>
                            <p className="text-sm text-base-content/70 mt-1">{announcement.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-base-content/60">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Submitted {formatDate(announcement.submittedAt)}
                              </span>
                              <span>Visible to: {announcement.visibleTo.join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <button
                            className="btn btn-success btn-sm w-full sm:w-auto"
                            onClick={() => {
                              setSelectedAnnouncement(announcement);
                              setAction('approve');
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Approve</span>
                          </button>
                          <button
                            className="btn btn-error btn-sm w-full sm:w-auto"
                            onClick={() => {
                              setSelectedAnnouncement(announcement);
                              setAction('reject');
                            }}
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            type="radio"
            name="announcement-tabs"
            className="tab"
            aria-label="Approved"
          />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Approved Announcements ({approvedAnnouncements.length})</h3>
            {approvedAnnouncements.length === 0 ? (
              <div className="text-center py-8 text-base-content/60">
                No approved announcements
              </div>
            ) : (
              <div className="space-y-4">
                {approvedAnnouncements.map((announcement) => (
                  <div key={announcement.announcementID} className="card bg-base-200">
                    <div className="card-body">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(announcement.type)}
                          <div className="flex-1">
                            <h4 className="font-semibold">{announcement.title}</h4>
                            <p className="text-sm text-base-content/70 mt-1">{announcement.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-base-content/60">
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Approved {formatDate(announcement.reviewedAt)}
                              </span>
                              <span>Visible to: {announcement.visibleTo.join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <button
                            className="btn btn-error btn-sm w-full sm:w-auto"
                            onClick={() => setDeleteTarget(announcement)}
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Archive</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            type="radio"
            name="announcement-tabs"
            className="tab"
            aria-label="Rejected"
          />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Rejected Announcements ({rejectedAnnouncements.length})</h3>
            {rejectedAnnouncements.length === 0 ? (
              <div className="text-center py-8 text-base-content/60">
                No rejected announcements
              </div>
            ) : (
              <div className="space-y-4">
                {rejectedAnnouncements.map((announcement) => (
                  <div key={announcement.announcementID} className="card bg-base-200">
                    <div className="card-body">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(announcement.type)}
                          <div className="flex-1">
                            <h4 className="font-semibold">{announcement.title}</h4>
                            <p className="text-sm text-base-content/70 mt-1">{announcement.message}</p>
                            {announcement.reviewNotes && (
                              <div className="mt-2 p-2 bg-error/10 rounded text-sm">
                                <strong>Rejection reason:</strong> {announcement.reviewNotes}
                              </div>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-base-content/60">
                              <span className="flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                Rejected {formatDate(announcement.reviewedAt)}
                              </span>
                              <span>Visible to: {announcement.visibleTo.join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <button
                            className="btn btn-success btn-sm w-full sm:w-auto"
                            onClick={() => {
                              setSelectedAnnouncement(announcement);
                              setAction('approve');
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Approve</span>
                          </button>
                          <button
                            className="btn btn-error btn-sm w-full sm:w-auto"
                            onClick={() => setDeleteTarget(announcement)}
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Archive</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            type="radio"
            name="announcement-tabs"
            className="tab"
            aria-label="Archived"
          />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <h3 className="text-lg font-semibold mb-4">Archived Announcements ({archivedAnnouncements.length})</h3>
            {archivedAnnouncements.length === 0 ? (
              <div className="text-center py-8 text-base-content/60">No archived announcements</div>
            ) : (
              <div className="space-y-4">
                {archivedAnnouncements.map((announcement) => (
                  <div key={announcement.announcementID} className="card bg-base-200">
                    <div className="card-body">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(announcement.type)}
                          <div className="flex-1">
                            <h4 className="font-semibold">{announcement.title}</h4>
                            <p className="text-sm text-base-content/70 mt-1">{announcement.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-base-content/60">
                              <span>Visible to: {announcement.visibleTo.join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
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
                          >
                            Restore
                          </button>
                          
                          {/* permanent delete for debugging only */}
                          {/* <button
                            className="btn btn-error btn-sm"
                            onClick={async () => {
                              if (
                                confirm(
                                  "Permanently delete this announcement? This cannot be undone."
                                )
                              ) {
                                try {
                                  await deleteAnnouncementPermanently(
                                    announcement.announcementID!
                                  );

                                  showToast(
                                    "Announcement permanently deleted.",
                                    "error"
                                  );

                                } catch (error) {
                                  console.error(error);

                                  showToast(
                                    "Failed to permanently delete announcement.",
                                    "error"
                                  );
                                }
                              }
                            }}
                          >
                            Delete Permanently
                          </button> */}

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
        </dialog>
      )}
    </>
  );
}
