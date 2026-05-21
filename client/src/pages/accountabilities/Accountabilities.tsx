import React from 'react'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../firebase'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { AlertCircle, CheckCircle, Clock, FileWarning, Calendar, X } from 'lucide-react'
import MobileStatsPager from '../../components/MobileStatsPager'
import { formatDate, truncate } from '../../utils/formatters'

export default function Accountabilities(){
  const { user } = useAuth()
  const [rows, setRows] = React.useState<any[]>([])
  const [tab, setTab] = React.useState<'all'|'pending'|'resolved'>('all');
  const [showModal, setShowModal] = React.useState<any | null>(null);
  const [alertMessage, setAlertMessage] = React.useState<string | null>(null);
  const [profileStudentNumber, setProfileStudentNumber] = React.useState<string>('')
  const rowsByQueryRef = React.useRef<Record<string, Record<string, any>>>({})

  React.useEffect(() => {
    if (!user?.uid) {
      setProfileStudentNumber('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (!snap.exists()) return
        const data: any = snap.data()
        const sn =
          data.studentNumber ||
          data.studentNo ||
          data.student_id ||
          data.studentId ||
          ''
        if (!cancelled) setProfileStudentNumber(String(sn || ''))
      } catch (e) {
        console.warn('Failed to load student profile for student number', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  React.useEffect(()=>{
    if(!user) return
    const processSnapshot = (snap: any) => {
      console.info('Accountabilities snapshot count:', snap.size)
      const list: any[] = []
      snap.forEach((d: any) => {
        const data: any = d.data()
        const due = data.dueDate?.toDate ? data.dueDate.toDate().toLocaleDateString() : (data.dueDate ? new Date(data.dueDate).toLocaleDateString() : '')
        list.push({
          id: d.id,
          due,
          details: data.details || '',
          status: data.status || 'pending',
          studentName: data.studentName || data.createdByName || user?.displayName || user?.email || 'Student',
          studentNumber: data.studentNumber || data.createdByNumber || data.studentNo || profileStudentNumber || ''
        })
      })
      return list
    }

    const mergeAndSet = (key: string, snap: any) => {
      rowsByQueryRef.current[key] = Object.fromEntries(processSnapshot(snap).map((r: any) => [r.id, r]))
      const merged = Object.values(rowsByQueryRef.current).flatMap((m) => Object.values(m))
      const byId = new Map<string, any>()
      merged.forEach((r: any) => {
        if (!byId.has(r.id)) byId.set(r.id, r)
      })
      setRows(Array.from(byId.values()))
    }

    const handleErr = (err: any) => {
      if (err?.code === 'permission-denied') {
        console.error('Accountabilities listener denied by rules:', err)
        setAlertMessage('You do not have permission to read accountabilities for this account.')
        return
      }
      console.error('Accountabilities listener error:', err)
    }

    const qPrimary = query(collection(db, 'accountabilities'), where('studentUid', '==', user.uid))
    // Legacy fallbacks: older documents may not have studentUid populated yet.
    const qLegacyCreatedBy = query(collection(db, 'accountabilities'), where('createdBy', '==', user.uid))

    const unsubPrimary = onSnapshot(qPrimary, (snap) => mergeAndSet('studentUid', snap), handleErr)
    const unsubLegacy = onSnapshot(qLegacyCreatedBy, (snap) => mergeAndSet('createdBy', snap), handleErr)

    return () => {
      unsubPrimary()
      unsubLegacy()
      rowsByQueryRef.current = {}
    }
  },[user, profileStudentNumber])

  // Filter rows
  let filtered = rows.filter(r => {
    if (tab === 'all') return true;
    const s = (r.status || 'pending').toLowerCase();
    if (tab === 'pending') return s === 'pending';
    if (tab === 'resolved') return s === 'resolved' || s === 'completed';
    return false;
  });

  // Count stats
  const pendingCount = rows.filter(r => (r.status || '').toLowerCase() === 'pending').length;
  const resolvedCount = rows.filter(r => ['resolved','completed'].includes((r.status || '').toLowerCase())).length;

  // Status badge helper
  const getStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'resolved' || s === 'completed') return <span className="badge badge-success">Resolved</span>;
    if (s === 'pending') return <span className="badge badge-warning">Pending</span>;
    if (s === 'overdue') return <span className="badge badge-error">Overdue</span>;
    return <span className="badge badge-neutral">{status}</span>;
  };

  const formatDetails = (details: string) => {
    return details
      .split(/\n+/)
      .map((part) => part.trim())
      .filter((part) => part && !/^return inspection for request/i.test(part))
      .join(", ");
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {alertMessage && (
        <div className="alert alert-error">
          <span>{alertMessage}</span>
          <button className="btn btn-sm" onClick={() => setAlertMessage(null)}>Close</button>
        </div>
      )}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileWarning className="w-6 h-6" />
          Accountabilities
        </h1>
        <p className="text-base-content/70">Track your pending items and obligations</p>
      </div>

      {/* Stats */}
      <MobileStatsPager
        breakpoint="sm"
        items={[
          { label: "Total", value: rows.length },
          { label: "Pending", value: pendingCount, colorClass: "text-warning" },
          { label: "Resolved", value: resolvedCount, colorClass: "text-success" },
        ]}
      />
      <div className="hidden sm:flex stats stats-horizontal shadow bg-base-200 w-full">
        <div className="stat">
          <div className="stat-figure text-primary">
            <FileWarning className="w-8 h-8" />
          </div>
          <div className="stat-title">Total</div>
          <div className="stat-value">{rows.length}</div>
          
        </div>
        <div className="stat">
          <div className="stat-figure text-warning">
            <Clock className="w-8 h-8" />
          </div>
          <div className="stat-title">Pending</div>
          <div className="stat-value text-warning">{pendingCount}</div>
          
        </div>
        <div className="stat">
          <div className="stat-figure text-success">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div className="stat-title">Resolved</div>
          <div className="stat-value text-success">{resolvedCount}</div>
          
        </div>
      </div>


              {/* Info Alert */}
              {pendingCount > 0 && (
                <div className="alert alert-warning mt-6">
                  <AlertCircle className="w-5 h-5" />
                  <div>
                    <h3 className="font-bold">Attention Required</h3>
                    <div className="text-xs">You have {pendingCount} pending {pendingCount === 1 ? 'accountability' : 'accountabilities'} that need to be resolved.</div>
                  </div>
                </div>
              )}
              
              {/* Table Card */}
              <div className="card bg-base-200 shadow-xl">
                <div className="card-body p-0">
                  {/* Tabs Header */}
                  <div className="p-4 border-b border-base-300">
                    <div className="overflow-x-auto pb-1">
                    <div role="tablist" className="tabs tabs-boxed bg-base-300 w-fit whitespace-nowrap">
                      <a role="tab" className={`tab transition-all duration-300 ease-in-out ${tab === 'all' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setTab('all')}>All</a>
                      <a role="tab" className={`tab transition-all duration-300 ease-in-out ${tab === 'pending' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setTab('pending')}>Pending</a>
                      <a role="tab" className={`tab transition-all duration-300 ease-in-out ${tab === 'resolved' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setTab('resolved')}>Resolved</a>
                    </div>
                    </div>
                  </div>
                  {/* Mobile cards */}
                  <div className="lg:hidden p-3 sm:p-4 space-y-3">
                    {filtered.length === 0 ? (
                      <div className="text-center py-8 text-base-content/60">No accountabilities found</div>
                    ) : (
                      filtered.map((r) => (
                        <div
                          key={r.id}
                          className="card bg-base-100 border border-base-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                          role="button"
                          tabIndex={0}
                          onClick={() => setShowModal(r)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') setShowModal(r)
                          }}
                        >
                          <div className="card-body p-4 gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{r.studentName || 'Student'}</div>
                                <div className="text-xs font-mono text-base-content/60 truncate">
                                  {r.studentNumber || 'No student number'}
                                </div>
                              </div>
                              <div className="shrink-0">{getStatusBadge(r.status)}</div>
                            </div>
                            <div className="text-sm text-base-content/80 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-base-content/50 flex-shrink-0" />
                              <span>{r.due ? formatDate(r.due) : 'No date set'}</span>
                            </div>
                            <p className="text-sm text-base-content/80">
                              {truncate(formatDetails(r.details) || 'No details provided', 90)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="table min-w-[720px]">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Details</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center py-8 text-base-content/60">
                              No accountabilities found
                            </td>
                          </tr>
                        ) : (
                          filtered.map((r) => (
                            <tr
                              key={r.id}
                              className="cursor-pointer transition-colors hover:bg-base-300/40"
                              onClick={() => setShowModal(r)}
                            >
                              <td>
                                <div className="font-medium">{r.studentName || 'Student'}</div>
                                <div className="text-xs font-mono text-base-content/60">
                                  {r.studentNumber || 'No student number'}
                                </div>
                              </td>
                              <td>
                                <div className="max-w-md">
                                  <p className="text-sm">{truncate(formatDetails(r.details) || 'No details provided', 50)}</p>
                                </div>
                              </td>
                              <td>{getStatusBadge(r.status)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Details Modal */}
              {showModal && (
                <dialog className="modal modal-open sm:modal-middle">
                  <div className="modal-box w-11/12 max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
                    <button
                      className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                      onClick={() => setShowModal(null)}
                      aria-label="Close"
                      type="button"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-base-content/60 font-semibold mb-2">Student</h3>
                        <div className="bg-base-200 rounded-lg p-4">
                          <div className="font-semibold text-base">{showModal.studentName || 'Student'}</div>
                          <div className="text-sm text-base-content/70 font-mono mt-1">{showModal.studentNumber || 'No student number'}</div>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-base-content/60 font-semibold mb-2">Details</h3>
                        <div className="bg-base-200 rounded-lg p-4 text-sm leading-relaxed">
                          {formatDetails(showModal.details) || 'No details provided'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-base-300 rounded-lg p-3">
                        <span className="text-xs uppercase tracking-wide text-base-content/60 font-semibold">Status:</span>
                        {getStatusBadge(showModal.status)}
                      </div>
                    </div>
                    <div className="modal-action mt-6">
                      <button className="btn btn-primary" onClick={() => setShowModal(null)}>Close</button>
                    </div>
                  </div>
                  <form method="dialog" className="modal-backdrop">
                    <button onClick={() => setShowModal(null)}>close</button>
                  </form>
                </dialog>
              )}
            </div>
  )
}
