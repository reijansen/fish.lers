export interface Equipment {
    equipmentID?: string;
    imageLink?: string;
    name: string;
    totalInventory: number;
    categoryID?: string;
    category?: string;
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
