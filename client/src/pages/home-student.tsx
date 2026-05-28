// TODO: unify table into one component with tracking page

import React from 'react';
import { logicEquipment } from './equipment/logicEquipment';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, where, doc as docRef, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Bell, X, Eye, XCircle, RotateCcw, Copy, MapPin, Clock, CheckCircle } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import MobileStatsPager from '../components/MobileStatsPager';
import { useRequests } from '../hooks/useRequests'
import * as requestsApi from '../api/requests.api'
import AnnouncementBanner from '../components/AnnouncementBanner';
import { useAnnouncements } from '../hooks/useAnnouncements';
import ConfirmDialog from '../components/confirmDialog';

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
  const accountabilitiesByQueryRef = React.useRef<Record<string, Record<string, any>>>({})
  const { equipmentList, isLoading: isEquipmentLoading } = logicEquipment()
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null)
  const [showAllCount, setShowAllCount] = React.useState(5)
  const [showRemarksText, setShowRemarksText] = React.useState('')
  const [showRemarksOpen, setShowRemarksOpen] = React.useState(false)
  const [getModalRequest, setGetModalRequest] = React.useState<any | null>(null)
  const [staffName, setStaffName] = React.useState('')
  const [returnModalRequest, setReturnModalRequest] = React.useState<any | null>(null)
  const [returnStaffName, setReturnStaffName] = React.useState('')

  const openConfirm = (
    title: string,
    message: string,
    action: () => Promise<void> | void,
    confirmClass = "btn-primary"
  ) => {
    setConfirmData({ title, message, action, confirmClass });
    setConfirmOpen(true);
  };

  React.useEffect(() => {
    if (!trackingRequests || trackingRequests.length === 0) {
      setRows([])
      return
    }

    const toDateLabel = (ymd: string) => {
      const match = (ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!match) return ymd
      const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      if (Number.isNaN(d.getTime())) return ymd
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    }

    const toTimeLabel = (t: any) => {
      if (!t) return ""
      try {
        if (typeof t === "string") {
          if (/[ap]m/i.test(t)) return t.trim()
          const m = t.match(/^(\d{1,2}):(\d{2})$/)
          if (m) {
            let h = parseInt(m[1], 10)
            const min = m[2]
            const ampm = h >= 12 ? "PM" : "AM"
            h = h % 12 || 12
            return `${h}:${min} ${ampm}`
          }
        }
      } catch {}
      return String(t)
    }

    const formatUsageRange = (req: any) => {
      const sDate = (req?.startDate || "").trim()
      const eDate = (req?.endDate || "").trim()
      if (!sDate && !eDate) return ""

      const sdStr = sDate || eDate
      const edStr = eDate || sDate

      const datePart = sdStr === edStr ? toDateLabel(sdStr) : `${toDateLabel(sdStr)} to ${toDateLabel(edStr)}`
      const timePart =
        req?.start || req?.end ? `${toTimeLabel(req?.start || "00:00")}–${toTimeLabel(req?.end || "23:59")}` : ""

      let durationPart = ""
      try {
        const sd = new Date(`${sdStr}T00:00:00`)
        const ed = new Date(`${edStr}T23:59:00`)
        if (!Number.isNaN(sd.getTime()) && !Number.isNaN(ed.getTime())) {
          const diffMs = Math.max(0, ed.getTime() - sd.getTime())
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60)) % 24
          const parts: string[] = []
          if (diffDays > 0) parts.push(`${diffDays}d`)
          if (diffHours > 0) parts.push(`${diffHours}h`)
          durationPart = parts.length ? ` (${parts.join(" ")})` : ""
        }
      } catch {}

      return `${datePart}${timePart ? ` • ${timePart}` : ""}${durationPart}`
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

      const duration = formatUsageRange(req)

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

  React.useEffect(() => {
    const normalized = (trackingRequests || []).map((req: any) => ({
      ...req,
      id: req.id || req.requestID || "",
    })).filter((req: any) => !!req.id)
    setRequests(normalized)
  }, [trackingRequests])

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
      if (filter === 'ongoing') return s === 'ongoing'
      if (filter === 'approved') return s === 'approved'
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

  const formatUsageDate = (value?: string) => {
    if (!value) return "—";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const parsed = new Date(year, month, day);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const openRequestDetails = (requestId: string) => {
    const found = trackingRequests.find((r: any) => (r.requestID || r.id) === requestId)
    if (found) {
      setShowModalRequest({ ...found, id: requestId })
    } else {
      setShowModalRequest({ id: requestId })
    }
  }

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const [confirmData, setConfirmData] = React.useState<{
    title: string;
    message: string;
    action: () => Promise<void> | void;
    confirmClass?: string;
  } | null>(null);

  async function handleCancel(requestId: string) {
    // if (!confirm('Cancel this request? This will mark it as cancelled.')) return
    openConfirm(
      "Cancel Request",
      "Cancel this request? This will mark it as cancelled.",
      async () => {
        try {
          setBusyId(requestId);
          await updateDoc(docRef(db, 'requests', requestId), {
            status: 'cancelled',
            cancelledAt: serverTimestamp(),
          });
          window.location.reload();
        } catch (e) {
          console.error('Failed to cancel request', e);
          setAlertMessage('Failed to cancel request. Please try again.');
        } finally {
          setBusyId(null);
        }
      },
      "btn-error"
    );
  }

  async function handleReturn(requestId: string, handedTo: string) {
    if (!handedTo.trim()) {
      setAlertMessage('Please enter the staff name who received the equipment.')
      return
    }
    try {
      setBusyId(requestId);
      await requestsApi.markReturned(requestId);
      try {
        await requestsApi.updateRequest(requestId, {
          status: 'returned',
          returnedToStaffName: handedTo.trim(),
          returnedAtClient: new Date().toISOString() as any,
        } as any);
      } catch (metaErr) {
        console.warn('Marked returned but failed to save staff metadata:', metaErr);
      }
      setReturnModalRequest(null)
      setReturnStaffName('')
      window.location.reload();
    } catch (e) {
      console.error('Failed to mark request returned', e);
      setAlertMessage('Failed to mark returned. Please try again.');
    } finally {
      setBusyId(null);
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
  const ongoingCount = rows.filter(r => r.status?.toLowerCase() === 'ongoing').length
  const approvedCount = rows.filter(r => r.status?.toLowerCase() === 'approved').length
  const declinedCount = rows.filter(r => ['declined', 'rejected'].includes((r.status || '').toLowerCase())).length
  const rejectedCancelledCount = rows.filter(r => ['declined', 'rejected', 'cancelled'].includes((r.status || '').toLowerCase())).length
  const resolvedAccountabilities = accountabilities.filter((a) => {
    const s = (a.status || '').toLowerCase()
    return s === 'resolved' || s === 'completed'
  })
  const completedCount =
    rows.filter(r => ['completed', 'returned'].includes((r.status || '').toLowerCase())).length +
    resolvedAccountabilities.length

  // Status badge helper
  const getStatusBadge = (r: any) => {
    const s = (r.status || '').toLowerCase();
    if (s === 'ongoing') return <span className="badge badge-success gap-1"><Clock className="w-3 h-3" />Ongoing</span>
    if (s === 'approved') return <span className="badge badge-success gap-1"><CheckCircle className="w-3 h-3" />Approved</span>
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

  async function handleGet(requestId: string, issuedBy: string) {
    if (!issuedBy.trim()) {
      setAlertMessage('Please enter the staff name who handed the equipment.')
      return
    }
    try {
      setBusyId(requestId);
      await requestsApi.markOngoing(requestId);
      try {
        await requestsApi.updateRequest(requestId, {
          status: 'ongoing',
          ...(issuedBy.trim() ? { issuedByStaffName: issuedBy.trim() } : {}),
          claimedAt: new Date().toISOString() as any,
        } as any);
      } catch (metaErr) {
        console.warn('Marked ongoing but failed to save staff metadata:', metaErr);
      }
      setGetModalRequest(null)
      setStaffName('')
      window.location.reload();
    } catch (e) {
      console.error('Failed to mark request as ongoing', e);
      setAlertMessage('Failed to mark as ongoing. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  const truncate = (text: string, max = 80) => {
    const value = String(text || '')
    if (value.length <= max) return value
    return `${value.slice(0, Math.max(0, max - 1))}…`
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

  const canReturnRequest = (req: any) => (req?.status || '').toLowerCase() === 'ongoing'
  const canGetRequest = (req: any) => (req?.status || '').toLowerCase() === 'approved'

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
      return list
    }

    const mergeAndSet = (key: string, snap: any) => {
      accountabilitiesByQueryRef.current[key] = Object.fromEntries(
        processSnapshot(snap).map((row: any) => [row.id, row])
      )
      const merged = Object.values(accountabilitiesByQueryRef.current).flatMap((m) => Object.values(m))
      // de-dupe by id (prefer studentUid query if both exist)
      const byId = new Map<string, any>()
      merged.forEach((r: any) => {
        if (!byId.has(r.id)) byId.set(r.id, r)
      })
      setAccountabilities(Array.from(byId.values()))
    }

    const handleErr = (err: any) => {
      if (err?.code === 'permission-denied') {
        console.error('Student accountabilities listener denied by rules:', err)
        setAlertMessage('Unable to load accountabilities due to permissions. Please re-login or contact admin.')
        return
      }
      console.error('Student accountabilities listener error:', err)
    }

    // Primary (current) field
    const qPrimary = query(
      collection(db, 'accountabilities'),
      where('studentUid', '==', user.uid)
    )

    // Legacy fallbacks: some older docs may not have studentUid populated yet.
    const qLegacyCreatedBy = query(
      collection(db, 'accountabilities'),
      where('createdBy', '==', user.uid)
    )

    const unsubPrimary = onSnapshot(qPrimary, (snap) => mergeAndSet('studentUid', snap), handleErr)
    const unsubLegacy = onSnapshot(qLegacyCreatedBy, (snap) => mergeAndSet('createdBy', snap), handleErr)

    return () => {
      unsubPrimary()
      unsubLegacy()
      accountabilitiesByQueryRef.current = {}
    }
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

  React.useEffect(() => {
    if (!requests.length) {
      setRecentNotifications([])
      setNotifications([])
      return
    }

    try {
      const seenRaw = localStorage.getItem('studentSeenStatuses')
      const historyRaw = localStorage.getItem('studentNotificationHistory')

      let history: any[] = []
      try {
        const parsed = JSON.parse(historyRaw || '[]')
        if (Array.isArray(parsed)) history = parsed
      } catch {
        history = []
      }

      const buildEntry = (req: any, oldStatus?: string) => {
        const status = (req.status || 'pending').toString()
        return {
          id: req.id,
          purpose: req.purpose || 'Request update',
          oldStatus: oldStatus || status,
          status,
          adminRemarks: req.rejectionReason || req.declinedRemarks || req.remarks || '',
          actionAt: formatDateTime(req.updatedAt || req.returnedAt || req.reviewedAt || req.createdAt),
          timestamp: Date.now(),
        }
      }

      if (!seenRaw) {
        const initialMap: Record<string, string> = {}
        requests.forEach((r: any) => {
          initialMap[r.id] = (r.status || 'pending').toString()
        })
        localStorage.setItem('studentSeenStatuses', JSON.stringify(initialMap))

        const seeded = requests.map((r: any) => buildEntry(r)).slice(-200)
        localStorage.setItem('studentNotificationHistory', JSON.stringify(seeded))
        setRecentNotifications([])
        setNotifications(seeded.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
        return
      }

      const seenMap: Record<string, string> = JSON.parse(seenRaw || '{}')
      const changes: any[] = []
      const historyKeys = new Set(history.map((entry: any) => `${entry.id}:${entry.oldStatus}->${entry.status}`))

      requests.forEach((req: any) => {
        const currentStatus = (req.status || 'pending').toString()
        const prevStatus = seenMap[req.id]
        if (typeof prevStatus === 'undefined') {
          const key = `${req.id}:${currentStatus}->${currentStatus}`
          if (!historyKeys.has(key)) {
            const entry = buildEntry(req)
            changes.push(entry)
            historyKeys.add(key)
          }
          return
        }
        if (prevStatus !== currentStatus) {
          const key = `${req.id}:${prevStatus}->${currentStatus}`
          if (!historyKeys.has(key)) {
            const entry = buildEntry(req, prevStatus)
            changes.push(entry)
            historyKeys.add(key)
          }
        }
      })

      const updatedHistory = changes.length ? [...history, ...changes].slice(-200) : history
      if (changes.length) {
        localStorage.setItem('studentNotificationHistory', JSON.stringify(updatedHistory))
      }

      setRecentNotifications(changes)
      setNotifications(updatedHistory.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
    } catch (e) {
      console.warn('Failed to process student notifications', e)
      setRecentNotifications([])
      setNotifications([])
    }
  }, [requests])


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
          { label: "Ongoing", value: trackingRequests.filter(r => r.status?.toLowerCase() === 'ongoing').length, colorClass: "text-success" },
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
          <div className="stat-value text-success">{trackingRequests.filter(r => r.status?.toLowerCase() === 'ongoing').length}</div>
      
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
              <>
                {(filter === 'all' ? filteredRows.slice(0, showAllCount) : filteredRows).map((r: any, idx: number) => (
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

                      <div className="card-actions justify-end gap-2">
                        {canGetRequest(r) && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm w-full sm:w-auto gap-2"
                            onClick={() => {
                              setGetModalRequest(r)
                              setStaffName('')
                            }}
                            disabled={busyId === r.requestId}
                          >
                            {busyId === r.requestId ? 'Processing...' : 'Get'}
                          </button>
                        )}
                        {canReturnRequest(r) && (
                          <button
                            type="button"
                            className="btn btn-success btn-sm w-full sm:w-auto gap-2"
                            onClick={() => {
                              setReturnModalRequest(r)
                              setReturnStaffName('')
                            }}
                            disabled={busyId === r.requestId}
                          >
                            <RotateCcw className="w-4 h-4" />
                            {busyId === r.requestId ? 'Returning...' : 'Return'}
                          </button>
                        )}
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
                ))}

              </>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Purpose</th>
                  <th>Date of Usage</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Action</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
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
                      </td>

                      {/* Date of Usage */}
                      <td className="max-w-sm">
                        {r.startDate || r.endDate ? (
                          <div className="min-w-0 leading-tight">
                            <p className="text-sm font-medium truncate">
                              {formatUsageDate(r.startDate || r.endDate)}
                            </p>
                            <p className="text-xs text-base-content/60 truncate">
                              to {formatUsageDate(r.endDate || r.startDate)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-base-content/40 text-sm">—</span>
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
                        {canGetRequest(r) ? (
                          <button
                            className="btn btn-primary btn-sm gap-2"
                            onClick={() => {
                              setGetModalRequest(r)
                              setStaffName('')
                            }}
                            disabled={busyId === r.requestId}
                          >
                            {busyId === r.requestId ? 'Processing...' : 'Get'}
                          </button>
                        ) : canReturnRequest(r) ? (
                          <button
                            className="btn btn-success btn-sm gap-2"
                            onClick={() => {
                              setReturnModalRequest(r)
                              setReturnStaffName('')
                            }}
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

      {filter === 'completed' && resolvedAccountabilities.length > 0 && (
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold leading-tight">Resolved Accountabilities</h3>
                <p className="text-sm text-base-content/60">Marked resolved by admin</p>
              </div>
              <span className="badge badge-ghost">{resolvedAccountabilities.length}</span>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {resolvedAccountabilities.map((a) => (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowAccountabilityModal(a)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setShowAccountabilityModal(a)
                  }}
                  className="card bg-base-100 border border-base-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="card-body p-4 gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{getAccountabilityPurpose(a)}</div>
                        <div className="text-xs text-base-content/60 truncate">
                          {truncate(formatAccountabilityDetails(a.details) || 'No details provided', 70)}
                        </div>
                      </div>
                      <div className="shrink-0">{getAccountabilityBadge(a.status)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="table min-w-[820px] bg-base-100 rounded-box border border-base-300">
                <thead>
                  <tr>
                    <th>Accountability</th>
                    <th>Details</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedAccountabilities.map((a) => (
                    <tr
                      key={a.id}
                      className="cursor-pointer transition-colors hover:bg-base-300/40"
                      onClick={() => setShowAccountabilityModal(a)}
                    >
                      <td className="max-w-md">
                        <div className="font-medium truncate">{getAccountabilityPurpose(a)}</div>
                        <div className="text-xs text-base-content/60 truncate">
                          {getAccountabilityRequestedAt(a) || '—'}
                        </div>
                      </td>
                      <td className="max-w-md">
                        <div className="text-sm truncate">
                          {truncate(formatAccountabilityDetails(a.details) || 'No details provided', 90)}
                        </div>
                      </td>
                      <td>{getAccountabilityBadge(a.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {showModalRequest && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setShowModalRequest(null)} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="font-bold text-lg leading-tight">Request Details</h3>
                <p className="text-sm text-base-content/60 truncate">
                  {showModalRequest.purpose || 'Untitled Request'}
                </p>
              </div>
              <div className="shrink-0">{getStatusBadge(showModalRequest)}</div>
            </div>

            <div className="rounded-xl border border-base-300 bg-base-200/40 p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-base-content/60">Request ID</div>
                  <div className="mt-1 flex items-center gap-2 min-w-0">
                    <code className="text-xs bg-base-300 px-2 py-1 rounded font-mono break-all">
                      {showModalRequest.id}
                    </code>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-circle tooltip shrink-0"
                      data-tip={copiedId === showModalRequest.id ? 'Copied!' : 'Copy ID'}
                      onClick={() => copyToClipboard(showModalRequest.id)}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-base-content/60">Requested At</div>
                  <div className="mt-1 text-sm">
                    {formatDateTime(showModalRequest.createdAt) || '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Requester</span></label>
                <div className="bg-base-300 p-3 rounded-lg text-sm">
                  {user?.displayName ?? user?.email?.split('@')[0] ?? 'Student'}
                </div>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Adviser / Leader</span></label>
                <div className="bg-base-300 p-3 rounded-lg text-sm">{showModalRequest.adviser || '—'}</div>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Approved By</span></label>
                <div className="bg-base-300 p-3 rounded-lg text-sm">
                  {(showModalRequest as any).approvedBy || '—'}
                </div>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Released By Staff</span></label>
                <div className="bg-base-300 p-3 rounded-lg text-sm">
                  {(showModalRequest as any).issuedByStaffName || '—'}
                </div>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Received On Return By</span></label>
                <div className="bg-base-300 p-3 rounded-lg text-sm">
                  {(showModalRequest as any).returnedToStaffName || '—'}
                </div>
              </div>

              <div className="form-control md:col-span-2">
                <label className="label"><span className="label-text text-xs">Date of Usage</span></label>
                {showModalRequest.startDate || showModalRequest.endDate ? (
                  <div className="bg-base-300 p-3 rounded-lg">
                    <div className="leading-tight">
                      <div className="text-sm font-medium">
                        {formatUsageDate(showModalRequest.startDate || showModalRequest.endDate)}
                      </div>
                      <div className="text-xs text-base-content/60">
                        to {formatUsageDate(showModalRequest.endDate || showModalRequest.startDate)}
                        {(showModalRequest.start || showModalRequest.end) ? ` • ${formatTime(showModalRequest.start)}–${formatTime(showModalRequest.end)}` : ''}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-base-300 p-3 rounded-lg text-sm text-base-content/60">—</div>
                )}
              </div>

              <div className="form-control md:col-span-2">
                <label className="label"><span className="label-text text-xs">Items</span></label>
                <div className="bg-base-300 p-3 rounded-lg">
                  <ul className="space-y-2">
                    {showModalRequest.items?.map((item: any) => {
                      const equipment = equipmentList.find((e: any) => e.equipmentID === item.equipmentID);
                      return (
                        <li key={item.equipmentID} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">{equipment?.name || item.name || item.equipmentID}</span>
                          <span className="badge badge-sm shrink-0">{item.qty} pcs</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="divider my-3" />
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Total</span>
                    <span>{(showModalRequest.items || []).reduce((acc: any, i: any) => acc + (i.qty || 0), 0)} pcs</span>
                  </div>
                </div>
              </div>

              <div className="form-control md:col-span-2">
                <label className="label"><span className="label-text text-xs">Admin Remarks</span></label>
                <div className="bg-base-300 p-3 rounded-lg text-sm whitespace-pre-wrap">
                  {showModalRequest.declinedRemarks || showModalRequest.remarks || '—'}
                </div>
              </div>
            </div>
            
            <div className="modal-action">
              {canGetRequest(showModalRequest) && (
                <button
                  className="btn btn-primary gap-2"
                  onClick={() => {
                    setGetModalRequest(showModalRequest)
                    setStaffName('')
                  }}
                  disabled={busyId === showModalRequest.id}
                >
                  {busyId === showModalRequest.id ? 'Processing...' : 'Get Equipment'}
                </button>
              )}
              {canReturnRequest(showModalRequest) && (
                <button
                  className="btn btn-success gap-2"
                  onClick={() => {
                    setReturnModalRequest(showModalRequest)
                    setReturnStaffName('')
                  }}
                  disabled={busyId === showModalRequest.id}
                >
                  <RotateCcw className="w-4 h-4" />
                  {busyId === showModalRequest.id ? 'Returning...' : 'Return Equipment'}
                </button>
              )}

              {(showModalRequest.status || '').toLowerCase() === 'pending' && (
                <button
                  className="btn btn-error gap-2"
                  onClick={() => handleCancel(showModalRequest.id)}
                  disabled={busyId === showModalRequest.id}
                >
                  <XCircle className="w-4 h-4" />
                  {busyId === showModalRequest.id ? 'Cancelling...' : 'Cancel Request'}
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

      {getModalRequest && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-md">
            <h3 className="font-bold text-lg">Confirm Equipment Claim</h3>
            <p className="text-sm text-base-content/70 mt-2">
              Enter the name of the staff who handed the equipment.
            </p>
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">Staff Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="e.g. Juan Dela Cruz"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={() => handleGet(getModalRequest.requestId || getModalRequest.id, staffName)}
                disabled={busyId === (getModalRequest.requestId || getModalRequest.id)}
              >
                {busyId === (getModalRequest.requestId || getModalRequest.id) ? 'Confirming...' : 'Confirm Get'}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setGetModalRequest(null)
                  setStaffName('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              onClick={() => {
                setGetModalRequest(null)
                setStaffName('')
              }}
            >
              close
            </button>
          </form>
        </dialog>
      )}

      {returnModalRequest && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-md">
            <h3 className="font-bold text-lg">Confirm Equipment Return</h3>
            <p className="text-sm text-base-content/70 mt-2">
              Enter the name of the staff you handed the equipment to.
            </p>
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">Staff Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="e.g. Juan Dela Cruz"
                value={returnStaffName}
                onChange={(e) => setReturnStaffName(e.target.value)}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn btn-success"
                onClick={() => handleReturn(returnModalRequest.requestId || returnModalRequest.id, returnStaffName)}
                disabled={busyId === (returnModalRequest.requestId || returnModalRequest.id)}
              >
                {busyId === (returnModalRequest.requestId || returnModalRequest.id) ? 'Confirming...' : 'Confirm Return'}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setReturnModalRequest(null)
                  setReturnStaffName('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              onClick={() => {
                setReturnModalRequest(null)
                setReturnStaffName('')
              }}
            >
              close
            </button>
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
    <ConfirmDialog
      open={confirmOpen}
      title={confirmData?.title}
      message={confirmData?.message || ""}
      confirmClass={confirmData?.confirmClass}
      onCancel={() => {
        setConfirmOpen(false);
        setConfirmData(null);
      }}
      onConfirm={async () => {
        await confirmData?.action();
        setConfirmOpen(false);
        setConfirmData(null);
      }}
    />
    </>
  );
}

