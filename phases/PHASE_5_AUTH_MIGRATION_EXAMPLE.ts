/**
 * PHASE 5: Auth Feature Frontend Migration Example
 *
 * This file shows how to convert auth operations from Firebase Auth (client SDK)
 * to API calls via the auth.api wrapper.
 *
 * INSTRUCTIONS:
 * 1. Create/update client/src/hooks/useAuth.ts with code from this file
 * 2. Replace Firebase Auth calls with API calls
 * 3. Update client/src/pages/Login.tsx and Signup.tsx to use new auth API
 * 4. Test login/signup in browser
 */

import { useEffect, useState } from "react";
import * as authApi from "../api/auth.api";

/**
 * User type (from API).
 */
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: "student" | "admin";
}

/**
 * useAuth Hook
 *
 * Key changes from Firebase:
 * - No Firebase onAuthStateChanged listener
 * - Check localStorage for stored token
 * - Verify token with backend on mount
 * - Handle auth errors via API responses
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if user is already logged in.
   * Called on component mount.
   */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("authToken");

        if (!token) {
          // No token stored, user is not logged in
          setUser(null);
          setLoading(false);
          return;
        }

        // Verify token with backend
        const userData = await authApi.verifyToken(token);
        setUser(userData);
        setError(null);
      } catch (err: any) {
        console.error("Auth verification failed:", err);
        // Token is invalid or expired, clear it
        localStorage.removeItem("authToken");
        setUser(null);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * Sign up a new user.
   * REPLACEMENT for Firebase createUserWithEmailAndPassword.
   */
  const signup = async (email: string, password: string, displayName: string) => {
    try {
      setLoading(true);
      const userData = await authApi.signup(email, password, displayName);

      // Note: API returns user data but not token
      // In production, you'd need to automatically login after signup
      // For now, redirect to login page
      setUser(userData);
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
   * Note: Firebase has built-in login, but you'll need to create an endpoint
   * or use a third-party auth service that returns ID tokens.
   *
   * For now, this is a placeholder for manual login flow.
   */
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);

      // TODO: Create POST /api/auth/login endpoint
      // This should:
      // 1. Verify email/password against Firebase Auth
      // 2. Generate custom token or use Firebase ID token
      // 3. Return token in response
      //
      // For now, use Firebase client SDK to get token:
      // const cred = await signInWithEmailAndPassword(auth, email, password);
      // const token = await cred.user.getIdToken();

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
   * REPLACEMENT for Firebase signOut.
   */
  const logout = async () => {
    try {
      // Clear localStorage
      localStorage.removeItem("authToken");
      setUser(null);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Update user profile (display name, etc).
   * REPLACEMENT for Firebase updateProfile.
   */
  const updateProfile = async (displayName: string) => {
    try {
      setLoading(true);
      const updated = await authApi.updateProfile(displayName);
      setUser(updated);
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
      setUser(userData);
      return userData;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Send password reset email.
   * TODO: Create POST /api/auth/reset-password endpoint.
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

  return {
    user,
    loading,
    error,
    signup,
    login,
    logout,
    updateProfile,
    getCurrentUser,
    resetPassword,
    isAuthenticated: !!user,
  };
}

export default useAuth;
