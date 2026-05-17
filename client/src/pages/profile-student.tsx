import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { db } from '../firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '../firebase'
import { User, Mail, Hash, Shield, Key, Save, X, Edit, CheckCircle, AlertCircle } from 'lucide-react'
import { formatRoleLabel } from '../utils/roleLabel'

function formatDate(ts: any) {
  try {
    if (!ts) return ''
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString()
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).toLocaleString()
    if (ts instanceof Date) return ts.toLocaleString()
    return String(ts)
  } catch {
    return ''
  }
}

export default function ProfileStudent() {
  const { user, claimRoleLabel } = useAuth()
  const [loading, setLoading] = React.useState(true)
  const [profile, setProfile] = React.useState<any>(null)
  const [editing, setEditing] = React.useState(false)
  const [displayName, setDisplayName] = React.useState('')
  const [studentNumber, setStudentNumber] = React.useState('')
  // password change state
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [passwordError, setPasswordError] = React.useState('')
  const [passwordSuccess, setPasswordSuccess] = React.useState('')
  const [profileAlert, setProfileAlert] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const roleLabel = formatRoleLabel(profile?.role || 'student', !!user?.isSuperAdmin)

  React.useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const ref = doc(db, 'users', user.uid)
        const snap = await getDoc(ref)
        const data = snap.exists() ? snap.data() : null
        if (!cancelled) {
          setProfile(data)
          setDisplayName(user.displayName || data?.displayName || '')
          setStudentNumber(data?.studentNumber || '')
        }
      } catch (e) {
        console.error('Failed to load profile', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  async function save() {
    if (!user) return
    try {
      setEditing(false)
      // update auth displayName
      if (displayName !== user.displayName) {
        await updateProfile(auth.currentUser as any, { displayName })
      }
      // validate student number format if provided
      const sn = (studentNumber || '').trim()
      if (sn && !/^20\d{2}-\d{5}$/.test(sn)) {
        setProfileAlert({ type: 'error', message: 'Student number must be in the format 20XX-XXXXX' })
        setEditing(true)
        return
      }
      // update firestore users doc
      const ref = doc(db, 'users', user.uid)
  const updates: any = { displayName, studentNumber: sn }
  await updateDoc(ref, updates)
  setProfile((p:any) => ({ ...(p||{}), displayName, studentNumber: sn }))
  setProfileAlert({ type: 'success', message: 'Profile updated successfully.' })
    } catch (e) {
      console.error('Failed to save profile', e)
      setProfileAlert({ type: 'error', message: 'Failed to save profile. Please try again.' })
    }
  }

  async function changePassword() {
    setPasswordError('')
    setPasswordSuccess('')
    if (!newPassword || !confirmPassword) {
      setPasswordError('Please fill in both password fields.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    try {
      const currentUser = auth.currentUser
      if (!currentUser || !currentUser.email) {
        setPasswordError('No authenticated user found.')
        return
      }
      // re-authenticate user before password update
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, newPassword)
      setPasswordSuccess('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      console.error('Failed to change password', e)
      if (e.code === 'auth/wrong-password') {
        setPasswordError('Current password is incorrect.')
      } else {
        setPasswordError(e.message || 'Failed to change password.')
      }
    }
  }

  if (!user) return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center">
        <User className="w-16 h-16 mx-auto text-base-content/30" />
        <p className="mt-4">Please login to view your profile</p>
      </div>
    </div>
  )

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {profileAlert && (
        <div className={`alert ${profileAlert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          <span>{profileAlert.message}</span>
          <button className="btn btn-sm" onClick={() => setProfileAlert(null)}>Close</button>
        </div>
      )}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6" />
          My Profile
        </h1>
        <p className="text-base-content/70">Manage your account information</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="avatar">
                  <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                    <img
                      src={user?.photoURL || profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || user?.email || 'User')}&background=6366f1&color=ffffff&bold=true`}
                      alt="avatar"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
                <h2 className="card-title mt-4">{profile?.displayName || user.displayName || 'User'}</h2>
                <span className="badge badge-primary">Student</span>
                <p className="text-sm text-base-content/60 mt-2">{profile?.email || user.email}</p>
                
                <div className="divider"></div>
                
                <div className="w-full space-y-2 text-left text-sm">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-base-content/60" />
                    <span className="text-base-content/60">Student No:</span>
                    <span className="font-medium">{profile?.studentNumber || 'Not set'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-base-content/60" />
                    <span className="text-base-content/60">Role:</span>
                    <span className="font-medium">{roleLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-base-content/60" />
                    <span className="text-base-content/60">Claim Source:</span>
                    <span className="font-medium">{claimRoleLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Information */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="card-title text-lg">Account Information</h3>
                  {!editing ? (
                    <button className="btn btn-primary btn-sm gap-2 w-full sm:w-auto" onClick={() => setEditing(true)}>
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button 
                        className="btn btn-ghost btn-sm gap-2 w-full sm:w-auto" 
                        onClick={() => { 
                          setEditing(false); 
                          setDisplayName(profile?.displayName || user.displayName || ''); 
                          setStudentNumber(profile?.studentNumber || '') 
                        }}
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-sm gap-2 w-full sm:w-auto" onClick={save}>
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Full Name
                      </span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered w-full ${editing ? '' : 'input-disabled'}`}
                      placeholder="Your Full Name"
                      value={editing ? displayName : (profile?.displayName || user.displayName || '')}
                      onChange={(e) => setDisplayName(e.target.value)}
                      readOnly={!editing}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Student Number
                      </span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered w-full input-disabled ${editing ? 'bg-base-300 opacity-60' : ''}`}
                      placeholder="20XX-XXXXX"
                      value={profile?.studentNumber || studentNumber || ''}
                      readOnly
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Role
                      </span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered w-full input-disabled ${editing ? 'bg-base-300 opacity-60' : ''}`}
                      value={roleLabel}
                      readOnly
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        User ID
                      </span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered w-full input-disabled font-mono text-xs ${editing ? 'bg-base-300 opacity-60' : ''}`}
                      value={profile?.uid || user.uid}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Email Section */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg">
                  <Mail className="w-5 h-5" />
                  Email Address
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-base-300 rounded-lg mt-2">
                  <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-10 h-10 flex items-center justify-center">
                      <Mail className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium break-all">{profile?.email || user.email}</p>
                    <p className="text-xs text-base-content/60">Primary email address</p>
                  </div>
                  <span className="badge badge-success gap-1 self-start sm:self-center">
                    <CheckCircle className="w-3 h-3" />
                    Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Change Password Section */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg">
                  <Key className="w-5 h-5" />
                  Change Password
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Current Password</span>
                    </label>
                    <input
                      type="password"
                      className="input input-bordered w-full"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">New Password</span>
                    </label>
                    <input
                      type="password"
                      className="input input-bordered w-full"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Confirm Password</span>
                    </label>
                    <input
                      type="password"
                      className="input input-bordered w-full"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                {passwordError && (
                  <div className="alert alert-error mt-4">
                    <AlertCircle className="w-5 h-5" />
                    <span>{passwordError}</span>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="alert alert-success mt-4">
                    <CheckCircle className="w-5 h-5" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <div className="card-actions mt-4">
                  <button className="btn btn-primary gap-2 w-full sm:w-auto" onClick={changePassword}>
                    <Key className="w-4 h-4" />
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
