import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../firebase";
import * as authApi from "../api/auth.api";

/**
 * User type (from API).
 */
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: "student" | "admin";
  isSuperAdmin?: boolean;
}

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  claimRoleLabel: string;
  permissionNotice: string | null;
  dismissPermissionNotice: () => void;
  signup: (email: string, password: string, displayName: string) => Promise<User>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<User>;
  getCurrentUser: () => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider - Context provider for authentication.
 * Wraps the app and manages auth state.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const VERIFY_TTL_MS = 60_000;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [claimRoleLabel, setClaimRoleLabel] = useState("Claim: Student");
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const lastPermissionSignature = useRef<{
    uid: string;
    role: "student" | "admin";
    adminClaim: boolean;
    superAdminClaim: boolean;
  } | null>(null);
  const lastVerifiedUser = useRef<{ token: string; verifiedAt: number; user: User } | null>(null);

  /**
   * Subscribe to Firebase auth state changes and verify user data.
   * This runs whenever the user logs in/out.
   */
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          // User is logged out
          if (mounted) {
            setUser(null);
            setIsAdmin(false);
            setIsSuperAdmin(false);
            setClaimRoleLabel("Claim: Student");
            setPermissionNotice(null);
            lastPermissionSignature.current = null;
            lastVerifiedUser.current = null;
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole");
          }
          return;
        }

        // Use cached token by default; force-refresh only when claims look out of sync.
        try {
          const getVerifiedUser = async (currentToken: string, forceVerify = false) => {
            const now = Date.now();
            const cachedVerification = lastVerifiedUser.current;
            const canReuseVerifiedUser =
              !forceVerify &&
              !!cachedVerification &&
              cachedVerification.token === currentToken &&
              now - cachedVerification.verifiedAt < VERIFY_TTL_MS;

            if (canReuseVerifiedUser) {
              return cachedVerification.user;
            }

            const verifiedUser = await authApi.verifyToken(currentToken);
            lastVerifiedUser.current = { token: currentToken, verifiedAt: now, user: verifiedUser };
            return verifiedUser;
          };

          let idTokenResult = await firebaseUser.getIdTokenResult();
          let token = idTokenResult.token;
          localStorage.setItem("authToken", token);

          let userData = await getVerifiedUser(token);
          let hasAdminClaim = !!idTokenResult.claims.admin || !!idTokenResult.claims.superAdmin;
          let hasSuperAdminClaim = !!idTokenResult.claims.superAdmin;
          // Only treat as refresh-required mismatch when claims are missing for stored privileges.
          // If claims are ahead of profile data (e.g. promoted but profile not synced yet), do not
          // force a warning loop because claims are the runtime source of truth.
          let roleClaimMismatch = userData.role === "admin" && !hasAdminClaim;
          let superClaimMismatch = !!userData.isSuperAdmin && !hasSuperAdminClaim;

          if (roleClaimMismatch || superClaimMismatch) {
            // Claims may be stale after permission updates; force refresh once.
            idTokenResult = await firebaseUser.getIdTokenResult(true);
            token = idTokenResult.token;
            localStorage.setItem("authToken", token);
            userData = await getVerifiedUser(token, true);
            hasAdminClaim = !!idTokenResult.claims.admin || !!idTokenResult.claims.superAdmin;
            hasSuperAdminClaim = !!idTokenResult.claims.superAdmin;
            roleClaimMismatch = userData.role === "admin" && !hasAdminClaim;
            superClaimMismatch = !!userData.isSuperAdmin && !hasSuperAdminClaim;
          }

          const resolvedUser: User = {
            ...userData,
            // Claims are the runtime source of truth; fallback to API payload for compatibility.
            isSuperAdmin: hasSuperAdminClaim || !!userData.isSuperAdmin,
          };
          const currentSignature = {
            uid: resolvedUser.uid,
            role: resolvedUser.role,
            adminClaim: hasAdminClaim,
            superAdminClaim: hasSuperAdminClaim,
          };
          const previousSignature = lastPermissionSignature.current;

          if (mounted) {
            setUser(resolvedUser);
            setIsAdmin(hasAdminClaim && resolvedUser.role === "admin");
            setIsSuperAdmin(!!resolvedUser.isSuperAdmin);
            setClaimRoleLabel(
              hasSuperAdminClaim
                ? "Claim: Super Admin"
                : hasAdminClaim
                ? "Claim: Admin"
                : "Claim: Student"
            );
            if (roleClaimMismatch || superClaimMismatch) {
              setPermissionNotice(
                "Permissions were updated for this account. Please re-login to refresh your token and apply access changes."
              );
            } else if (
              previousSignature &&
              previousSignature.uid === currentSignature.uid &&
              (previousSignature.role !== currentSignature.role ||
                previousSignature.adminClaim !== currentSignature.adminClaim ||
                previousSignature.superAdminClaim !== currentSignature.superAdminClaim)
            ) {
              setPermissionNotice(
                "Session permissions changed. Refresh this page or re-login if any access looks out of sync."
              );
            } else {
              setPermissionNotice(null);
            }
            lastPermissionSignature.current = currentSignature;
            localStorage.setItem("userRole", resolvedUser.role);
            setError(null);
          }
        } catch (err: any) {
          console.error("Auth verification failed:", err);
          // Token is invalid or expired, clear it
          if (mounted) {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole");
            setUser(null);
            setIsAdmin(false);
            setIsSuperAdmin(false);
            setClaimRoleLabel("Claim: Student");
            setPermissionNotice(null);
            lastPermissionSignature.current = null;
            lastVerifiedUser.current = null;
            setError(err.message);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  /**
   * Sign up a new user.
   */
  const signup = async (email: string, password: string, displayName: string) => {
    try {
      setLoading(true);
      const userData = await authApi.signup(email, password, displayName);
      setUser(userData);
      setIsSuperAdmin(!!userData.isSuperAdmin);
      setClaimRoleLabel(
        userData.isSuperAdmin ? "Claim: Super Admin" : userData.role === "admin" ? "Claim: Admin" : "Claim: Student"
      );
      setError(null);
      return userData;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Log in an existing user.
   */
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      alert("Login not yet implemented via API. Use Firebase client SDK or create login endpoint.");
      throw new Error("Login endpoint not implemented");
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Log out the current user.
   */
  const logout = async () => {
    try {
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      // Clear all stored auth data
      localStorage.removeItem("authToken");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userSeenStatuses");
      localStorage.removeItem("studentNotificationHistory");
      
      // Clear state
      setUser(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setClaimRoleLabel("Claim: Student");
      setPermissionNotice(null);
      lastPermissionSignature.current = null;
      lastVerifiedUser.current = null;
      setError(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Update user profile (display name, etc).
   */
  const updateProfile = async (displayName: string) => {
    try {
      setLoading(true);
      const updated = await authApi.updateProfile(displayName);
      setUser((prev) => ({
        ...(prev || updated),
        ...updated,
        isSuperAdmin: prev?.isSuperAdmin ?? !!updated.isSuperAdmin,
      }));
      setError(null);
      return updated;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get current user data.
   */
  const getCurrentUser = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser((prev) => ({
        ...(prev || userData),
        ...userData,
        isSuperAdmin: prev?.isSuperAdmin ?? !!userData.isSuperAdmin,
      }));
      return userData;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Send password reset email.
   */
  const resetPassword = async (email: string) => {
    try {
      alert("Password reset not yet implemented. Use Firebase client SDK or create endpoint.");
      throw new Error("Password reset not implemented");
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    isAdmin,
    isSuperAdmin,
    claimRoleLabel,
    permissionNotice,
    dismissPermissionNotice: () => setPermissionNotice(null),
    signup,
    login,
    logout,
    updateProfile,
    getCurrentUser,
    resetPassword,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth Hook - Use in components to access auth state and methods.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default useAuth;
