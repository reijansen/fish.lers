// TODO: unify table into one component with home-student

import React from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useRequests } from '../../hooks/useRequests'
import { isOngoing } from "../../utils/requestTime"
import { logicEquipment } from '../equipment/logicEquipment'
import { MapPin, Clock, CheckCircle, XCircle, AlertCircle, FileText, X, Eye, Copy, RotateCcw, Timer } from 'lucide-react'
import MobileStatsPager from '../../components/MobileStatsPager'

export default function TrackingPage(){
  const { user } = useAuth()
  const { requests, isLoading } = useRequests(user?.uid)
  const [rows, setRows] = React.useState<Array<any>>([])
  const [filter, setFilter] = React.useState<'all' | 'pending'| 'ongoing' | 'completed' | 'approved' | 'declined' | 'rejected_cancelled'>('all')
  const [searchTerm, setSearchTerm] = React.useState('')
  
  const [showRemarksOpen, setShowRemarksOpen] = React.useState(false)
  const [showRemarksText, setShowRemarksText] = React.useState('')
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [showAllCount, setShowAllCount] = React.useState(5)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [detailsRow, setDetailsRow] = React.useState<any | null>(null)
  const { equipmentList, isLoading: isEquipmentLoading } = logicEquipment()

  /**
   * Transform API requests into row format for display.
   */
  React.useEffect(() => {
    if (!requests || requests.length === 0) {
      setRows([]);
      return;
    }

    const docs = requests.map((req) => {
      const purpose = req.purpose || '';
      const status = req.status || 'pending';
      const remarks = req.rejectionReason || '';

      // Calculate total quantity
      const totalQuantity = Array.isArray(req.items) ? req.items.reduce((s: any, i: any) => s + (i.qty || 0), 0) : 0;

      // Get detailed items list for tooltip
      const itemsList = Array.isArray(req.items) ? req.items.map((item: any) => {
        const equipment = equipmentList.find((e: any) => e.equipmentID === item.equipmentID);
        const itemName = equipment?.name || item.name || item.equipmentID || 'Unknown';
        return `${itemName}: ${item.qty || 0}`;
      }).join(', ') : '';

      // Compute human-friendly duration from startDate/endDate
      let duration = '';
      try {
        const sDate = req.startDate || '';
        const eDate = req.endDate || '';
        if (sDate || eDate) {
          const startIso = (sDate || eDate) + 'T00:00';
          const endIso = (eDate || sDate) + 'T23:59';
          const sd = new Date(startIso);
          const ed = new Date(endIso);
          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
            const diffMs = Math.max(0, ed.getTime() - sd.getTime());
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60)) % 24;
            const parts: string[] = [];
            if (diffDays > 0) parts.push(`${diffDays}d`);
            if (diffHours > 0) parts.push(`${diffHours}h`);
            duration = `${sd.toLocaleString()} → ${ed.toLocaleString()}${parts.length ? ` (${parts.join(' ')})` : ''}`;
          }
        }
      } catch (e) {
        duration = '';
      }

      return {
        purpose,
        requestId: req.requestID || '',
        status,
        remarks,
        sortKey: req.createdAt || '',
        startDate: req.startDate,
        endDate: req.endDate,
        duration,
        totalQuantity,
        itemsList,
        items: req.items || [],
      };
    });

    // Sort by date descending (newest first)
    docs.sort((a, b) => (b.sortKey || '').localeCompare(a.sortKey || ''));
    setRows(docs);
  }, [requests, equipmentList]);

  // Highlight row if navigated from a notification (lastRequestId in localStorage)
  React.useEffect(() => {
    try {
      const id = typeof window !== 'undefined' ? localStorage.getItem('lastRequestId') : null
      if (!id) return
      // wait until rows are loaded and the requested id exists
      const found = rows.find(r => r.requestId === id)
      if (!found) return
      setHighlightedId(id)
      // scroll to the element if present
      setTimeout(() => {
        const el = document.getElementById(`req-${id}`)
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      // clear highlight after 1s
      const t = setTimeout(() => {
        setHighlightedId(null)
        try { localStorage.removeItem('lastRequestId') } catch (e) { /* ignore */ }
      }, 1000)
      return () => clearTimeout(t)
    } catch (e) {
      // ignore
    }
  }, [rows])

  // Filter rows
  const filteredRows = rows.filter(r => {
    const s = (r.status || '').toLowerCase()
    if (filter === 'all') return true
    if (filter === 'pending') return s === 'pending'
    if (filter === 'ongoing') return s === 'approved' && isOngoing(r)
    if (filter === 'approved') return s === 'approved' && !isOngoing(r)
    if (filter === 'completed') return s === 'completed' || s === 'returned'
    if (filter === 'declined') return s === 'declined' || s === 'rejected'
    if (filter === 'rejected_cancelled') return s === 'declined' || s === 'rejected' || s === 'cancelled'
    return true
  })

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visibleRows = React.useMemo(() => {
    if (!normalizedSearch) return filteredRows
    return filteredRows.filter(r => {
      return (
        (r.purpose || '').toLowerCase().includes(normalizedSearch) ||
        (r.itemsList || '').toLowerCase().includes(normalizedSearch) ||
        (r.requestId || '').toLowerCase().includes(normalizedSearch)
      )
    })
  }, [filteredRows, normalizedSearch])

  // Stats
  const pendingCount = rows.filter(r => r.status?.toLowerCase() === 'pending').length
  const ongoingCount = rows.filter(r => r.status?.toLowerCase() === 'approved' && isOngoing(r)).length
  const approvedCount = rows.filter(r => r.status?.toLowerCase() === 'approved' && !isOngoing(r)).length
  const declinedCount = rows.filter(r => ['declined', 'rejected'].includes((r.status || '').toLowerCase())).length
  const rejectedCancelledCount = rows.filter(r => ['declined', 'rejected', 'cancelled'].includes((r.status || '').toLowerCase())).length
  const completedCount = rows.filter(r => ['completed', 'returned'].includes((r.status || '').toLowerCase())).length

  // Status badge helper
  const getStatusBadge = (r: any) => {
    const s = (r.status || '').toLowerCase()

    if (s === 'approved' && isOngoing(r)) return <span className="badge badge-success gap-1"><Clock className="w-3 h-3" />Ongoing</span>
    if (s === 'approved' && !isOngoing(r)) return <span className="badge badge-success gap-1"><CheckCircle className="w-3 h-3" />Approved</span>
    if (s === 'pending') return <span className="badge badge-warning gap-1"><Clock className="w-3 h-3" />Pending</span>
    if (s === 'declined' || s === 'rejected') return <span className="badge badge-error gap-1"><XCircle className="w-3 h-3" />Declined</span>
    if (s === 'returned' || s === 'completed') return <span className="badge badge-info gap-1"><RotateCcw className="w-3 h-3" />Returned</span>
    if (s === 'cancelled') return <span className="badge badge-neutral gap-1">Cancelled</span>
    return <span className="badge badge-ghost">{r.status}</span>
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="w-6 h-6" />
          Request Tracking
        </h1>
        <p className="text-base-content/70">Monitor the status of your equipment requests</p>
        <label className="input input-bordered min-h-11 flex items-center gap-2 w-full sm:max-w-md">
          <SearchIcon />
          <input
            type="text"
            className="grow"
            placeholder="Search purpose, item, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
      </div>

      {/* Stats */}
      <MobileStatsPager
        breakpoint="sm"
        items={[
          { label: "Total", value: rows.length },
          { label: "Pending", value: pendingCount, colorClass: "text-warning" },
          { label: "Approved", value: approvedCount, colorClass: "text-success" },
          { label: "Ongoing", value: ongoingCount, colorClass: "text-success"},
          { label: "Completed", value: completedCount, colorClass: "text-success" },
          { label: "Declined", value: declinedCount, colorClass: "text-error" },
        ]}
      />
      <div className="hidden sm:flex stats stats-horizontal shadow bg-base-200 w-full">
        <div className="stat">
          <div className="stat-title">Total Requests</div>
          <div className="stat-value">{rows.length}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Pending</div>
          <div className="stat-value text-warning">{pendingCount}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Approved</div>
          <div className="stat-value text-success">{approvedCount}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Ongoing</div>
          <div className="stat-value text-success">{ongoingCount}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Completed</div>
          <div className="stat-value text-success">{completedCount}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Declined</div>
          <div className="stat-value text-error">{declinedCount}</div>
          
        </div>
      </div>

      {/* Table Card */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body p-0">
          {/* Filter Tabs */}
          <div className="p-4 border-b border-base-300">
            <div className="overflow-x-auto">
              <div role="tablist" className="tabs tabs-boxed bg-base-300 w-fit whitespace-nowrap">
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'all' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => { setFilter('all'); setShowAllCount(5); }}>
                All ({rows.length})
              </a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'pending' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setFilter('pending')}>
                Pending ({pendingCount})
              </a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'ongoing' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setFilter('ongoing')}>
                Ongoing ({ongoingCount})
              </a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'approved' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setFilter('approved')}>
                Approved ({approvedCount})
              </a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'completed' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setFilter('completed')}>
                Completed ({completedCount})
              </a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'rejected_cancelled' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setFilter('rejected_cancelled')}>
                Unfulfilled ({rejectedCancelledCount})
              </a>
            </div>
            </div>
          </div>

          {/* Mobile list */}
          <div className="lg:hidden p-3 sm:p-4 space-y-3">
            {visibleRows.length === 0 ? (
              <div className="text-center py-10 text-base-content/60">
                <MapPin className="w-12 h-12 mx-auto opacity-30" />
                <p className="font-medium mt-2">No requests found</p>
                <p className="text-sm">
                  {filter === 'all'
                    ? "You haven't made any requests yet"
                    : filter === 'rejected_cancelled'
                    ? 'No rejected or cancelled requests'
                    : `No ${filter} requests`}
                </p>
              </div>
            ) : (
              (filter === 'all' ? visibleRows.slice(0, showAllCount) : visibleRows).map((r: any, idx: number) => (
                <div
                  key={r.requestId || idx}
                  id={`req-${r.requestId}`}
                  className={`card bg-base-100 border border-base-300 shadow-sm ${
                    highlightedId === r.requestId ? 'ring-2 ring-primary/40 animate-pulse' : ''
                  }`}
                >
                  <div className="card-body p-4 gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{r.purpose || 'Untitled Request'}</div>
                        {r.duration ? (
                          <div className="text-xs text-base-content/60 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span className="truncate">{r.duration}</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0">{getStatusBadge(r)}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70">
                      <span className="badge badge-ghost">Qty: {r.totalQuantity || '-'}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs gap-1"
                        onClick={() => copyToClipboard(r.requestId)}
                        aria-label="Copy request ID"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedId === r.requestId ? 'Copied' : 'Copy ID'}
                      </button>
                    </div>

                    {r.remarks ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm w-full gap-2"
                        onClick={() => { setShowRemarksText(r.remarks); setShowRemarksOpen(true); }}
                      >
                        <Eye className="w-4 h-4" />
                        View admin remarks
                      </button>
                    ) : null}

                    <div className="card-actions justify-end">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm w-full sm:w-auto"
                        onClick={() => { setDetailsRow(r); setDetailsOpen(true); }}
                      >
                        View details
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Purpose</th>
                  <th>Quantity</th>
                  <th>Request ID</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-base-content/60">
                        <MapPin className="w-12 h-12 opacity-30" />
                        <p className="font-medium">No requests found</p>
                        <p className="text-sm">
                          {filter === 'all' 
                            ? "You haven't made any requests yet" 
                            : filter === 'rejected_cancelled'
                            ? 'No rejected or cancelled requests'
                            : `No ${filter} requests`}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (filter === 'all' ? visibleRows.slice(0, showAllCount) : visibleRows).map((r, idx) => (
                    <tr
                      key={r.requestId || idx}
                      id={`req-${r.requestId}`}
                      className={`hover ${highlightedId === r.requestId ? 'bg-primary/20 animate-pulse' : ''}`}
                    >
                      <td className="max-w-md">
                        <div className="font-medium">{r.purpose || 'Untitled Request'}</div>
                        {r.duration && (
                          <div className="text-xs text-base-content/60 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {r.duration}
                          </div>
                        )}
                      </td>
                      <td>
                        {r.itemsList ? (
                          <div className="tooltip" data-tip={r.itemsList}>
                            <span className="badge badge-ghost cursor-help">
                              {r.totalQuantity || '-'}
                            </span>
                          </div>
                        ) : (
                          <span className="badge badge-ghost">
                            {r.totalQuantity || '-'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-base-300 px-2 py-1 rounded font-mono">
                            {r.requestId?.slice(0, 8)}...
                          </code>
                          <button
                            className="btn btn-ghost btn-xs btn-circle tooltip"
                            data-tip={copiedId === r.requestId ? 'Copied!' : 'Copy ID'}
                            onClick={() => copyToClipboard(r.requestId)}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td>{getStatusBadge(r)}</td>
                      <td>
                        {r.remarks ? (
                          <button 
                            className="btn btn-ghost btn-sm gap-1" 
                            onClick={() => { setShowRemarksText(r.remarks); setShowRemarksOpen(true); }}
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        ) : (
                          <span className="text-sm text-base-content/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filter === 'all' && visibleRows.length > showAllCount && (
            <div className="p-4 border-t border-base-300 flex justify-center">
              <button 
                className="btn btn-primary btn-outline"
                onClick={() => setShowAllCount(showAllCount + 5)}
              >
                Show more
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Remarks Modal */}
      {showRemarksOpen && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <button 
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
              onClick={() => { setShowRemarksOpen(false); setShowRemarksText(''); }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Admin Remarks
            </h3>
            <div className="py-4">
              <div className="bg-base-200 p-4 rounded-lg whitespace-pre-wrap text-sm">
                {showRemarksText}
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => { setShowRemarksOpen(false); setShowRemarksText(''); }}>
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => { setShowRemarksOpen(false); setShowRemarksText(''); }}>close</button>
          </form>
        </dialog>
      )}

      {/* Details Modal */}
      {detailsOpen && detailsRow && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-lg truncate">{detailsRow.purpose || 'Request details'}</h3>
                  <div className="text-xs text-base-content/60 mt-1 break-all">
                    Request ID: <span className="font-mono">{detailsRow.requestId}</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-start gap-2">
                  {getStatusBadge(detailsRow)}
                  <button
                    type="button"
                    className="btn btn-sm btn-circle btn-ghost"
                    onClick={() => { setDetailsOpen(false); setDetailsRow(null); }}
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {detailsRow.duration ? (
                <div className="alert bg-base-200 border border-base-300">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{detailsRow.duration}</span>
                </div>
              ) : null}

              <div className="card bg-base-200 border border-base-300 shadow-sm">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">Items</div>
                    <span className="badge badge-ghost">Total qty: {detailsRow.totalQuantity || 0}</span>
                  </div>
                  {detailsRow.itemsList ? (
                    <div className="text-sm text-base-content/80 mt-2 whitespace-pre-wrap">
                      {detailsRow.itemsList}
                    </div>
                  ) : (
                    <div className="text-sm text-base-content/60 mt-2">No items found.</div>
                  )}
                </div>
              </div>

              {detailsRow.remarks ? (
                <div className="card bg-base-200 border border-base-300 shadow-sm">
                  <div className="card-body p-4">
                    <div className="font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-warning" />
                      Admin remarks
                    </div>
                    <div className="text-sm mt-2 whitespace-pre-wrap">{detailsRow.remarks}</div>
                  </div>
                </div>
              ) : null}

              <div className="modal-action">
                <button className="btn w-full sm:w-auto" onClick={() => { setDetailsOpen(false); setDetailsRow(null); }}>
                  Close
                </button>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => { setDetailsOpen(false); setDetailsRow(null); }}>close</button>
          </form>
        </dialog>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="opacity-60"
      aria-hidden="true"
    >
      <path
        d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
