export interface Category {
    categoryID?: string;
    name: string;        // e.g., "Laboratory", "Electronics"
    description?: string;
    createdAt?: string;
}

export interface CategoryResponse extends Category {
    categoryID: string;
}