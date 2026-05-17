/**
 * User Model
 * Domain model for user accounts in the system.
 */
export interface User {
  uid: string; // Firebase UID
  email: string;
  displayName?: string;
  role: "student" | "admin" | "admin-pending"; // Student, admin, or pending admin approval
  isSuperAdmin?: boolean; // Higher-privilege admin that can override admin decisions
  requestedAdmin?: boolean; // Pending admin request awaiting super-admin approval
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

/**
 * What can be updated by users or admins
 */
export type UserUpdateInput = Partial<Omit<User, "uid" | "createdAt" | "updatedAt">>;

/**
 * Auth response from login/signup
 */
export interface AuthResponse {
  user: User;
  token: string; // Firebase ID token
}

/**
 * Signup/Login request payload
 */
export interface AuthPayload {
  email: string;
  password: string;
  displayName?: string; // Only for signup
}
