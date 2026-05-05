export interface Equipment {
    equipmentID?: string;
    imageLink?: string;
    name: string;
    totalInventory: number;
    categoryID?: string;
    isDisposable: boolean;
    isDeleted?: boolean;
    deletedAt?: string;
    purgedAt?: string;
    serialNumbers?: string[];
}

export interface AvailableEquipmentItem extends Equipment {
    available: number;
    reserved: number;
    isAvailable: boolean;
}

export interface EquipmentIssue {
    equipmentIssueID?: string;
    equipmentID: string;
    description: string;
    // reporterID?: string;
    // issueStatus: string;
    // reportedAt: Date;
    // resolvedAt?: Date;
}

export interface Category {
    categoryID?: string;
    name: string;
    description?: string;
    createdAt?: string;
}

export interface Announcement {
  announcementID?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  visibleTo: ('student' | 'admin' | 'superadmin')[];
  startDate?: string;
  endDate?: string;
  active: boolean;
  createdAt?: string;
  createdBy?: string;
  // Approval workflow fields
  status: 'pending' | 'approved' | 'rejected';
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}