import React, { useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { Category } from "../../db";
import ConfirmDialog from "../../components/confirmDialog";

interface CategoryDialogProps {
    categories: Category[];
}

export default function CategoryDialog({ categories }: CategoryDialogProps) {
    const [newCategory, setNewCategory] = useState("");

    const handleAddCategory = async () => {
        if (!newCategory.trim()) return;
        try {
            await addDoc(collection(db, "categories"), {
                name: newCategory.trim(),
                createdAt: new Date().toISOString()
            });
            setNewCategory("");
        } catch (error) {
            console.error("Error adding category:", error);
        }
    };

    const handleDeleteCategory = async (
        id: string | undefined,
        name: string
    ) => {
        if (!id) return;

        openConfirm(
            "Delete Category",
            `Delete "${name}" category? This cannot be undone.`,
            async () => {
            try {
                await deleteDoc(doc(db, "categories", id));
            } catch (error) {
                console.error("Error deleting category:", error);
            }
            },
            "btn-error"
        );
    };
    
    // confirmation dialog state
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [confirmData, setConfirmData] = React.useState<{
        title: string;
        message: string;
        action: () => void;
        confirmClass?: string;
    } | null>(null);

    // confirm dialog helper
    const openConfirm = (
        title: string,
        message: string,
        action: () => void,
        confirmClass = "btn-primary"
    ) => {
        setConfirmData({
        title,
        message,
        action,
        confirmClass,
        });

        setConfirmOpen(true);
    };
    
    return (
        <>
            {/* The Button to open the Modal */}
            <button
                className="btn btn-primary btn-sm gap-2"
                onClick={() => (window as any).category_modal.showModal()}
            >
                <Tag className="w-4 h-4" />
                Manage Categories
            </button>

            {/* The Modal */}
            <dialog id="category_modal" className="modal">
                <div className="modal-box bg-base-100 w-full max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
                    <h3 className="font-bold text-lg mb-4">Inventory Categories</h3>

                    {/* Add New Category Input */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-6">
                        <input
                            type="text"
                            placeholder="New category name..."
                            className="input input-bordered flex-1"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                        />
                        <button className="btn btn-primary sm:w-auto" onClick={handleAddCategory}>
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </div>

                    {/* List of Existing Categories */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {categories.map((cat) => (
                            <div key={cat.categoryID} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                                <span className="font-medium">{cat.name}</span>
                                <button
                                    className="btn btn-ghost btn-xs text-error"
                                    onClick={() => handleDeleteCategory(cat.categoryID, cat.name)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <p className="text-center text-sm text-base-content/50 py-4">No categories created yet.</p>
                        )}
                    </div>

                    <div className="modal-action sticky bottom-0 bg-base-100 pt-3">
                        <form method="dialog">
                            <button className="btn">Close</button>
                        </form>
                    </div>
                </div>
                <ConfirmDialog
                    open={confirmOpen}
                    title={confirmData?.title}
                    message={confirmData?.message || ""}
                    confirmClass={confirmData?.confirmClass}
                    onCancel={() => {
                        setConfirmOpen(false);
                        setConfirmData(null);
                    }}
                    onConfirm={async () => {
                        await confirmData?.action();
                        setConfirmOpen(false);
                        setConfirmData(null);
                    }}
                />
            </dialog>
        </>
    );
}
