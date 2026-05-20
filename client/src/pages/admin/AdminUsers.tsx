import React from 'react'
import { formatRoleLabel } from '../../utils/roleLabel'
import { setSuperAdmin, setUserRole, getAdminAndPendingUsers } from '../../api/auth.api'
import { useTelemetry } from '../../hooks/useTelemetry'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useAuth } from '../../hooks/useAuth'
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
  const { user: currentUser } = useAuth()
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
  const [confirmIntent, setConfirmIntent] = React.useState<'primary' | 'danger'>('primary')
  const [confirmPrompt, setConfirmPrompt] = React.useState('Type CONFIRM to proceed.')
  const confirmActionRef = React.useRef<null | (() => Promise<void>)>(null)
  const { measureActionLatency } = useTelemetry()
  
  const isCurrentUser = (uid: string) => currentUser?.uid === uid

  React.useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true)
        console.log(`[AdminUsers] Fetching admin and pending users...`)
        const fetchedUsers = await getAdminAndPendingUsers()
        console.log(`[AdminUsers] ✅ Received ${fetchedUsers.length} users from API`)
        
        const list: UserData[] = []
        let superCount = 0
        
        fetchedUsers.forEach((data: any) => {
          // Skip super admins from the main list (count separately)
          if (data.isSuperAdmin) {
            superCount += 1
            // Don't return - super admins should still appear in the list if role is 'admin'
          }
          
          // Include all returned users from API
          if (data && data.uid) {
            // Ensure requestedAdmin is true for users with admin-pending role
            // This handles cases where the field might be missing from the response
            const isRequestingAdmin = data.requestedAdmin === true || data.role === 'admin-pending';
            
            const userData = {
              uid: data.uid,
              displayName: data.displayName || '',
              email: data.email || '',
              role: data.role || 'student',
              isSuperAdmin: !!data.isSuperAdmin,
              createdAt: data.createdAt,
              requestedAdmin: isRequestingAdmin,
              studentNumber: data.studentNumber || '',
              staffId: data.staffId || '',
            }
            if (isRequestingAdmin) {
              console.log(`[AdminUsers] Found requesting admin user:`, { 
                uid: data.uid.substring(0, 8),
                email: data.email,
                role: data.role,
                requestedAdmin: data.requestedAdmin 
              })
            }
            list.push(userData)
          }
        })
        
        list.sort((a, b) => {
          // Prioritize pending admin requests first
          if (a.requestedAdmin && !b.requestedAdmin) return -1
          if (!a.requestedAdmin && b.requestedAdmin) return 1
          
          // Then admins (including super admins)
          if (a.role === 'admin' && b.role !== 'admin') return -1
          if (a.role !== 'admin' && b.role === 'admin') return 1
          
          // Within same role, sort by email
          return (a.email || '').localeCompare(b.email || '')
        })
        
        console.log(`[AdminUsers] ✅ Processed ${list.length} users, ${list.filter(u => u.requestedAdmin).length} requesting admin`)
        setSuperAdminCount(superCount)
        setUsers(list)
        setLoading(false)
      } catch (error) {
        console.error('[AdminUsers] ❌ Failed to load users', error)
        setLoading(false)
      }
    }
    
    fetchUsers()
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
    action: () => Promise<void>,
    opts?: { intent?: 'primary' | 'danger'; prompt?: string }
  ) {
    setConfirmTitle(title)
    setConfirmMessage(message)
    setConfirmInput('')
    setConfirmSubmitting(false)
    setConfirmIntent(opts?.intent || 'primary')
    setConfirmPrompt(opts?.prompt || 'Type CONFIRM to proceed.')
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
      () => applyAdminRoleChange(user, newRole),
      { intent: 'danger', prompt: 'Type CONFIRM to proceed with this action.' }
    )
    return
  }

  async function grantAdmin(user: UserData) {
    const displayName = user.email || user.displayName || user.uid

    openTypedConfirm(
      'Confirm Grant Admin Access',
      `Grant admin privileges to ${displayName}? Type CONFIRM to proceed.`,
      () => applyAdminRoleChange(user, 'admin'),
      { intent: 'primary', prompt: 'Type CONFIRM to grant admin access.' }
    )
    return
  }

  async function makeSuperAdmin(user: UserData) {
    const nextValue = true
    const displayName = user.email || user.displayName || user.uid

    openTypedConfirm(
      'Confirm Super Admin Promotion',
      `Promote ${displayName} to Super Admin? Type CONFIRM to proceed.`,
      () => applySuperAdminChange(user, nextValue),
      { intent: 'danger', prompt: 'Type CONFIRM to promote this account.' }
    )
    return
  }

  function formatDate(ts: any) {
    try {
      if (!ts) return ''
      let dateStr: string
      
      // Handle Firestore Timestamp objects
      if (typeof ts.toDate === 'function') {
        dateStr = ts.toDate().toISOString().split('T')[0]
      } 
      // Handle ISO string (most common from API)
      else if (typeof ts === 'string') {
        // Extract date part (YYYY-MM-DD) from ISO string
        const match = ts.match(/^\d{4}-\d{2}-\d{2}/)
        dateStr = match ? match[0] : ts
      } 
      // Handle numeric timestamp (milliseconds since epoch)
      else if (typeof ts === 'number') {
        dateStr = new Date(ts).toISOString().split('T')[0]
      } 
      // Handle Date objects
      else if (ts instanceof Date) {
        dateStr = ts.toISOString().split('T')[0]
      } 
      // Unknown format
      else {
        return ''
      }
      
      return formatDateUtil(dateStr)
    } catch (error) {
      console.warn('Date formatting error:', error, ts)
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
            <>
              {/* Mobile list (cards) */}
              <div className="lg:hidden p-3 sm:p-4 space-y-3">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-10 text-base-content/60">
                    {debouncedSearchTerm ? "No users match your search." : "No eligible users found."}
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.uid}
                      className={`card bg-base-100 border border-base-300 shadow-sm cursor-pointer transition-colors ${
                        isCurrentUser(user.uid) ? "ring-2 ring-info/40" : "hover:border-primary/40"
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="card-body p-4 gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="avatar shrink-0">
                              <div className="w-10 rounded-xl">
                                <img
                                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    user.displayName || user.email || "User"
                                  )}&background=${user.role === "admin" ? "c7d2fe" : "a5b4fc"}&color=${
                                    user.role === "admin" ? "3730a3" : "312e81"
                                  }&bold=true`}
                                  alt={user.displayName || user.email || "User"}
                                />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{user.displayName || "(No name)"}</div>
                              <div className="text-xs text-base-content/60 truncate">{user.email || "—"}</div>
                              <div className="text-xs text-base-content/60 font-mono truncate">{user.uid.slice(0, 12)}...</div>
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <span
                              className={`badge ${
                                user.role === "admin"
                                  ? user.isSuperAdmin
                                    ? "badge-accent"
                                    : "badge-secondary"
                                  : "badge-primary"
                              } badge-sm`}
                            >
                              {formatRoleLabel(user.role || "student", !!user.isSuperAdmin)}
                            </span>
                            {user.requestedAdmin && user.role !== "admin" ? (
                              <span className="badge badge-warning badge-sm">Requested</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-xs text-base-content/60">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Joined {formatDate(user.createdAt) || "—"}
                          </span>
                          {isCurrentUser(user.uid) ? <span className="badge badge-info badge-sm">Your Account</span> : null}
                        </div>

                        {!isCurrentUser(user.uid) && (
                          <div className="card-actions justify-end" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                              {user.requestedAdmin && user.role !== "admin" ? (
                                <button
                                  className="btn btn-sm btn-primary flex-1 sm:flex-none"
                                  onClick={() => grantAdmin(user)}
                                  disabled={updating === user.uid}
                                >
                                  {updating === user.uid ? "Updating..." : "Grant Admin"}
                                </button>
                              ) : null}
                              {user.role === "admin" && !user.requestedAdmin ? (
                                <button
                                  className="btn btn-sm btn-error flex-1 sm:flex-none"
                                  onClick={() => revokeAdmin(user)}
                                  disabled={updating === user.uid}
                                >
                                  {updating === user.uid ? "Updating..." : "Revoke Admin"}
                                </button>
                              ) : null}
                              {user.role === "admin" && !user.isSuperAdmin && !user.requestedAdmin && (
                                <button
                                  className="btn btn-sm btn-accent flex-1 sm:flex-none"
                                  onClick={() => makeSuperAdmin(user)}
                                  disabled={updating === user.uid}
                                >
                                  {updating === user.uid ? "Updating..." : "Make Super"}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
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
                      <tr key={user.uid} className={`cursor-pointer transition-colors ${
                        isCurrentUser(user.uid)
                          ? 'bg-info/20 hover:bg-info/30 font-semibold'
                          : 'hover:bg-primary/10'
                      }`} onClick={() => setSelectedUser(user)}>
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
                          {!isCurrentUser(user.uid) && (
                            <div className="flex flex-wrap gap-2">
                              {user.requestedAdmin && user.role !== 'admin' ? (
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
                          )}
                          {isCurrentUser(user.uid) && (
                            <span className="badge badge-info badge-sm">Your Account</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </>
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
        <dialog className="modal modal-open sm:modal-middle">
          <div className="modal-box w-11/12 max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setSelectedUser(null)}
              aria-label="Close"
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
              {(selectedUser.requestedAdmin || selectedUser.isSuperAdmin || isCurrentUser(selectedUser.uid)) && (
                <>
                  <div className="divider my-2" />
                  <div className="space-y-2">
                    {isCurrentUser(selectedUser.uid) && (
                      <div className="alert alert-info">
                        <Shield className="w-5 h-5" />
                        <span>This is your account. You cannot modify your own permissions.</span>
                      </div>
                    )}
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
              {!isCurrentUser(selectedUser.uid) && (
                <>
                  <div className="divider my-2" />
                  <div className="modal-action gap-2">
                    {selectedUser.requestedAdmin && selectedUser.role !== 'admin' ? (
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
                </>
              )}
              {isCurrentUser(selectedUser.uid) && (
                <>
                  <div className="divider my-2" />
                  <div className="modal-action gap-2">
                    <button
                      className="btn flex-1"
                      onClick={() => setSelectedUser(null)}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
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
            className="bg-base-100 p-4 sm:p-6 rounded-box shadow max-w-lg w-full max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{confirmTitle}</h3>
            <p className="text-sm text-base-content/70 mt-1">{confirmMessage}</p>
            <div className="alert alert-warning mt-3">
              <span>{confirmPrompt}</span>
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
                className={`btn ${confirmIntent === 'danger' ? 'btn-error' : 'btn-primary'}`}
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
