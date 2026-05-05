export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "declined"
  | "ongoing"
  | "returned"
  | "completed"
  | "cancelled"
  | "unknown";

export interface AnalyticsRequestItem {
  equipmentID?: string;
  name?: string;
  qty: number;
}

export interface AnalyticsRequest {
  id: string;
  status: RequestStatus | string;
  createdAt: any;
  createdAtClient?: string;
  createdBy?: string;
  userID?: string;
  purpose?: string;
  adviser?: string;
  startDate?: string;
  endDate?: string;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
  returnedAt?: any;
  cancelledAt?: any;
  items?: any[];
}

export interface AnalyticsEquipment {
  equipmentID: string;
  name: string;
  totalInventory: number;
  category?: string;
  isDisposable?: boolean;
}

export interface AnalyticsUser {
  uid: string;
  role?: string;
  displayName?: string;
  email?: string;
  department?: string;
  course?: string;
  section?: string;
  isActive?: boolean;
}

export type TimeGranularity = "daily" | "weekly" | "monthly";

export interface AnalyticsFilters {
  dateFrom: Date;
  dateTo: Date;
  status: "all" | string;
  equipmentCategory: "all" | string;
  userType: "all" | "student" | "admin" | string;
}

