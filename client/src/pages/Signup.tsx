// src/pages/Signup.tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import ThemeToggle from '../components/ThemeToggle';
import { ArrowLeft, Fish } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [staffId, setStaffId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role') === 'admin' ? 'admin' : 'student';

  useEffect(() => {
    if (err) {
      setToast({ type: 'error', message: err });
    }
  }, [err]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsLoading(true);
      setErr(null);

      if (!name.trim()) throw new Error('Full name is required');
      if (requestedRole === 'student' && !studentNumber.trim()) throw new Error('Student number is required');
      if (requestedRole === 'admin' && !staffId.trim()) throw new Error('Staff ID is required');
      if (pass !== pass2) throw new Error('Passwords do not match');

      // Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      // Update display name
      if (name) await updateProfile(cred.user, { displayName: name });

      // Save user info in Firestore with the requested role (note: admin privileges
      // must still be granted server-side via custom claims; creating a Firestore
      // user with role:'admin' does NOT automatically grant admin auth claims).
      // For admin requests, save as 'admin-pending' so they cannot access student pages.
      const firestoreRole = requestedRole === 'admin' ? 'admin-pending' : requestedRole;
      
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        displayName: name || '',
        email: email,
        role: firestoreRole,
        ...(requestedRole === 'student' ? { studentNumber: studentNumber.trim() } : { staffId: staffId.trim() }),
        requestedAdmin: requestedRole === 'admin' ? true : false,
        createdAt: new Date(),
        isActive: true,
        updatedAt: new Date().toISOString(),
      });

      // Read-back verification to avoid accidental student access if the role write failed.
      const written = await getDoc(doc(db, "users", cred.user.uid));
      const writtenRole = written.data()?.role;
      if (requestedRole === "admin" && writtenRole !== "admin-pending") {
        throw new Error(
          "Account created, but admin-pending profile was not saved. Please contact support or try again."
        );
      }

      // Store auth token and role in localStorage for quick access if needed
      const token = await cred.user.getIdToken();
      localStorage.setItem('authToken', token);
      localStorage.setItem('userRole', firestoreRole);

      if (requestedRole === 'admin') {
        setToast({
          type: 'success',
          message: 'Account created! Your admin request is pending approval.',
        });
        setTimeout(() => {
          // Ensure they cannot access student/admin areas until approved.
          signOut(auth).catch(() => {});
          localStorage.removeItem("authToken");
          localStorage.removeItem("userRole");
          nav('/login', { replace: true, state: { pendingApproval: true } });
        }, 1200);
      } else {
        setToast({
          type: 'success',
          message: 'Student account created! Redirecting to your dashboard...',
        });
        setTimeout(() => {
          nav('/student', { replace: true });
        }, 1200);
      }
    } catch (e: any) {
      setErr(e.message ?? 'Signup failed');
      setIsLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
  <div className="min-h-dvh flex flex-col bg-gradient-to-b from-base-200 via-base-200 to-primary/30 relative overflow-hidden">
      {toast && (
        <div className="toast toast-top toast-end z-50 mt-24 mr-4">
          <div className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-error'} shadow-lg`}>
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
      
      {/* Ocean/Fisheries themed background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Water wave gradients */}
  <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
  <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] bg-primary/15 rounded-full blur-3xl"></div>
  <div className="absolute top-1/2 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl"></div>
        
        {/* Bubble elements */}
  <div className="absolute top-[15%] left-[10%] w-4 h-4 bg-primary/20 rounded-full animate-pulse"></div>
  <div className="absolute top-[25%] left-[20%] w-2 h-2 bg-primary/30 rounded-full"></div>
  <div className="absolute top-[40%] left-[8%] w-3 h-3 bg-primary/20 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
  <div className="absolute top-[60%] left-[15%] w-2 h-2 bg-secondary/25 rounded-full"></div>
  <div className="absolute top-[75%] left-[12%] w-5 h-5 bg-primary/15 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        
  <div className="absolute top-[20%] right-[15%] w-3 h-3 bg-primary/20 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
  <div className="absolute top-[35%] right-[10%] w-2 h-2 bg-primary/25 rounded-full"></div>
  <div className="absolute top-[50%] right-[20%] w-4 h-4 bg-secondary/15 rounded-full animate-pulse" style={{animationDelay: '0.7s'}}></div>
  <div className="absolute top-[70%] right-[8%] w-2 h-2 bg-primary/30 rounded-full"></div>
  <div className="absolute top-[85%] right-[18%] w-3 h-3 bg-primary/20 rounded-full animate-pulse" style={{animationDelay: '1.2s'}}></div>

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
        <svg className="absolute top-[75%] right-[12%] w-10 h-6 text-primary/25 rotate-6 opacity-60" viewBox="0 0 24 16" fill="currentColor">
          <path d="M17 8c3-2 5-2 7 0-2 2-4 2-7 0zm-2 0c-3 4-8 6-12 4 0-2 1-4 3-4-2 0-3-2-3-4 4-2 9 0 12 4z" />
        </svg>
        {/* Wave patterns - layered at bottom */}
        <div className="absolute bottom-0 left-0 w-full h-48 overflow-hidden">
          {/* Back wave - slowest */}
    <svg className="absolute bottom-0 left-0 w-[200%] h-full text-primary/40 animate-[wave_20s_ease-in-out_infinite]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,40 C240,100 480,0 720,50 C960,100 1200,10 1440,40 C1680,100 1920,0 2160,50 C2400,100 2640,10 2880,40 L2880,120 L0,120 Z"></path>
          </svg>
          
          {/* Middle wave - medium speed */}
    <svg className="absolute bottom-0 left-0 w-[200%] h-36 text-primary/50 animate-[wave_15s_ease-in-out_infinite_reverse]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,60 C360,10 720,90 1080,30 C1440,60 1800,10 2160,90 C2520,30 2700,50 2880,60 L2880,120 L0,120 Z"></path>
          </svg>
          
          {/* Front wave - fastest */}
    <svg className="absolute bottom-0 left-0 w-[200%] h-28 text-primary/60 animate-[wave_10s_ease-in-out_infinite]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,70 C180,30 360,90 540,50 C720,10 900,70 1080,40 C1260,10 1440,70 1620,30 C1800,90 1980,50 2160,10 C2340,70 2520,40 2700,10 C2800,50 2850,70 2880,70 L2880,120 L0,120 Z"></path>
          </svg>
        </div>
      </div>

      <div className="absolute top-16 sm:top-20 left-2 sm:left-6 z-40">
        <button 
          type="button"
          className="btn btn-ghost btn-sm min-h-11 gap-2 text-base-content/70 hover:text-base-content"
          onClick={() => nav('/')}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      <main className="flex-1 flex items-center justify-center px-3 sm:px-4 pt-24 pb-8 sm:pb-10 relative z-20">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
  <fieldset className="fieldset bg-base-100/90 backdrop-blur-sm border-primary/20 rounded-box border p-5 sm:p-6 shadow-xl shadow-primary/10">
          <legend className="fieldset-legend text-xl font-semibold px-2 flex items-center gap-2">
            FishLERS Sign Up {requestedRole === 'admin' ? '(Admin)' : '(Student)'}
          </legend>

          {err && <p className="text-error text-sm mb-3">{err}</p>}

          {/* Full Name field */}
          <label className="fieldset-label">Full Name <span className="text-error">*</span></label>
          <input
            className="input w-full min-h-11"
            placeholder="Full Name"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isLoading}
            required
          />

          {/* Student Number field - only for students */}
          {requestedRole === 'student' && (
            <>
              <label className="fieldset-label mt-3">Student Number <span className="text-error">*</span></label>
              <input
                className="input w-full min-h-11"
                placeholder="e.g., 2021-12345"
                value={studentNumber}
                onChange={e => setStudentNumber(e.target.value)}
                disabled={isLoading}
                required
              />
            </>
          )}

          {/* Staff ID field - only for admins */}
          {requestedRole === 'admin' && (
            <>
              <label className="fieldset-label mt-3">Staff ID <span className="text-error">*</span></label>
              <input
                className="input w-full min-h-11"
                placeholder="e.g., STAFF-001"
                value={staffId}
                onChange={e => setStaffId(e.target.value)}
                disabled={isLoading}
                required
              />
            </>
          )}

          {/* Email field */}
          <label className="fieldset-label mt-3">Email <span className="text-error">*</span></label>
          <input
            className="input w-full min-h-11"
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={isLoading}
            required
          />

          {/* Password field */}
          <label className="fieldset-label mt-3">Password <span className="text-error">*</span></label>
          <div className="relative">
            <input
              className="input w-full pr-10 min-h-11"
              placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              disabled={isLoading}
              required
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-base-content/60 hover:text-base-content cursor-pointer"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowPassword(!showPassword)}
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

          {/* Confirm Password field */}
          <label className="fieldset-label mt-3">Confirm Password <span className="text-error">*</span></label>
          <div className="relative">
            <input
              className="input w-full pr-10 min-h-11"
              placeholder="Confirm Password"
              type={showPassword2 ? 'text' : 'password'}
              value={pass2}
              onChange={e => setPass2(e.target.value)}
              disabled={isLoading}
              required
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-base-content/60 hover:text-base-content cursor-pointer"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowPassword2(!showPassword2)}
            >
              {showPassword2 ? (
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

          {/* Submit button */}
          <button className="btn btn-primary w-full mt-6 min-h-11" disabled={isLoading}>
            {isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : null}
            {isLoading ? "Creating account..." : "Create Account"}
          </button>

          {/* Footer link */}
          <p className="text-sm mt-4 text-center">
            Have an account? <Link className="link link-primary" to="/login">Log In</Link>
          </p>
        </fieldset>
      </form>
      </main>

      <footer className="relative z-20 mt-auto">
        <div className="h-16 relative overflow-hidden">
          <svg className="absolute bottom-0 left-0 w-[200%] h-full text-primary/40 animate-[wave_18s_ease-in-out_infinite]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,50 C240,90 480,20 720,60 C960,100 1200,30 1440,50 C1680,90 1920,20 2160,60 C2400,100 2640,30 2880,50 L2880,120 L0,120 Z"></path>
          </svg>
          <svg className="absolute bottom-0 left-0 w-[200%] h-14 text-primary/60 animate-[wave_12s_ease-in-out_infinite_reverse]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,80 C360,40 720,90 1080,60 C1440,80 1800,40 2160,90 C2520,60 2700,70 2880,80 L2880,120 L0,120 Z"></path>
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
