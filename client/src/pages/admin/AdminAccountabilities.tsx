import React from 'react'
import { db } from '../../firebase'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore'
import { FileWarning, Clock, CheckCircle, AlertCircle, Plus } from 'lucide-react'
import MobileStatsPager from '../../components/MobileStatsPager'

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


type IssueCondition = 'damaged' | 'missing' | 'detail'

interface ModalIssueEntry {
  key: string
  label: string
  condition: IssueCondition
  instanceNumber: number
  totalCount: number
  conditionLabel: string
}

const AdminAccountabilities: React.FC = () => {
  const [rows, setRows] = React.useState<any[]>([])
  const [tab, setTab] = React.useState<'all'|'pending'|'resolved'|'overdue'>('all')
  const [issueFilter, setIssueFilter] = React.useState<'all' | 'damaged' | 'missing'>('all')
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [showModal, setShowModal] = React.useState<any | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [dateIncurred, setDateIncurred] = React.useState('')
  const [dateDue, setDateDue] = React.useState('')
  const [selectedStudentNumber, setSelectedStudentNumber] = React.useState('')
  const [selectedStudentName, setSelectedStudentName] = React.useState('')
  const [detailsField, setDetailsField] = React.useState('')
  const [studentNameByNumber, setStudentNameByNumber] = React.useState<Record<string,string>>({})
  const [userInfoById, setUserInfoById] = React.useState<Record<string, { displayName?: string; studentNumber?: string }>>({})
  const [toast, setToast] = React.useState<{type: 'success' | 'error'; message: string} | null>(null)
  const [modalItemStates, setModalItemStates] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    const processSnapshot = (snap: any) => {
      const list: any[] = []
      snap.forEach((d: any) => {
        const data: any = d.data()
        const due = data.dueDate?.toDate ? data.dueDate.toDate().toLocaleDateString() : (data.dueDate ? new Date(data.dueDate).toLocaleDateString() : '')
        list.push({
          id: d.id,
          due,
          details: data.details || '',
          status: data.status || 'pending',
          studentNumber: data.studentNumber || '',
          studentName: data.studentName || '',
          createdByName: data.createdByName || '',
          createdBy: data.createdBy || '',
          amount: data.amount || null,
          createdAt: data.createdAt,
          issues: Array.isArray(data.issues) ? data.issues : [],
          itemResolutions: Array.isArray(data.itemResolutions) ? data.itemResolutions : [],
          legacyItemActions: Array.isArray(data.itemActions) ? data.itemActions : []
        })
      })
      setRows(list)
    }

    let unsub: (() => void) | null = null
    try {
      const q = query(collection(db, 'accountabilities'), orderBy('dueDate', 'asc'))
      unsub = onSnapshot(
        q,
        (snap) => processSnapshot(snap),
        (err) => {
          console.error('Accountabilities ordered query failed, retrying without orderBy:', err)
          // Retry with unordered query
          try {
            const qFallback = query(collection(db, 'accountabilities'))
            unsub = onSnapshot(
              qFallback,
              (snap) => processSnapshot(snap),
              (err2) => console.error('Accountabilities fallback listener error:', err2)
            )
          } catch (fallbackErr) {
            console.error('Failed to create fallback accountabilities listener:', fallbackErr)
          }
        }
      )
    } catch (e) {
      console.error('Failed to subscribe accountabilities:', e)
      // Final fallback: simple query
      try {
        const qSimple = query(collection(db, 'accountabilities'))
        unsub = onSnapshot(
          qSimple,
          (snap) => processSnapshot(snap),
          (err) => console.error('Accountabilities simple query error:', err)
        )
      } catch (simpleErr) {
        console.error('Failed to create simple accountabilities listener:', simpleErr)
      }
    }

    return () => { if (unsub) unsub() }
  }, [])

  React.useEffect(() => {
    const missingUids = Array.from(
      new Set(
        rows
          .map(r => (r.studentNumber ? null : r.createdBy || null))
          .filter((uid): uid is string => !!uid && !userInfoById[uid])
      )
    )
    if (!missingUids.length) return
    missingUids.forEach(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (snap.exists()) {
          const data: any = snap.data()
          setUserInfoById(prev => ({
            ...prev,
            [uid]: {
              displayName: data.displayName || data.email || uid,
              studentNumber: data.studentNumber || '',
            }
          }))
        }
      } catch (e) {
        console.warn('Failed to load user info', e)
      }
    })
  }, [rows, userInfoById])

  // Filter rows
  let filtered = rows.filter(r => {
    if (tab !== 'all') {
      const s = (r.status || 'pending').toLowerCase()
      if (tab === 'pending' && s !== 'pending') return false
      if (tab === 'resolved' && !['resolved','completed'].includes(s)) return false
      if (tab === 'overdue' && s !== 'overdue') return false
    }
    if (issueFilter !== 'all') {
      const text = (r.details || '').toLowerCase()
      if (issueFilter === 'damaged' && !text.includes('damaged')) return false
      if (issueFilter === 'missing' && !text.includes('missing')) return false
    }
    return true
  })

  const pendingCount = rows.filter(r => (r.status || '').toLowerCase() === 'pending').length
  const resolvedCount = rows.filter(r => ['resolved','completed'].includes((r.status || '').toLowerCase())).length
  const overdueCount = rows.filter(r => (r.status || '').toLowerCase() === 'overdue').length

  // unique overdue students (studentNumber) derived from rows
  const overdueStudents = Array.from(new Set(rows.filter(r => (r.status || '').toLowerCase() === 'overdue').map(r => r.studentNumber || '').filter(Boolean)))

  const getStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase()
    if (s === 'resolved' || s === 'completed') return <span className="badge badge-success">Resolved</span>
    if (s === 'pending') return <span className="badge badge-warning">Pending</span>
    if (s === 'overdue') return <span className="badge badge-error">Overdue</span>
    return <span className="badge badge-neutral">{status}</span>
  }

  const getItemList = (details: string) => {
    return details
      .split(/[\n,]+/)
      .map(part => part.trim())
      .filter(part => part && !/^return inspection for request/i.test(part))
  }

  const formatDetails = (details: string) => getItemList(details).join(', ')

  const modalIssueEntries = React.useMemo<ModalIssueEntry[]>(() => {
    if (!showModal) return []
    const result: ModalIssueEntry[] = []
    const issues = Array.isArray(showModal.issues) ? showModal.issues : []
    if (issues.length) {
      issues.forEach((issue: any, issueIdx: number) => {
        const name = issue?.equipmentName || issue?.equipmentID || `Item ${issueIdx + 1}`
        const baseKey = issue?.equipmentID || issue?.equipmentName || `issue-${issueIdx}`
        ;(['damaged','missing'] as const).forEach(condition => {
          const qty = Math.max(0, Number(issue?.[condition]) || 0)
          for (let i = 0; i < qty; i++) {
            result.push({
              key: `${baseKey}-${condition}-${i}`,
              label: name,
              condition,
              instanceNumber: i + 1,
              totalCount: qty,
              conditionLabel: condition === 'damaged' ? 'Damaged' : 'Missing'
            })
          }
        })
      })
    }
    if (!result.length) {
      getItemList(showModal.details || '').forEach((text, idx) => {
        result.push({
          key: `detail-${idx}`,
          label: text,
          condition: 'detail',
          instanceNumber: 1,
          totalCount: 1,
          conditionLabel: 'Issue'
        })
      })
    }
    return result
  }, [showModal])

  React.useEffect(() => {
    if (!showModal) {
      setModalItemStates({})
      return
    }
    const storedResolutions = Array.isArray(showModal.itemResolutions)
      ? showModal.itemResolutions
      : Array.isArray(showModal.legacyItemActions)
      ? showModal.legacyItemActions
      : []
    const valueByKey: Record<string, boolean> = {}
    const valueByLabel: Record<string, boolean> = {}
    storedResolutions.forEach((entry: any, idx: number) => {
      if (!entry) return
      const resolvedValue =
        typeof entry.resolved === 'boolean'
          ? entry.resolved
          : typeof entry.action === 'string'
          ? entry.action.trim().length > 0
          : false
      const entryKey = entry.key || entry.itemKey
      if (entryKey) valueByKey[entryKey] = resolvedValue
      if (entry.item) valueByLabel[entry.item] = resolvedValue
      if (!entryKey && !entry.item) {
        valueByKey[`legacy-${idx}`] = resolvedValue
      }
    })
    const nextMap: Record<string, boolean> = {}
    modalIssueEntries.forEach((entry, idx) => {
      if (typeof valueByKey[entry.key] === 'boolean') {
        nextMap[entry.key] = valueByKey[entry.key]
      } else if (typeof valueByLabel[entry.label] === 'boolean') {
        nextMap[entry.key] = valueByLabel[entry.label]
      } else {
        nextMap[entry.key] = false
      }
    })
    setModalItemStates(nextMap)
  }, [showModal, modalIssueEntries])

  const buildResolutionPayload = React.useCallback((stateMap: Record<string, boolean>) => {
    return modalIssueEntries.map(entry => ({
      key: entry.key,
      item: entry.label,
      condition: entry.condition,
      instance: entry.instanceNumber,
      total: entry.totalCount,
      resolved: !!stateMap[entry.key]
    }))
  }, [modalIssueEntries])

  const persistItemResolutions = React.useCallback(async (stateMap: Record<string, boolean>) => {
    if (!showModal || !showModal.id) return
    const payload = buildResolutionPayload(stateMap)
    setShowModal((prev: any | null) => (prev && prev.id === showModal.id ? { ...prev, itemResolutions: payload } : prev))
    try {
      await updateDoc(doc(db, 'accountabilities', showModal.id), { itemResolutions: payload })
    } catch (e) {
      console.error('Failed to update item resolutions', e)
      setToast({ type: 'error', message: 'Failed to update item action. Please try again.' })
      setTimeout(() => setToast(null), 3500)
    }
  }, [showModal, buildResolutionPayload])

  const modalStatus = (showModal?.status || '').toLowerCase()
  const modalEditable = modalStatus !== 'resolved' && modalStatus !== 'completed'
  const modalItemsIncomplete = modalIssueEntries.length > 0 && modalIssueEntries.some(entry => !modalItemStates[entry.key])

  const toggleItemResolution = React.useCallback((key: string) => {
    if (!modalEditable) return
    setModalItemStates(prev => {
      const next = { ...prev, [key]: !prev[key] }
      persistItemResolutions(next)
      return next
    })
  }, [modalEditable, persistItemResolutions])

  const exportTablePDF = () => {
    const pdf = new jsPDF("landscape", "mm", "A4");

    pdf.setFontSize(16);
    pdf.text("Admin Accountabilities Report", 14, 15);

    pdf.setFontSize(10);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const dataToExport = filtered;

    const tableData = dataToExport.map(r => {
      const studentName =
        studentNameByNumber[r.studentNumber] ||
        r.studentName ||
        r.createdByName ||
        (r.createdBy ? userInfoById[r.createdBy]?.displayName : undefined) ||
        r.createdBy ||
        "Unknown";

      const studentNumber =
        r.studentNumber ||
        (r.createdBy ? userInfoById[r.createdBy]?.studentNumber : undefined) ||
        "No student number";

      return [
        r.due || "No date",
        studentName,
        studentNumber,
        formatDetails(r.details) || "No details",
        r.status || "pending"
      ];
    });

    autoTable(pdf, {
      startY: 28,
      head: [["Date Due", "Name", "Student Number", "Details", "Status"]],
      body: tableData,
    });

    pdf.save(`admin-accountabilities-${tab}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Accountabilities</h1>
          <p className="text-base-content/70">View and manage all student accountabilities</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />
            Add New Accountability
          </button>

          <button className="btn btn-primary btn-sm gap-2" onClick={exportTablePDF}>
            Export as PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <MobileStatsPager
        breakpoint="lg"
        items={[
          { label: "Total", value: rows.length },
          { label: "Pending", value: pendingCount, colorClass: "text-warning" },
          { label: "Resolved", value: resolvedCount, colorClass: "text-success" },
          { label: "Overdue", value: overdueCount, colorClass: "text-error" },
        ]}
      />
      <div className="hidden lg:flex stats stats-horizontal shadow bg-base-200 w-full">
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
        <div className="stat">
          <div className="stat-figure text-error">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="stat-title">Overdue</div>
          <div className="stat-value text-error">{overdueCount}</div>
          
        </div>
      </div>

      {/* Table Card */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body p-0">
          <div className="p-4 border-b border-base-300 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" className="tabs tabs-boxed bg-base-300">
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${tab === 'all' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setTab('all')}>All</a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${tab === 'pending' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setTab('pending')}>Pending</a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${tab === 'resolved' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setTab('resolved')}>Resolved</a>
              <a role="tab" className={`tab transition-all duration-300 ease-in-out ${tab === 'overdue' ? 'tab-active bg-primary text-white font-semibold' : ''}`} onClick={() => setTab('overdue')}>Overdue</a>
            </div>
            <div className="form-control w-full lg:w-56">
              <label className="label py-1">
                <span className="label-text text-sm font-medium">Issue filter</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={issueFilter}
                onChange={(e) => setIssueFilter(e.target.value as 'all' | 'damaged' | 'missing')}
              >
                <option value="all">All issues</option>
                <option value="damaged">Damaged only</option>
                <option value="missing">Missing only</option>
              </select>
            </div>
          </div>

          {/* Mobile list (cards) */}
          <div className="lg:hidden p-3 sm:p-4 space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-base-content/60">No accountabilities found</div>
            ) : (
              filtered.map((r) => (
                <div key={r.id} className="card bg-base-100 border border-base-300 shadow-sm">
                  <div className="card-body p-4 gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-base-content/60">Due</div>
                        <div className="font-semibold truncate">{r.due || "No date set"}</div>
                      </div>
                      <div className="shrink-0">{getStatusBadge(r.status)}</div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs text-base-content/60">Student</div>
                      <div className="font-medium truncate">
                        {studentNameByNumber[r.studentNumber] ||
                          r.studentName ||
                          r.createdByName ||
                          (r.createdBy ? userInfoById[r.createdBy]?.displayName : undefined) ||
                          r.createdBy ||
                          "Unknown"}
                      </div>
                      <div className="text-xs font-mono text-base-content/70 truncate">
                        {r.studentNumber ||
                          (r.createdBy ? userInfoById[r.createdBy]?.studentNumber : undefined) ||
                          "No student number"}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs text-base-content/60">Items</div>
                      <div className="text-sm text-base-content/80 break-words">
                        {formatDetails(r.details) || "No details provided"}
                      </div>
                    </div>

                    <div className="card-actions justify-end">
                      <button className="btn btn-primary btn-sm" onClick={() => setShowModal(r)}>
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
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Date Due</th>
                  <th>Student</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-base-content/60">No accountabilities found</td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover">
                      <td>
                        <div className="font-medium">{r.due || 'No date set'}</div>
                      </td>
                      <td>
                        <div className="font-medium">
                          {studentNameByNumber[r.studentNumber] ||
                            r.studentName ||
                            r.createdByName ||
                            (r.createdBy ? userInfoById[r.createdBy]?.displayName : undefined) ||
                            r.createdBy ||
                            'Unknown'}
                        </div>
                        <div className="text-xs font-mono text-base-content/70">
                          {r.studentNumber ||
                            (r.createdBy ? userInfoById[r.createdBy]?.studentNumber : undefined) ||
                            'No student number'}
                        </div>
                      </td>
                      <td>
                        <div className="max-w-md space-y-1">
                          <p className="text-sm font-semibold">Items involved</p>
                          <p className="text-sm">{formatDetails(r.details) || 'No details provided'}</p>
                        </div>
                      </td>
                      <td>{getStatusBadge(r.status)}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(r)}>View</button>
                      </td>
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
          <div className="modal-box w-11/12 max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setShowModal(null)}>
              <AlertCircle className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-lg mb-4">Accountability Details</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Due Date</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">{showModal.due || 'No date set'}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Items / Details</span></label>
                <div className="bg-base-300 p-2 rounded text-sm whitespace-pre-wrap">{showModal.details || 'No details provided'}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Actions Per Item</span></label>
                {modalIssueEntries.length === 0 ? (
                  <div className="bg-base-300 p-2 rounded text-sm text-base-content/70">No individual items detected.</div>
                ) : (
                  <div className="bg-base-300 p-3 rounded space-y-3">
                    <p className="text-xs text-base-content/70">Resolve each item/quantity individually before closing the entire accountability.</p>
                    {modalIssueEntries.map((entry) => {
                      const resolved = !!modalItemStates[entry.key]
                      return (
                        <div key={entry.key} className="flex flex-col gap-2 border border-base-200 rounded-lg bg-base-100/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold">{entry.label}</div>
                            <div className="text-xs text-base-content/70">
                              {entry.conditionLabel}
                              {entry.totalCount > 1 ? ` • Item ${entry.instanceNumber} of ${entry.totalCount}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`btn btn-sm ${resolved ? 'btn-success' : 'btn-outline'}`}
                            disabled={!modalEditable}
                            onClick={() => toggleItemResolution(entry.key)}
                          >
                            {resolved ? 'Resolved' : 'Mark Resolved'}
                          </button>
                        </div>
                      )
                    })}
                    {modalEditable && (
                      <p className="text-xs text-base-content/70">You can toggle these buttons while the request is still unresolved.</p>
                    )}
                    </div>
                )}
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Status</span></label>
                <div className="bg-base-300 p-2 rounded text-sm flex items-center gap-2">{getStatusBadge(showModal.status)}</div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Student</span></label>
                <div className="bg-base-300 p-2 rounded text-sm">
                  <div className="font-medium">
                    {studentNameByNumber[showModal.studentNumber] ||
                      showModal.studentName ||
                      showModal.createdByName ||
                      (showModal.createdBy ? userInfoById[showModal.createdBy]?.displayName : undefined) ||
                      showModal.createdBy ||
                      'Unknown'}
                  </div>
                  <div className="text-xs font-mono text-base-content/70">
                    {showModal.studentNumber ||
                      (showModal.createdBy ? userInfoById[showModal.createdBy]?.studentNumber : undefined) ||
                      'No student number'}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowModal(null)}>Close</button>
              {modalEditable && (
                <button className="btn btn-success" disabled={busyId === showModal.id || modalItemsIncomplete} onClick={async () => {
                  if (modalItemsIncomplete) {
                    setToast({ type: 'error', message: 'Resolve every item before completing this accountability.' })
                    setTimeout(() => setToast(null), 3500)
                    return
                  }
                  setBusyId(showModal.id)
                  try {
                    const payload = buildResolutionPayload(modalItemStates)
                    await updateDoc(doc(db, 'accountabilities', showModal.id), {
                      status: 'resolved',
                      itemResolutions: payload,
                      resolvedAt: serverTimestamp()
                    })
                  } catch (e) {
                    console.error(e)
                    setToast({ type: 'error', message: 'Failed to mark resolved' })
                    setTimeout(() => setToast(null), 3500)
                  }
                  setBusyId(null); setShowModal(null)
                }}>Mark as Resolved</button>
              )}
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowModal(null)}>close</button>
          </form>
        </dialog>
      )}

      {/* Info Alert */}
      {pendingCount > 0 && (
        <div className="alert alert-warning mt-6">
          <AlertCircle className="w-5 h-5" />
          <div>
            <h3 className="font-bold">Attention Required</h3>
            <div className="text-xs">There are {pendingCount} pending accountabilities that need to be resolved.</div>
          </div>
        </div>
      )}
      {/* Add Modal */}
      {addOpen && (
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <h3 className="font-bold text-lg mb-2">Create Accountability</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label"><span className="label-text">Date Incurred</span></label>
                <input type="date" className="input input-bordered w-full" value={dateIncurred} onChange={(e) => setDateIncurred(e.target.value)} />
              </div>
              <div>
                <label className="label"><span className="label-text">Date Due</span></label>
                <input type="date" className="input input-bordered w-full" value={dateDue} onChange={(e) => setDateDue(e.target.value)} />
              </div>
              <div>
                <label className="label"><span className="label-text">Full Name (overdue list)</span></label>
                <select className="select select-bordered w-full" value={selectedStudentNumber} onChange={(e) => { const sn = e.target.value; setSelectedStudentNumber(sn); setSelectedStudentName(studentNameByNumber[sn] || sn) }}>
                  <option value="">(select student)</option>
                  {Array.from(new Set(rows.filter(r => (r.status || '').toLowerCase() === 'overdue').map(r => r.studentNumber || '').filter(Boolean))).map(sn => (
                    <option key={sn} value={sn}>{studentNameByNumber[sn] || sn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label"><span className="label-text">Student Number</span></label>
                <input className="input input-bordered w-full" value={selectedStudentNumber} onChange={(e) => setSelectedStudentNumber(e.target.value)} />
              </div>
              <div>
                <label className="label"><span className="label-text">Details</span></label>
                <textarea className="textarea textarea-bordered w-full" rows={4} value={detailsField} onChange={(e) => setDetailsField(e.target.value)} />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                // basic validation
                if (!selectedStudentNumber) {
                  setToast({ type: 'error', message: 'Please select or enter a student number' })
                  setTimeout(() => setToast(null), 3500)
                  return
                }
                if (!dateDue) {
                  setToast({ type: 'error', message: 'Please select a due date' })
                  setTimeout(() => setToast(null), 3500)
                  return
                }
                try {
                  await addDoc(collection(db, 'accountabilities'), {
                    studentNumber: selectedStudentNumber,
                    details: detailsField || '',
                    dueDate: new Date(dateDue),
                    incurredDate: dateIncurred ? new Date(dateIncurred) : null,
                    status: 'pending',
                    createdAt: serverTimestamp()
                  })
                  // reset
                  setAddOpen(false)
                  setDateDue('')
                  setDateIncurred('')
                  setSelectedStudentNumber('')
                  setSelectedStudentName('')
                  setDetailsField('')
                  setToast({ type: 'success', message: 'Accountability created' })
                  setTimeout(() => setToast(null), 3500)
                } catch (e) {
                  console.error('Failed to create accountability', e)
                  setToast({ type: 'error', message: 'Failed to create accountability' })
                  setTimeout(() => setToast(null), 3500)
                }
              }}>Create</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setAddOpen(false)}>close</button></form>
        </dialog>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed right-4 bottom-4 z-50">
          <div className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-error'} shadow-lg`}> 
            <div>
              <span>{toast.message}</span>
            </div>
            <div className="ml-4">
              <button className="btn btn-ghost btn-sm" onClick={() => setToast(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAccountabilities
