import React from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { formatRoleLabel } from '../../utils/roleLabel'
import { setSuperAdmin, setUserRole } from '../../api/auth.api'
import { useTelemetry } from '../../hooks/useTelemetry'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import MobileStatsPager from '../../components/MobileStatsPager'
import { formatDate as formatDateUtil } from '../../utils/formatters'
import { User, Mail, Calendar, Shield, AlertCircle } from 'lucide-react'

interface UserData {
  uid: string
  displayName?: string
  email?: string
  role?: string
  isSuperAdmin?: boolean
  createdAt?: any
  requestedAdmin?: boolean
  studentNumber?: string
  staffId?: string
}

export default function AdminUsers() {
  const [users, setUsers] = React.useState<UserData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [superAdminCount, setSuperAdminCount] = React.useState(0)
  const [updating, setUpdating] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)
  const [alertMessage, setAlertMessage] = React.useState<string | null>(null)
  const [alertType, setAlertType] = React.useState<'success' | 'error' | 'info'>('info')
  const [selectedUser, setSelectedUser] = React.useState<UserData | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [confirmTitle, setConfirmTitle] = React.useState('')
  const [confirmMessage, setConfirmMessage] = React.useState('')
  const [confirmInput, setConfirmInput] = React.useState('')
  const [confirmSubmitting, setConfirmSubmitting] = React.useState(false)
  const confirmActionRef = React.useRef<null | (() => Promise<void>)>(null)
  const { measureActionLatency } = useTelemetry()

  React.useEffect(() => {
    const usersRef = collection(db, 'users')
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const list: UserData[] = []
        let superCount = 0
        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          if (data.isSuperAdmin) {
            superCount += 1
            return
          }
          if (data.role === 'admin' || data.requestedAdmin) {
            list.push({
              uid: docSnap.id,
              displayName: data.displayName || '',
              email: data.email || '',
              role: data.role || 'student',
              isSuperAdmin: !!data.isSuperAdmin,
              createdAt: data.createdAt,
              requestedAdmin: !!data.requestedAdmin,
              studentNumber: data.studentNumber || '',
              staffId: data.staffId || '',
            })
          }
        })
        list.sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1
          if (a.role !== 'admin' && b.role === 'admin') return 1
          return (a.email || '').localeCompare(b.email || '')
        })
        setSuperAdminCount(superCount)
        setUsers(list)
        setLoading(false)
      },
      (error) => {
        console.error('Failed to load users', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  async function applyAdminRoleChange(user: UserData, newRole: 'student' | 'admin') {
    try {
      setUpdating(user.uid)
      await measureActionLatency(
        'admin_users.set_role_api',
        () => setUserRole(user.uid, newRole),
        { uid: user.uid, newRole }
      )
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, role: newRole, requestedAdmin: false } : u))
      )
      setAlertType('info')
      setAlertMessage(
        `Permissions updated for ${user.email || user.displayName || user.uid}. ` +
        `Please ask this user to re-login to refresh their token and apply new access.`
      )
    } catch (error) {
      console.error('Failed to update user role', error)
      setAlertType('error')
      setAlertMessage('Failed to update user role. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  async function applySuperAdminChange(user: UserData, nextValue: boolean) {
    try {
      setUpdating(user.uid)
      await measureActionLatency(
        'admin_users.set_super_admin',
        () => setSuperAdmin(user.uid, nextValue),
        { uid: user.uid, isSuperAdmin: nextValue }
      )
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid
            ? {
                ...u,
                role: nextValue ? 'admin' : u.role,
                isSuperAdmin: nextValue,
                requestedAdmin: false,
              }
            : u
        )
      )
      setAlertType('info')
      setAlertMessage(
        `Permissions updated for ${user.email || user.displayName || user.uid}. ` +
        `Please ask this user to re-login to refresh their token and apply new access.`
      )
    } catch (error: any) {
      console.error('Failed to update super admin role', error)
      setAlertType('error')
      setAlertMessage(error?.message || 'Failed to update super admin role. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  function openTypedConfirm(
    title: string,
    message: string,
    action: () => Promise<void>
  ) {
    setConfirmTitle(title)
    setConfirmMessage(message)
    setConfirmInput('')
    setConfirmSubmitting(false)
    confirmActionRef.current = action
    setConfirmOpen(true)
  }

  async function submitTypedConfirm() {
    if (!confirmActionRef.current) return
    try {
      setConfirmSubmitting(true)
      await confirmActionRef.current()
      setConfirmOpen(false)
      setConfirmInput('')
      confirmActionRef.current = null
    } finally {
      setConfirmSubmitting(false)
    }
  }

  async function revokeAdmin(user: UserData) {
    const newRole: 'student' = 'student'
    const displayName = user.email || user.displayName || user.uid

    openTypedConfirm(
      'Confirm Admin Revocation',
      `You are about to revoke admin privileges from ${displayName}. Type CONFIRM to continue.`,
      () => applyAdminRoleChange(user, newRole)
    )
    return
  }

  async function grantAdmin(user: UserData) {
    const displayName = user.email || user.displayName || user.uid

    if (!confirm(`Grant admin privileges to ${displayName}?`)) return
    await applyAdminRoleChange(user, 'admin')
  }

  async function makeSuperAdmin(user: UserData) {
    const nextValue = true
    const displayName = user.email || user.displayName || user.uid

    if (!confirm(`Promote ${displayName} to Super Admin?`)) return
    await applySuperAdminChange(user, nextValue)
  }

  function formatDate(ts: any) {
    try {
      if (!ts) return ''
      let dateStr: string
      if (typeof ts.toDate === 'function') {
        // Firestore Timestamp
        dateStr = ts.toDate().toISOString().split('T')[0]
      } else if (typeof ts === 'string') {
        dateStr = ts
      } else if (typeof ts === 'number') {
        dateStr = new Date(ts).toISOString().split('T')[0]
      } else if (ts instanceof Date) {
        dateStr = ts.toISOString().split('T')[0]
      } else {
        return ''
      }
      return formatDateUtil(dateStr)
    } catch {
      return ''
    }
  }

  const filteredUsers = users.filter((user) => {
    const term = debouncedSearchTerm.trim().toLowerCase()
    if (!term) return true
    return (
      (user.email || '').toLowerCase().includes(term) ||
      (user.displayName || '').toLowerCase().includes(term) ||
      user.uid.toLowerCase().includes(term)
    )
  })

  const adminCount = users.filter((u) => u.role === 'admin').length
  const pendingCount = users.filter((u) => u.role !== 'admin' && u.requestedAdmin).length

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {alertMessage && (
        <div className={`alert ${alertType === 'error' ? 'alert-error' : alertType === 'success' ? 'alert-success' : 'alert-info'}`}>
          <span>{alertMessage}</span>
          <button className="btn btn-sm" onClick={() => setAlertMessage(null)}>Close</button>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold">Admin Management</h1>
        <p className="text-base-content/70">Review admin accounts and pending requests.</p>
      </div>

      <MobileStatsPager
        breakpoint="lg"
        items={[
          { label: "Total Accounts", value: users.length },
          { label: "Current Admins", value: adminCount, colorClass: "text-secondary" },
          { label: "Super Admins", value: superAdminCount, colorClass: "text-accent" },
          { label: "Pending Requests", value: pendingCount, colorClass: "text-warning" },
        ]}
      />
      <div className="hidden lg:flex stats stats-horizontal shadow bg-base-200 w-full">
        <div className="stat">
          <div className="stat-title">Total Accounts</div>
          <div className="stat-value">{users.length}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Current Admins</div>
          <div className="stat-value text-secondary">{adminCount}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Super Admins</div>
          <div className="stat-value text-accent">{superAdminCount}</div>
          
        </div>
        <div className="stat">
          <div className="stat-title">Pending Requests</div>
          <div className="stat-value text-warning">{pendingCount}</div>
          
        </div>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="card-title text-lg mb-0">Search</h2>
            <p className="text-xs text-base-content/60">Filter by email, name, or user ID.</p>
          </div>
          <label className="form-control w-full md:w-80">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Search by email, name, or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-8 text-center">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-base-content/60">
                        {debouncedSearchTerm ? 'No users match your search.' : 'No eligible users found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.uid} className="hover:bg-primary/10 cursor-pointer transition-colors" onClick={() => setSelectedUser(user)}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="w-10 rounded-xl">
                                <img
                                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    user.displayName || user.email || 'User'
                                  )}&background=${user.role === 'admin' ? 'c7d2fe' : 'a5b4fc'}&color=${
                                    user.role === 'admin' ? '3730a3' : '312e81'
                                  }&bold=true`}
                                  alt={user.displayName || user.email || 'User'}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="font-medium">{user.displayName || '(No name)'}</div>
                              <div className="text-xs text-base-content/60 font-mono">{user.uid.slice(0, 12)}...</div>
                            </div>
                          </div>
                        </td>
                        <td>{user.email || '—'}</td>
                        <td>
                          <span
                            className={`badge ${
                              user.role === 'admin'
                                ? user.isSuperAdmin
                                  ? 'badge-accent'
                                  : 'badge-secondary'
                                : 'badge-primary'
                            } badge-sm`}
                          >
                            {formatRoleLabel(user.role || 'student', !!user.isSuperAdmin)}
                          </span>
                          {user.requestedAdmin && user.role !== 'admin' ? (
                            <span className="badge badge-warning badge-sm ml-2">Requested</span>
                          ) : null}
                        </td>
                        <td className="text-sm">{formatDate(user.createdAt) || '—'}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-2">
                            {user.requestedAdmin ? (
                              <button
                                className='btn btn-sm btn-primary'
                                onClick={() => grantAdmin(user)}
                                disabled={updating === user.uid}
                              >
                                {updating === user.uid ? 'Updating...' : 'Grant Admin'}
                              </button>
                            ) : null }
                            {user.role === 'admin' && !user.requestedAdmin ? (
                              <button
                                className="btn btn-sm btn-error"
                                onClick={() => revokeAdmin(user)}
                                disabled={updating === user.uid}
                              >

                                {updating === user.uid ? 'Updating...' : 'Revoke Admin'}
                              </button>
                            ) : null }
                            {user.role === 'admin' && !user.isSuperAdmin && !user.requestedAdmin && (
                              <button
                                className="btn btn-sm btn-accent"
                                onClick={() => makeSuperAdmin(user)}
                                disabled={updating === user.uid}
                              >
                                {updating === user.uid ? 'Updating...' : 'Make Super'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body space-y-3">
          <h3 className="card-title text-lg">About Admin Management</h3>
          <ul className="text-sm text-base-content/70 list-disc list-inside space-y-1">
            <li>This list shows current admins plus users who requested elevated access.</li>
            <li>Granting Admin approves pending admin requests and clears the request flag.</li>
            <li>Use Make Super to promote approved admins to super admin access.</li>
            <li>Revoking access demotes the user back to student immediately.</li>
          </ul>
        </div>
      </div>

      {/* User Profile Modal */}
      {selectedUser && (
        <dialog className="modal modal-open">
          <div className="modal-box w-full max-w-2xl">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setSelectedUser(null)}
            >
              ✕
            </button>
            <div className="space-y-5">
              {/* Header with Avatar and Name */}
              <div className="flex items-center gap-4">
                <div className="avatar">
                  <div className="w-16 rounded-xl">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                        selectedUser.displayName || selectedUser.email || 'User'
                      )}&background=${selectedUser.role === 'admin' ? 'c7d2fe' : 'a5b4fc'}&color=${
                        selectedUser.role === 'admin' ? '3730a3' : '312e81'
                      }&bold=true&size=128`}
                      alt={selectedUser.displayName || selectedUser.email || 'User'}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold">{selectedUser.displayName || '(No name)'}</h3>
                  <p className="text-base-content/60 text-sm">{selectedUser.email || '—'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`badge ${
                        selectedUser.role === 'admin'
                          ? selectedUser.isSuperAdmin
                            ? 'badge-accent'
                            : 'badge-secondary'
                          : 'badge-primary'
                      }`}
                    >
                      {formatRoleLabel(selectedUser.role || 'student', !!selectedUser.isSuperAdmin)}
                    </span>
                    {selectedUser.requestedAdmin && selectedUser.role !== 'admin' && (
                      <span className="badge badge-warning">Requested Admin</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="divider my-2" />

              {/* Account Information */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wide text-base-content/60 font-semibold">Account Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email */}
                  <div className="bg-base-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-base-content/60 uppercase tracking-wide mb-1">
                      <Mail className="w-3 h-3" />
                      Email
                    </div>
                    <p className="text-sm break-all">{selectedUser.email || '—'}</p>
                  </div>

                  {/* Role Status */}
                  <div className="bg-base-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-base-content/60 uppercase tracking-wide mb-1">
                      <Shield className="w-3 h-3" />
                      Role Status
                    </div>
                    <p className="text-sm font-medium">
                      {selectedUser.role === 'admin'
                        ? selectedUser.isSuperAdmin
                          ? 'Super Administrator'
                          : 'Administrator'
                        : 'Student'}
                    </p>
                  </div>

                  {/* Student/Staff ID */}
                  {(selectedUser.studentNumber || selectedUser.staffId) && (
                    <div className="bg-base-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-xs text-base-content/60 uppercase tracking-wide mb-1">
                        <User className="w-3 h-3" />
                        {selectedUser.studentNumber ? 'Student Number' : 'Staff ID'}
                      </div>
                      <p className="font-mono text-sm">{selectedUser.studentNumber || selectedUser.staffId}</p>
                    </div>
                  )}

                  {/* Joined Date */}
                  <div className="bg-base-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-base-content/60 uppercase tracking-wide mb-1">
                      <Calendar className="w-3 h-3" />
                      Joined
                    </div>
                    <p className="text-sm font-medium">
                      {selectedUser.createdAt ? formatDate(selectedUser.createdAt) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* System User ID */}
              <div className="bg-base-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-base-content/60 uppercase tracking-wide mb-2">
                  <User className="w-3 h-3" />
                  System User ID
                </div>
                <p className="font-mono text-xs break-all">{selectedUser.uid}</p>
              </div>

              {/* Status Alerts */}
              {(selectedUser.requestedAdmin || selectedUser.isSuperAdmin) && (
                <>
                  <div className="divider my-2" />
                  <div className="space-y-2">
                    {selectedUser.requestedAdmin && selectedUser.role !== 'admin' && (
                      <div className="alert alert-warning">
                        <AlertCircle className="w-5 h-5" />
                        <span>This user has requested admin access.</span>
                      </div>
                    )}
                    {selectedUser.isSuperAdmin && (
                      <div className="alert alert-info">
                        <Shield className="w-5 h-5" />
                        <span>This user has super administrator privileges.</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="divider my-2" />
              <div className="modal-action gap-2">
                {selectedUser.requestedAdmin ? (
                  <button
                    className="btn btn-primary flex-1"
                    onClick={() => {
                      grantAdmin(selectedUser)
                      setSelectedUser(null)
                    }}
                    disabled={updating === selectedUser.uid}
                  >
                    {updating === selectedUser.uid ? 'Updating...' : 'Grant Admin Access'}
                  </button>
                ) : null}
                {selectedUser.role === 'admin' && !selectedUser.requestedAdmin ? (
                  <>
                    {!selectedUser.isSuperAdmin && (
                      <button
                        className="btn btn-accent flex-1"
                        onClick={() => {
                          makeSuperAdmin(selectedUser)
                          setSelectedUser(null)
                        }}
                        disabled={updating === selectedUser.uid}
                      >
                        {updating === selectedUser.uid ? 'Updating...' : 'Make Super Admin'}
                      </button>
                    )}
                    <button
                      className="btn btn-error flex-1"
                      onClick={() => {
                        revokeAdmin(selectedUser)
                        setSelectedUser(null)
                      }}
                      disabled={updating === selectedUser.uid}
                    >
                      {updating === selectedUser.uid ? 'Updating...' : 'Revoke Admin Access'}
                    </button>
                  </>
                ) : null}
                <button
                  className="btn flex-1"
                  onClick={() => setSelectedUser(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setSelectedUser(null)}>close</button>
          </form>
        </dialog>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !confirmSubmitting) {
              setConfirmOpen(false)
              setConfirmInput('')
              confirmActionRef.current = null
            }
          }}
        >
          <div
            className="bg-base-100 p-4 rounded shadow max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{confirmTitle}</h3>
            <p className="text-sm text-base-content/70 mt-1">{confirmMessage}</p>
            <div className="alert alert-warning mt-3">
              <span>Type CONFIRM to proceed with this destructive action.</span>
            </div>
            <input
              type="text"
              className="input input-bordered w-full mt-3"
              placeholder="Type CONFIRM"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              disabled={confirmSubmitting}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="btn"
                disabled={confirmSubmitting}
                onClick={() => {
                  setConfirmOpen(false)
                  setConfirmInput('')
                  confirmActionRef.current = null
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                disabled={confirmSubmitting || confirmInput.trim() !== 'CONFIRM'}
                onClick={submitTypedConfirm}
              >
                {confirmSubmitting ? 'Applying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
