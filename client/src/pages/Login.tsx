import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Fish } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import { formatRoleLabel } from "../utils/roleLabel";
import React from "react";

const LOGOUT_TOAST_KEY = "fishlers-logout-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [roleType, setRoleType] = useState<"student" | "admin">("student");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [grantedModalOpen, setGrantedModalOpen] = useState(false);
  const [grantedRedirect, setGrantedRedirect] = useState<null | (() => void)>(null);
  const wasPendingOpenRef = React.useRef(false);

  const currentYear = new Date().getFullYear();
  useEffect(() => {
    if (successMsg) {
      setToast({ type: "success", message: successMsg });
    }
  }, [successMsg]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const stored = sessionStorage.getItem(LOGOUT_TOAST_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.message && parsed?.type) {
          setToast(parsed);
        }
      } catch (e) {
        console.warn("Failed to parse logout toast:", e);
      } finally {
        sessionStorage.removeItem(LOGOUT_TOAST_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const state = (loc.state || {}) as any;
    if (state?.pendingApproval === true) {
      setPendingModalOpen(true);
      // Clear state to avoid modal reopening on back/refresh loops.
      nav(loc.pathname, { replace: true, state: {} });
    }
  }, [loc.pathname, loc.state, nav]);

  const resetLoginFields = React.useCallback(() => {
    setEmail("");
    setPass("");
    setShowPassword(false);
    setErr(null);
    setSuccessMsg(null);
    setIsLoading(false);
  }, []);

  const closePendingModal = React.useCallback(() => {
    setPendingModalOpen(false);
  }, [resetLoginFields]);

  // Ensure fields reset whenever the pending modal is dismissed, even if it was closed via ESC/backdrop.
  useEffect(() => {
    const wasOpen = wasPendingOpenRef.current;
    if (wasOpen && !pendingModalOpen) {
      resetLoginFields();
    }
    wasPendingOpenRef.current = pendingModalOpen;
  }, [pendingModalOpen, resetLoginFields]);

  const showPendingModal = React.useCallback(async (uid?: string) => {
    if (uid) {
      localStorage.setItem(`adminApproval.pendingSeen:${uid}`, "true");
    }
    // Ensure the user can't access any protected areas while pending.
    try {
      await auth.signOut();
    } catch {}
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    setPendingModalOpen(true);
    resetLoginFields();
  }, [resetLoginFields]);

  const showGrantedModal = React.useCallback((onDismiss: () => void) => {
    setGrantedRedirect(() => onDismiss);
    setGrantedModalOpen(true);
  }, []);

  const closeGrantedModal = React.useCallback(() => {
    setGrantedModalOpen(false);
    const cb = grantedRedirect;
    setGrantedRedirect(null);
    if (cb) cb();
  }, [grantedRedirect]);

  async function handleForgotPassword() {
    if (!email) {
      setErr("Please enter your email address first");
      return;
    }
    try {
      setErr(null);
      setSuccessMsg(null);
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("Password reset email sent! Check your inbox.");
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        setErr("No account found with this email");
      } else if (e.code === "auth/invalid-email") {
        setErr("Invalid email address");
      } else if (e.code === "auth/invalid-credential" || (typeof e.message === "string" && e.message.includes("auth/invalid-credential"))) {
        setErr("We couldn't verify your identity. Please sign in again.");
      } else {
        setErr(e.message ?? "Failed to send reset email");
      }
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsLoading(true);
      setErr(null);
      setSuccessMsg(null);
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      const firestoreRole = userDoc.data()?.role || null;
      const requestedAdmin = userDoc.data()?.requestedAdmin || false;
      
      if (!firestoreRole) throw new Error("User role not found in database");

      // Pending-admin users are not allowed into student/admin areas.
      if (firestoreRole === "admin-pending") {
        await showPendingModal(cred.user.uid);
        return;
      }
      
      // Check if selected role matches Firestore role
      if (firestoreRole !== roleType) {
        // Special case: user requested admin but is still a student
        if (firestoreRole === 'student' && requestedAdmin && roleType === 'admin') {
          await showPendingModal(cred.user.uid);
          return;
        }
        const roleLabel = formatRoleLabel(firestoreRole);
        throw new Error(`Your account is registered as ${roleLabel}. Please select ${roleLabel} to log in.`);
      }
      
      // Use current token and claims from this fresh sign-in.
      let idTokenResult = await cred.user.getIdTokenResult();
      let token = idTokenResult.token;
      
      // For admin accounts, verify they have the Firebase custom claim
      if (firestoreRole === "admin") {
        let hasAdminAccess = !!idTokenResult.claims.admin || !!idTokenResult.claims.superAdmin;
        if (!hasAdminAccess) {
          // Claims can be briefly stale right after role updates; force-refresh once before failing.
          idTokenResult = await cred.user.getIdTokenResult(true);
          token = idTokenResult.token;
          hasAdminAccess = !!idTokenResult.claims.admin || !!idTokenResult.claims.superAdmin;
        }
        if (!hasAdminAccess) {
          await showPendingModal(cred.user.uid);
          return;
        }
      }
      
      // Store token and role
      localStorage.setItem("authToken", token);
      localStorage.setItem("userRole", firestoreRole);
      
      // Redirect based on role
      if (firestoreRole === "admin") {
        const uid = cred.user.uid;
        const pendingSeenKey = `adminApproval.pendingSeen:${uid}`;
        const grantedShownKey = `adminApproval.grantedShown:${uid}`;
        const shouldShowGranted =
          localStorage.getItem(pendingSeenKey) === "true" &&
          localStorage.getItem(grantedShownKey) !== "true";

        if (shouldShowGranted) {
          localStorage.removeItem(pendingSeenKey);
          localStorage.setItem(grantedShownKey, "true");
          showGrantedModal(() => nav("/admindashboard", { replace: true }));
          return;
        }

        nav("/admindashboard", { replace: true });
      } else {
        nav("/student", { replace: true });
      }
    } catch (e: any) {
      if (e.code === "auth/invalid-credential") {
        setErr("The email or password you entered is incorrect. Please try again.");
      } else if (typeof e.message === "string" && e.message.includes("auth/invalid-credential")) {
        setErr("The email or password you entered is incorrect. Please try again.");
      } else {
        setErr(e.message ?? "Login failed");
      }
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-base-200 via-base-200 to-primary/30 relative overflow-hidden">
      {pendingModalOpen && (
        <dialog className="modal modal-open" onCancel={closePendingModal} onClose={closePendingModal}>
          <div className="modal-box max-w-lg relative">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={closePendingModal}
              aria-label="Close"
            >
              ✕
            </button>
            <h3 className="font-bold text-2xl mb-3">Admin Request Pending</h3>
            <p className="text-base-content/70 leading-relaxed">
              Your admin account is waiting for approval by a super administrator. You won&apos;t be
              able to access student or admin features until your request is approved.
            </p>
            <div className="alert alert-info mt-4">
              <span className="text-sm">
                After approval, log out and log back in to refresh your token.
              </span>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closePendingModal}>close</button>
          </form>
        </dialog>
      )}

      {grantedModalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg relative">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={closeGrantedModal}
              aria-label="Close"
            >
              ✕
            </button>
            <h3 className="font-bold text-2xl mb-3">Admin Access Granted</h3>
            <p className="text-base-content/70 leading-relaxed">
              Your account has been granted admin access. You will be redirected to the Admin
              Dashboard.
            </p>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeGrantedModal}>close</button>
          </form>
        </dialog>
      )}
      {toast && (
        <div className="toast toast-top toast-end z-50 mt-24 mr-4">
          <div className={`alert ${toast.type === "success" ? "alert-success" : "alert-error"} shadow-lg`}>
            <span>{toast.message}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setToast(null)}>
              Close
            </button>
          </div>
        </div>
      )}
      <nav className="navbar bg-base-100/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-primary/10 px-3 sm:px-4">
        <div className="navbar-start">
          <Link to="/" className="btn btn-ghost text-xl gap-2 h-auto py-2">
            <Fish className="w-6 h-6 text-primary" />
            <div className="flex flex-col items-start">
              <span className="font-bold leading-tight">FishLERS</span>
              <span className="text-[10px] text-base-content/60 font-normal hidden sm:block leading-tight">UPV CFOS IA-MSH</span>
            </div>
          </Link>
        </div>
        <div className="navbar-end gap-2">
          <ThemeToggle />
        </div>
      </nav>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-[15%] left-[10%] w-4 h-4 bg-primary/20 rounded-full animate-pulse" />
        <div className="absolute top-[20%] right-[15%] w-3 h-3 bg-primary/20 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
        {/* Fish silhouettes */}
        <svg className="absolute top-[18%] left-[6%] w-16 h-10 text-primary/15 rotate-12" viewBox="0 0 24 16" fill="currentColor">
          <path d="M17 8c3-2 5-2 7 0-2 2-4 2-7 0zm-2 0c-3 4-8 6-12 4 0-2 1-4 3-4-2 0-3-2-3-4 4-2 9 0 12 4z" />
        </svg>
        <svg className="absolute top-[35%] right-[8%] w-14 h-8 text-primary/20 -rotate-6" viewBox="0 0 24 16" fill="currentColor">
          <path d="M17 8c3-2 5-2 7 0-2 2-4 2-7 0zm-2 0c-3 4-8 6-12 4 0-2 1-4 3-4-2 0-3-2-3-4 4-2 9 0 12 4z" />
        </svg>
        <svg className="absolute top-[60%] left-[2%] w-12 h-7 text-primary/20 -rotate-12 opacity-80" viewBox="0 0 24 16" fill="currentColor">
          <path d="M17 8c3-2 5-2 7 0-2 2-4 2-7 0zm-2 0c-3 4-8 6-12 4 0-2 1-4 3-4-2 0-3-2-3-4 4-2 9 0 12 4z" />
        </svg>
        <svg className="absolute top-[70%] right-[12%] w-10 h-6 text-primary/25 rotate-6 opacity-60" viewBox="0 0 24 16" fill="currentColor">
          <path d="M17 8c3-2 5-2 7 0-2 2-4 2-7 0zm-2 0c-3 4-8 6-12 4 0-2 1-4 3-4-2 0-3-2-3-4 4-2 9 0 12 4z" />
        </svg>
        <div className="absolute bottom-0 left-0 w-full h-48 overflow-hidden">
          <svg className="absolute bottom-0 left-0 w-[200%] h-full text-primary/40 animate-[wave_18s_ease-in-out_infinite]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,40 C240,100 480,0 720,50 C960,100 1200,10 1440,40 C1680,100 1920,0 2160,50 C2400,100 2640,10 2880,40 L2880,120 L0,120 Z" />
          </svg>
          <svg className="absolute bottom-0 left-0 w-[200%] h-36 text-primary/50 animate-[wave_12s_ease-in-out_infinite_reverse]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,60 C360,10 720,90 1080,30 C1440,60 1800,10 2160,90 C2520,30 2700,50 2880,60 L2880,120 L0,120 Z" />
          </svg>
        </div>
      </div>

      <div className="absolute top-16 sm:top-20 left-2 sm:left-6 z-40">
        <button
          type="button"
          onClick={() => nav("/")}
          className="btn btn-ghost btn-sm min-h-11 gap-2 text-base-content/70 hover:text-base-content"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      <main className="flex-1 flex items-center justify-center px-3 sm:px-4 pt-24 pb-8 sm:pb-10 relative z-20">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <fieldset className="fieldset bg-base-100/90 backdrop-blur-sm border-primary/20 rounded-box border p-5 sm:p-6 shadow-xl shadow-primary/10">
            <legend className="fieldset-legend text-xl font-semibold px-2 flex items-center gap-2">
              FishLERS Login
            </legend>

            {err && <p className="text-error text-sm mb-3">{err}</p>}
            {successMsg && <p className="text-success text-sm mb-3">{successMsg}</p>}

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                className={`btn flex-1 ${roleType === "student" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setRoleType("student")}
                disabled={isLoading}
              >
                Student
              </button>
              <button
                type="button"
                className={`btn flex-1 ${roleType === "admin" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setRoleType("admin")}
                disabled={isLoading}
              >
                Admin
              </button>
            </div>

            <label className="fieldset-label">Email <span className="text-error">*</span></label>
            <input
              className="input w-full min-h-11"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />

            <label className="fieldset-label mt-3">Password <span className="text-error">*</span></label>
            <div className="relative">
              <input
                className="input w-full pr-10 min-h-11"
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-base-content/60 hover:text-base-content cursor-pointer"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>

            <button className="btn btn-primary w-full mt-6 min-h-11" disabled={isLoading}>
              {isLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : null}
              {isLoading ? "Signing in..." : "Sign In"}
            </button>

            <div className="flex justify-between items-center mt-4 text-sm">
              {roleType === "student" ? (
                <p>
                  No account?{" "}
                  <Link className="link link-primary" to="/signup">
                    Sign Up
                  </Link>
                </p>
              ) : (
                <p>
                  No account?{" "}
                  <Link className="link link-primary" to="/signup?role=admin">
                    Sign Up
                  </Link>
                </p>
              )}
              <button type="button" className="link link-primary" onClick={handleForgotPassword}>
                Forgot Password?
              </button>
            </div>
          </fieldset>
        </form>
      </main>

      <footer className="relative z-20 mt-auto">
        <div className="h-16 relative overflow-hidden">
          <svg className="absolute bottom-0 left-0 w-[200%] h-full text-primary/40 animate-[wave_18s_ease-in-out_infinite]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,50 C240,90 480,20 720,60 C960,100 1200,30 1440,50 C1680,90 1920,20 2160,60 C2400,100 2640,30 2880,50 L2880,120 L0,120 Z" />
          </svg>
          <svg className="absolute bottom-0 left-0 w-[200%] h-14 text-primary/60 animate-[wave_12s_ease-in-out_infinite_reverse]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,80 C360,40 720,90 1080,60 C1440,80 1800,40 2160,90 C2520,60 2700,70 2880,80 L2880,120 L0,120 Z" />
          </svg>
        </div>
        <div className="bg-primary/90 backdrop-blur text-primary-content py-3 px-4">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-4 text-xs text-primary-content/70">
            <span>FishLERS · UPV CFOS IA-MSH</span>
            <span className="hidden sm:inline">•</span>
            <span>© {currentYear} Laboratory Equipment Reservation System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
