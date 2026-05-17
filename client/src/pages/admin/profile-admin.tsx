import React from "react";
import { User, Mail, Shield, Key, Hash, Edit, Save, X, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { db } from "../../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../firebase";
import { formatRoleLabel } from "../../utils/roleLabel";

interface AdminProfile {
  displayName?: string;
  email?: string;
  photoURL?: string;
  staffId?: string;
  role?: string;
  isSuperAdmin?: boolean;
  uid?: string;
}

export default function ProfileAdmin() {
  const { user, isSuperAdmin, claimRoleLabel } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<AdminProfile | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [alertMessage, setAlertMessage] = React.useState<string | null>(null);

  const [displayName, setDisplayName] = React.useState("");
  const [staffId, setStaffId] = React.useState("");

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordSuccess, setPasswordSuccess] = React.useState("");
  const roleLabel = formatRoleLabel(profile?.role || "admin", isSuperAdmin);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? (snap.data() as AdminProfile) : null;

        if (!cancelled) {
          setProfile(data);
          setDisplayName(user.displayName || data?.displayName || "");
          setStaffId(data?.staffId || "");
        }
      } catch (error) {
        console.error("Failed to load admin profile", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function save() {
    if (!user) return;
    try {
      setEditing(false);
      if (displayName !== user.displayName) {
        await updateProfile(auth.currentUser as any, { displayName });
      }
      const staffValue = (staffId || "").trim();
      const updates: Partial<AdminProfile> = { displayName, staffId: staffValue || undefined };
      await updateDoc(doc(db, "users", user.uid), updates);
      setProfile((prev) => ({ ...(prev || {}), ...updates }));
    } catch (error) {
      console.error("Failed to save profile", error);
      setAlertMessage("Failed to save profile. Please try again.");
      setEditing(true);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess("");
    if (!newPassword || !confirmPassword) {
      setPasswordError("Please fill in both password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        setPasswordError("No authenticated user found.");
        return;
      }
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Failed to change password", error);
      if (error.code === "auth/wrong-password") {
        setPasswordError("Current password is incorrect.");
      } else {
        setPasswordError(error.message || "Failed to change password.");
      }
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto text-base-content/30" />
          <p className="mt-4">Please login to view your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {alertMessage && (
        <div className="alert alert-error">
          <span>{alertMessage}</span>
          <button className="btn btn-sm" onClick={() => setAlertMessage(null)}>Close</button>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6" />
          {isSuperAdmin ? "Super Admin Profile" : "Admin Profile"}
        </h1>
        <p className="text-base-content/70">
          {isSuperAdmin
            ? "Manage your Super Admin account information."
            : "Manage your Admin account information."}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card bg-base-200 shadow-xl lg:self-start">
            <div className="card-body items-center text-center">
              <div className="avatar">
                <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                  <img
                    src={
                      user.photoURL ||
                      profile?.photoURL ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        displayName || user.email || "Admin"
                      )}&background=c7d2fe&color=3730a3&bold=true`
                    }
                    alt="avatar"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <h2 className="card-title mt-4">{profile?.displayName || user.displayName || "Admin"}</h2>
              <span className={`badge ${isSuperAdmin ? "badge-accent" : "badge-secondary"}`}>
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </span>
              <p className="text-sm text-base-content/60 mt-2">{profile?.email || user.email}</p>

              <div className="divider"></div>

              <div className="w-full space-y-2 text-left text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-base-content/60" />
                  <span className="text-base-content/60">Staff ID:</span>
                  <span className="font-medium">{profile?.staffId || "Not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-base-content/60" />
                  <span className="text-base-content/60">Role:</span>
                  <span className="font-medium">
                    {roleLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-base-content/60" />
                  <span className="text-base-content/60">Claim Source:</span>
                  <span className="font-medium">{claimRoleLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-base-content/60" />
                  <span className="text-base-content/60">User ID:</span>
                  <span className="font-mono text-xs">{profile?.uid || user.uid}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
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
                          setDisplayName(profile?.displayName || user.displayName || "");
                          setStaffId(profile?.staffId || "");
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
                      className={`input input-bordered w-full ${editing ? "" : "input-disabled"}`}
                      placeholder="Full name"
                      value={editing ? displayName : profile?.displayName || user.displayName || ""}
                      onChange={(e) => setDisplayName(e.target.value)}
                      readOnly={!editing}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Staff ID
                      </span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered w-full ${editing ? "" : "input-disabled"}`}
                      placeholder="STAFF-XXXXX"
                      value={editing ? staffId : profile?.staffId || ""}
                      onChange={(e) => setStaffId(e.target.value)}
                      readOnly={!editing}
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
                      className={`input input-bordered w-full input-disabled ${editing ? "bg-base-300 opacity-60" : ""}`}
                      value={roleLabel}
                      placeholder="Role not set"
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
                      className={`input input-bordered w-full input-disabled font-mono text-xs ${
                        editing ? "bg-base-300 opacity-60" : ""
                      }`}
                      value={profile?.uid || user.uid}
                      placeholder="No ID"
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg flex items-center gap-2">
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
                    <CheckCircle className="w-4 h-4" />
                    Verified
                  </span>
                </div>
              </div>
            </div>

            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg flex items-center gap-2">
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
  );
}
