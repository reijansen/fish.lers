import { getFirestore } from "../config/firebase.js";
import { Category } from "../models/category.js";

const CATEGORY_COLLECTION = "categories";

export class CategoryRepository {
    static async create(data: Omit<Category, "categoryID">): Promise<string> {
        const db = getFirestore();
        const docRef = await db.collection(CATEGORY_COLLECTION).add({
            ...data,
            createdAt: new Date().toISOString(),
        });
        return docRef.id;
    }

    static async getAll(): Promise<Category[]> {
        const db = getFirestore();
        const snapshot = await db.collection(CATEGORY_COLLECTION).get();
        return snapshot.docs.map(doc => ({ categoryID: doc.id, ...doc.data() } as Category));
    }

    static async delete(id: string): Promise<void> {
        const db = getFirestore();
        await db.collection(CATEGORY_COLLECTION).doc(id).delete();
    }

}