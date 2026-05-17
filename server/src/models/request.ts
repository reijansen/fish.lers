/**
 * Request Model
 * Domain model for equipment reservation requests.
 */
export interface RequestItem {
  equipmentID: string;
  qty: number;
  notes?: string;
}

export interface Request {
  requestID?: string;
  userID: string; // Who requested it
  items: RequestItem[]; // Equipment being requested
  status: "pending" | "approved" | "rejected" | "ongoing" | "returned" | "completed";
  startDate: string; // ISO date
  endDate: string; // ISO date
  purpose?: string; // Reason for borrowing
  approvedBy?: string; // Admin UID who approved
  approvedAt?: string; // ISO timestamp
  rejectedBy?: string; // Admin UID who rejected
  rejectedAt?: string; // ISO timestamp
  rejectionReason?: string; // Why it was rejected
  overriddenBy?: string; // Super admin UID who overrode the decision
  overriddenAt?: string; // ISO timestamp for latest override
  overrideReason?: string; // Why decision was overridden
  overrideFromStatus?: "approved" | "rejected"; // Previous decision status
  returnedAt?: string; // When equipment was returned
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string; // Student's display name
}

/**
 * What can be created/updated
 */
export type RequestCreateInput = Omit<
  Request,
  | "requestID"
  | "createdAt"
  | "updatedAt"
  | "approvedBy"
  | "approvedAt"
  | "rejectedBy"
  | "rejectedAt"
  | "rejectionReason"
  | "overriddenBy"
  | "overriddenAt"
  | "overrideReason"
  | "overrideFromStatus"
  | "returnedAt"
>;

export type RequestUpdateInput = Partial<RequestCreateInput>;

/**
 * Admin approval/rejection payload
 */
export interface RequestApprovalPayload {
  approved: boolean;
  reason?: string; // Rejection reason if rejected
}

/**
 * Request with user info (for responses)
 */
export interface RequestWithUser extends Request {
  user?: {
    email: string;
    displayName?: string;
  };
}
