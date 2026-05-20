// TODO: unify table into one component with tracking page

import React from 'react';
import { logicEquipment } from './equipment/logicEquipment';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { isOngoing } from "../utils/requestTime"
import { collection, query, orderBy, limit, onSnapshot, where, doc as docRef, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Bell, X, Eye, XCircle, RotateCcw, Copy, MapPin, Clock, CheckCircle } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import MobileStatsPager from '../components/MobileStatsPager';
import { useRequests } from '../hooks/useRequests'
import AnnouncementBanner from '../components/AnnouncementBanner';
import { useAnnouncements } from '../hooks/useAnnouncements';

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(v: any) {
  try {
    if (!v) return ''
    let dt: Date
    if (v.toDate && typeof v.toDate === 'function') dt = v.toDate()
    else dt = new Date(v)
    return dt.toLocaleString()
  } catch (e) { return '' }
}

export default function HomeStudent() {
  const { user } = useAuth();
  const { announcements } = useAnnouncements();
  const { requests: trackingRequests } = useRequests(user?.uid)
  const [rows, setRows] = React.useState<any[]>([])
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [requests, setRequests] = React.useState<any[]>([]);
  const [tab, setTab] = React.useState<'all'|'pending'| 'ongoing' | 'approved' |'completed'|'rejected'|'cancelled'|'accountability'>('all');
  const [filter, setFilter] = React.useState<'all' | 'pending'| 'ongoing' | 'completed' | 'approved' | 'declined' | 'rejected_cancelled'>('all')
  const [notifOpen, setNotifOpen] = React.useState(false)
  const [notifAllOpen, setNotifAllOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<Array<any>>([])
  const [recentNotifications, setRecentNotifications] = React.useState<Array<any>>([])
  const [alertMessage, setAlertMessage] = React.useState<string | null>(null)
  const [accountabilities, setAccountabilities] = React.useState<any[]>([])
  const [accountabilityRequestInfo, setAccountabilityRequestInfo] = React.useState<Record<string, { purpose?: string; createdAt?: any }>>({})
  const { equipmentList, isLoading: isEquipmentLoading } = logicEquipment()
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null)
  const [showAllCount, setShowAllCount] = React.useState(5)
  const [showRemarksText, setShowRemarksText] = React.useState('')
  const [showRemarksOpen, setShowRemarksOpen] = React.useState(false)

  React.useEffect(() => {
    if (!trackingRequests || trackingRequests.length === 0) {
      setRows([])
      return
    }

    const docs = trackingRequests.map((req: any) => {
      const purpose = req.purpose || ''
      const status = req.status || 'pending'
      const remarks = req.rejectionReason || ''

      const totalQuantity = Array.isArray(req.items)
        ? req.items.reduce((s: any, i: any) => s + (i.qty || 0), 0)
        : 0

      const itemsList = Array.isArray(req.items)
        ? req.items.map((item: any) => {
            const equipment = equipmentList.find((e: any) => e.equipmentID === item.equipmentID)
            const itemName = equipment?.name || item.name || item.equipmentID || 'Unknown'
            return `${itemName}: ${item.qty || 0}`
          }).join(', ')
        : ''

      let duration = ''
      try {
        const sDate = req.startDate || ''
        const eDate = req.endDate || ''
        if (sDate || eDate) {
          const sd = new Date((sDate || eDate) + 'T00:00')
          const ed = new Date((eDate || sDate) + 'T23:59')

          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
            const diffMs = Math.max(0, ed.getTime() - sd.getTime())
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60)) % 24

            const parts: string[] = []
            if (diffDays > 0) parts.push(`${diffDays}d`)
            if (diffHours > 0) parts.push(`${diffHours}h`)

            duration = `${sd.toLocaleString()} → ${ed.toLocaleString()}${parts.length ? ` (${parts.join(' ')})` : ''}`
          }
        }
      } catch {}

      return {
        purpose,
        requestId: req.requestID || req.id, // IMPORTANT FIX
        status,
        remarks,
        sortKey: req.createdAt || '',
        duration,
        totalQuantity,
        itemsList,
        startDate: req.startDate,
        endDate: req.endDate,
        start: req.start,
        end: req.end,
      }
    })

    docs.sort((a, b) => (b.sortKey || '').localeCompare(a.sortKey || ''))
    setRows(docs)
  }, [trackingRequests, equipmentList])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

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

  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [showModalRequest, setShowModalRequest] = React.useState<any | null>(null)
  const [showAccountabilityModal, setShowAccountabilityModal] = React.useState<any | null>(null)
  // const { equipmentList, isLoading: isEquipmentLoading } = logicEquipment();
  // const isAccountabilityTab = tab === 'accountability'

  // reuse admin-style time formatter so modal matches admin modal formatting
  const formatTime = (t: any) => {
    if (!t) return '';
    try {
      if (typeof t === 'string') {
        if (/[ap]m/i.test(t)) return t.trim();
        const m = t.match(/^(\d{1,2}):(\d{2})$/);
        if (m) {
          let h = parseInt(m[1], 10);
          const min = m[2];
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          return `${h}:${min} ${ampm}`;
        }
      }
      const d = typeof t === 'string' || typeof t === 'number' ? new Date(t) : t;
      if (d && typeof d.toLocaleTimeString === 'function') {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
    } catch (e) {}
    return String(t);
  }

  const openRequestDetails = (requestId: string) => {
    const found = trackingRequests.find((r: any) => (r.requestID || r.id) === requestId)
    if (found) {
      setShowModalRequest({ ...found, id: requestId })
    } else {
      setShowModalRequest({ id: requestId })
    }
  }

  async function handleCancel(requestId: string) {
    if (!confirm('Cancel this request? This will mark it as cancelled.')) return
    try {
      setBusyId(requestId)
      await updateDoc(docRef(db, 'requests', requestId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
      })
      // snapshot will update the UI automatically
    } catch (e) {
      console.error('Failed to cancel request', e)
      setAlertMessage('Failed to cancel request. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReturn(requestId: string) {
    if (!confirm('Mark this request as returned? This will mark the item(s) as returned.')) return
    try {
      setBusyId(requestId)
      await updateDoc(docRef(db, 'requests', requestId), {
        status: 'returned',
        returnedAt: serverTimestamp(),
      })
    } catch (e) {
      console.error('Failed to mark request returned', e)
      setAlertMessage('Failed to mark returned. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  // mark current statuses as seen (store in localStorage)
  function markNotificationsSeen() {
    try {
  const seenMap: any = {};
  (requests || []).forEach((r:any) => { seenMap[r.id] = (r.status || 'ongoing').toString() })
      localStorage.setItem('studentSeenStatuses', JSON.stringify(seenMap))
      setRecentNotifications([])
    } catch (e) {
      console.warn('Failed to mark notifications seen', e)
    }
  }

  function toggleNotif() {
    const next = !notifOpen
    setNotifOpen(next)
    if (next) {
      // when opening, mark current statuses as seen so dot disappears
      markNotificationsSeen()
    }
  }

  const nav = useNavigate();

  // Stats
  const pendingCount = rows.filter(r => r.status?.toLowerCase() === 'pending').length
  const ongoingCount = rows.filter(r => r.status?.toLowerCase() === 'approved' && isOngoing(r)).length
  const approvedCount = rows.filter(r => r.status?.toLowerCase() === 'approved' && !isOngoing(r)).length
  const declinedCount = rows.filter(r => ['declined', 'rejected'].includes((r.status || '').toLowerCase())).length
  const rejectedCancelledCount = rows.filter(r => ['declined', 'rejected', 'cancelled'].includes((r.status || '').toLowerCase())).length
  const completedCount = rows.filter(r => ['completed', 'returned'].includes((r.status || '').toLowerCase())).length

  // Status badge helper
  const getStatusBadge = (r: any) => {
    const s = (r.status || '').toLowerCase();
    if (s === 'approved' && isOngoing(r)) return <span className="badge badge-success gap-1"><Clock className="w-3 h-3" />Ongoing</span>
    if (s === 'approved' && !isOngoing(r)) return <span className="badge badge-success gap-1"><CheckCircle className="w-3 h-3" />Approved</span>
    if (s === 'pending') return <span className="badge badge-warning gap-1"><Clock className="w-3 h-3" />Pending</span>
    if (s === 'declined' || s === 'rejected') return <span className="badge badge-error gap-1"><XCircle className="w-3 h-3" />Declined</span>
    if (s === 'returned' || s === 'completed') return <span className="badge badge-info gap-1"><RotateCcw className="w-3 h-3" />Returned</span>
    if (s === 'cancelled') return <span className="badge badge-neutral gap-1">Cancelled</span>
    return <span className="badge">{r.status}</span>;
  };

  const parseAccountabilityDetails = (details: string) => {
    return (details || '')
      .split(/[\n,]+/)
      .map(part => part.trim())
      .filter(Boolean)
  }

  const formatAccountabilityDetails = (details: string) => parseAccountabilityDetails(details).join(', ')

  const getAccountabilityBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase()
    if (s === 'resolved' || s === 'completed') return <span className="badge badge-success">Resolved</span>
    if (s === 'overdue') return <span className="badge badge-error">Overdue</span>
    return <span className="badge badge-warning capitalize">{status || 'Pending'}</span>
  }

  const getAccountabilityPurpose = (acc: any) => {
    if (!acc) return 'Accountability'
    const info = acc.requestId ? accountabilityRequestInfo[acc.requestId] : null
    return acc.purpose || info?.purpose || acc.reason || 'Accountability'
  }

  const getAccountabilityRequestedAt = (acc: any) => {
    if (!acc) return ''
    const info = acc.requestId ? accountabilityRequestInfo[acc.requestId] : null
    return formatDateTime(info?.createdAt || acc.createdAt) || (acc.due ? `Due ${acc.due}` : '')
  }

  React.useEffect(() => {
    if (!user) {
      setAccountabilities([])
      setAccountabilityRequestInfo({})
      return
    }
    const processSnapshot = (snap: any) => {
      const list: any[] = []
      snap.forEach((d: any) => {
        const data = d.data()
        const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : (data.dueDate ? new Date(data.dueDate) : null)
        list.push({
          id: d.id,
          due: dueDate ? dueDate.toLocaleDateString() : 'No date set',
          details: data.details || '',
          status: data.status || 'pending',
          reason: data.reason || '',
          createdAt: data.createdAt,
          requestId: data.requestId || null,
          purpose: data.purpose || '',
        })
      })
      setAccountabilities(list)
    }
    let unsubMain: (() => void) | null = null
    let unsubFallback: (() => void) | null = null
    try {
      const q = query(collection(db, 'accountabilities'), where('createdBy', '==', user.uid), orderBy('dueDate', 'asc'))
      unsubMain = onSnapshot(q, (snap) => processSnapshot(snap), (err) => {
        console.error('Student accountabilities snapshot error', err)
        try {
          const qf = query(collection(db, 'accountabilities'), where('createdBy', '==', user.uid))
          unsubFallback = onSnapshot(qf, (snap) => processSnapshot(snap), (err2) => console.error('Student accountabilities fallback error', err2))
        } catch (e) {
          console.error('Failed to subscribe accountabilities fallback', e)
        }
      })
    } catch (e) {
      console.error('Failed to subscribe accountabilities main', e)
      const qf = query(collection(db, 'accountabilities'), where('createdBy', '==', user.uid))
      unsubFallback = onSnapshot(qf, (snap) => processSnapshot(snap), (err2) => console.error('Student accountabilities fallback error', err2))
    }
    return () => { if (unsubMain) unsubMain(); if (unsubFallback) unsubFallback() }
  }, [user])

  React.useEffect(() => {
    const missingIds = Array.from(
      new Set(
        accountabilities
          .map(acc => acc.requestId)
          .filter((id): id is string => !!id && !accountabilityRequestInfo[id])
      )
    )
    if (!missingIds.length) return

    let cancelled = false
    ;(async () => {
      const updates: Record<string, { purpose?: string; createdAt?: any }> = {}
      await Promise.all(
        missingIds.map(async (requestId) => {
          try {
            const snap = await getDoc(docRef(db, 'requests', requestId))
            if (snap.exists()) {
              const data: any = snap.data()
              updates[requestId] = {
                purpose: data.purpose || '',
                createdAt: data.createdAt || data.createdAtClient || null,
              }
            } else {
              updates[requestId] = { purpose: '', createdAt: null }
            }
          } catch (e) {
            console.warn('Failed to load accountability request info', e)
            updates[requestId] = { purpose: '', createdAt: null }
          }
        })
      )

      if (!cancelled && Object.keys(updates).length > 0) {
        setAccountabilityRequestInfo(prev => ({ ...prev, ...updates }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [accountabilities, accountabilityRequestInfo])


  return (
    <>
      <LoadingOverlay show={isEquipmentLoading} message="Loading equipment data..." />
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        {alertMessage && (
          <div className="alert alert-error">
            <span>{alertMessage}</span>
            <button className="btn btn-sm" onClick={() => setAlertMessage(null)}>Close</button>
          </div>
        )}
        {/* Announcement Banner */}
        <AnnouncementBanner announcements={announcements} />
      {/* Header Section */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Student Dashboard</h1>
            <p className="text-base-content/70">Welcome, {user?.displayName ?? user?.email?.split('@')[0] ?? 'Student'}! Today is {formatDate(new Date())}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Notification dropdown */}
            <div className="relative shrink-0">
            <button className="btn btn-ghost btn-circle" onClick={toggleNotif}>
              <div className="indicator">
                <Bell className="w-5 h-5" />
                {recentNotifications.length > 0 && (
                  <span className="indicator-item badge badge-error badge-xs"></span>
                )}
              </div>
            </button>
            {notifOpen && (
              <>
                {/* Backdrop to close dropdown when clicking outside */}
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)}></div>
                <div className="absolute right-0 mt-2 bg-base-100 border border-base-300 rounded-box w-80 shadow-2xl z-50">
                  <div className="p-3 border-b border-base-300 bg-primary/10 flex items-center justify-between rounded-t-box">
                    <span className="font-semibold text-primary">Notifications</span>
                    <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setNotifOpen(false)}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-64 overflow-auto divide-y divide-base-200">
                    {recentNotifications.length === 0 ? (
                      notifications.length === 0 ? (
                        <div className="p-4 text-center text-base-content/60">No new notifications</div>
                      ) : (
                        notifications.slice(0, 4).map(n => (
                          <div
                            key={n.id}
                            className="p-3 hover:bg-primary/5 cursor-pointer transition-colors"
                            onClick={() => { try { localStorage.setItem('lastRequestId', n.id) } catch {} setNotifOpen(false); nav('/tracking') }}
                          >
                            <div className="font-medium text-sm text-base-content">{n.purpose || 'Request update'}</div>
                            <div className="text-xs text-base-content/70 mt-1">{n.status}</div>
                          </div>
                        ))
                      )
                    ) : (
                      recentNotifications.slice(0, 4).map(n => (
                        <div
                          key={n.id}
                          className="p-3 hover:bg-primary/5 cursor-pointer transition-colors bg-warning/5"
                          onClick={() => { try { localStorage.setItem('lastRequestId', n.id) } catch {} setNotifOpen(false); nav('/tracking') }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="badge badge-warning badge-xs">New</span>
                            <span className="font-medium text-sm text-base-content">{n.purpose || 'Request update'}</span>
                          </div>
                          <div className="text-xs text-base-content/70 mt-1">{n.oldStatus} → {n.status}{n.actionAt ? ` · ${n.actionAt}` : ''}</div>
                          {n.adminRemarks && (
                            <div className="text-xs mt-1 text-base-content/60 italic">Remarks: {n.adminRemarks}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-base-300 bg-base-200/50 rounded-b-box">
                    <button className="btn btn-primary btn-sm btn-block" onClick={() => { setNotifOpen(false); setNotifAllOpen(true); }}>
                      View all notifications
                    </button>
                  </div>
                </div>
              </>
            )}
            </div>
            <button className="btn btn-primary btn-sm min-h-11" onClick={() => nav("/requestpage")}>
              + Request Equipment
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <MobileStatsPager
        breakpoint="lg"
        items={[
          { label: "Total", value: trackingRequests.length },
          { label: "Pending", value: trackingRequests.filter(r => (r.status).toLowerCase() === 'pending').length, colorClass: "text-warning" },
          { label: "Approved", value: trackingRequests.filter(r => r.status?.toLowerCase() === 'approved').length, colorClass: "text-success" },
          { label: "Ongoing", value: trackingRequests.filter(r => r.status?.toLowerCase() === 'approved' && isOngoing(r)).length, colorClass: "text-success" },
          { label: "Completed", value: trackingRequests.filter(r => ['completed', 'returned'].includes((r.status || '').toLowerCase())).length, colorClass: "text-info" },
          { label: "Accountabilities", value: accountabilities.filter(a => { const s = (a.status || '').toLowerCase(); return s !== 'resolved' && s !== 'completed'; }).length, colorClass: "text-error" },
        ]}
      />
      <div className="hidden lg:flex stats stats-horizontal shadow bg-base-200 w-full">
        <div className="stat">
          <div className="stat-title">Total Requests</div>
          <div className="stat-value">{trackingRequests.length}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Pending</div>
          <div className="stat-value text-warning">{trackingRequests.filter(r => (r.status).toLowerCase() === 'pending').length}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Approved</div>
          <div className="stat-value text-success">{trackingRequests.filter(r => r.status?.toLowerCase() === 'approved').length}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Ongoing</div>
          <div className="stat-value text-success">{trackingRequests.filter(r => r.status?.toLowerCase() === 'approved' && isOngoing(r)).length}</div>
      
        </div>
        <div className="stat">
          <div className="stat-title">Completed</div>
          <div className="stat-value text-info">{trackingRequests.filter(r => ['completed', 'returned'].includes((r.status || '').toLowerCase())).length}</div>
          
        </div>
        <div className="stat cursor-pointer hover:bg-base-300 hover:scale-100 active:scale-95 transition-all duration-200 overflow-hidden" onClick={() => nav('/accountabilities')}>
          <div className="stat-title">Accountabilities</div>

          <div className="stat-value text-error">
            { accountabilities.filter(a => {
              const s = (a.status || '').toLowerCase()
              return s !== 'resolved' && s !== 'completed'
              }).length
            }
          </div>
        
      </div>
      </div>

      {/* Requests Table Card */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body p-0">
          {/* Tabs Header */}
          <div className="p-4 border-b border-base-300">
            <div className="overflow-x-auto">
              <div role="tablist" className="tabs tabs-boxed bg-base-300 w-fit whitespace-nowrap">
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'all' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => { setFilter('all'); setShowAllCount(5); }}>
                All ({rows.length})
              </a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'pending' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setFilter('pending')}>
                Pending ({pendingCount})
              </a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'approved' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setFilter('approved')}>
                Approved ({approvedCount})
              </a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${filter === 'ongoing' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setFilter('ongoing')}>
                Ongoing ({ongoingCount})
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
            {filteredRows.length === 0 ? (
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
              (filter === 'all' ? filteredRows.slice(0, showAllCount) : filteredRows).map((r: any, idx: number) => (
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
                        onClick={() => openRequestDetails(r.requestId)}
                      >
                        View details
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Purpose</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Action</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
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
                  (filter === 'all' ? filteredRows.slice(0, showAllCount) : filteredRows).map((r, idx) => (
                    <tr
                      key={r.requestId || idx}
                      id={`req-${r.requestId}`}
                      className={`hover ${highlightedId === r.requestId ? 'bg-primary/20 animate-pulse' : ''}`}
                    >

                      {/* Purpose */}
                      <td className="max-w-md">
                        <div className="font-medium">{r.purpose || 'Untitled Request'}</div>
                        {r.duration && (
                          <div className="text-xs text-base-content/60 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {r.duration}
                          </div>
                        )}
                      </td>

                      {/* Quantity */}
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

                      {/* Status */}
                      <td>
                        {getStatusBadge(r)}
                      </td>

                      {/* Action */}
                      <td>
                        {(r.status || '').toLowerCase() === 'approved' ? (
                          <button
                            className="btn btn-success btn-sm gap-2"
                            onClick={() => handleReturn(r.requestId)}
                            disabled={busyId === r.requestId}
                          >
                            <RotateCcw className="w-4 h-4" />
                            {busyId === r.requestId
                              ? 'Returning...'
                              : 'Return'}
                          </button>
                        ) : (
                          <span className="text-base-content/40 text-sm">
                            —
                          </span>
                        )}
                      </td>

                      {/* View */}
                      <td>
                        <button
                          className="btn btn-ghost btn-sm btn-circle"
                          onClick={() => openRequestDetails(r.requestId)}
                        >
                          <Eye className='w-4 h-4' />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filter === 'all' && filteredRows.length > showAllCount && (
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

      {/* Request Details Modal */}
      {showModalRequest && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setShowModalRequest(null)} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-lg mb-4">Request Details</h3>
            
            <div className="text-xs text-base-content/60">Request ID</div>
            <div className="font-mono text-sm mb-4 bg-base-300 p-2 rounded break-all">{showModalRequest.id}</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Requester</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{showModalRequest.createdByName || showModalRequest.createdBy || '-'}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Requested At</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{formatDateTime(showModalRequest.createdAt)}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Adviser / Leader</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{showModalRequest.adviser || '-'}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Status</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{getStatusBadge(showModalRequest)}</div>
              </div>
              <div className="form-control md:col-span-2">
                <label className="label"><span className="label-text text-xs">Purpose</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{showModalRequest.purpose || '-'}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Start</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{showModalRequest.startDate} {formatTime(showModalRequest.start)}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">End</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{showModalRequest.endDate} {formatTime(showModalRequest.end)}</div>
              </div>
              <div className="form-control md:col-span-2">
                <label className="label"><span className="label-text text-xs">Items</span></label>
                <div className="bg-base-300 p-2 rounded">
                  <ul className="space-y-1">
                    {showModalRequest.items?.map((item: any) => {
                      const equipment = equipmentList.find((e: any) => e.equipmentID === item.equipmentID);
                      return (
                        <li key={item.equipmentID} className="flex justify-between text-sm">
                          <span>{equipment?.name || item.name || item.equipmentID}</span>
                          <span className="badge badge-sm">{item.qty} pcs</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="divider my-2"></div>
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total</span>
                    <span>{(showModalRequest.items || []).reduce((acc: any, i: any) => acc + (i.qty || 0), 0)} pcs</span>
                  </div>
                </div>
              </div>
              <div className="form-control md:col-span-2">
                <label className="label"><span className="label-text text-xs">Admin Remarks</span></label>
                <div className="bg-base-300 p-2 rounded text-sm whitespace-pre-wrap">{showModalRequest.declinedRemarks || showModalRequest.remarks || '—'}</div>
              </div>
            </div>
            
            <div className="modal-action">
              {(showModalRequest.status || '').toLowerCase() === 'approved' && (
                <button
                  className="btn btn-success gap-2"
                  onClick={() => handleReturn(showModalRequest.id)}
                  disabled={busyId === showModalRequest.id}
                >
                  <RotateCcw className="w-4 h-4" />
                  {busyId === showModalRequest.id ? 'Returning...' : 'Return Equipment'}
                </button>
              )}

              <button
                className="btn"
                onClick={() => setShowModalRequest(null)}
              >
                Close
              </button>
            </div>

          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowModalRequest(null)}>close</button>
          </form>
        </dialog>
      )}

      {/* Accountability Details Modal */}
      {showAccountabilityModal && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setShowAccountabilityModal(null)} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-lg mb-4">Accountability Details</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Purpose</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{getAccountabilityPurpose(showAccountabilityModal)}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Reason / Notes</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{showAccountabilityModal.reason || 'Accountability'}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Requested</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{getAccountabilityRequestedAt(showAccountabilityModal) || '—'}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Due Date</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{showAccountabilityModal.due}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Details</span></label>
                <div className="bg-base-300 p-2 rounded text-sm whitespace-pre-wrap">
                  {formatAccountabilityDetails(showAccountabilityModal.details) || 'No details provided'}
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Status</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{getAccountabilityBadge(showAccountabilityModal.status)}</div>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowAccountabilityModal(null)}>Close</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowAccountabilityModal(null)}>close</button>
          </form>
        </dialog>
      )}

      {/* View All Notifications Modal */}
      {notifAllOpen && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setNotifAllOpen(false)} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-lg mb-4">All Notifications</h3>
            
            <div className="divide-y divide-base-300 max-h-96 overflow-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-base-content/60">No notifications</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="py-3">
                    <div className="font-medium">{n.purpose || 'Request update'}</div>
                    <div className="text-sm text-base-content/60">{n.oldStatus} → {n.status}{n.actionAt ? ` · ${n.actionAt}` : ''}</div>
                    {n.adminRemarks && (
                      <div className="text-sm mt-1 p-2 bg-base-300 rounded">
                        <span className="text-xs text-base-content/60">Remarks:</span>
                        <p className="whitespace-pre-wrap">{n.adminRemarks}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="modal-action">
              <button className="btn" onClick={() => setNotifAllOpen(false)}>Close</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setNotifAllOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
    </>
  );
}
