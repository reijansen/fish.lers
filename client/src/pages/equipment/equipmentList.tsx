import { Equipment, Category } from "../../db";
import React, { useState } from "react";
import ConfirmDialog from "../../components/confirmDialog";

interface EquipmentListProps {
  items: Equipment[];
  categories: Category[]; // Added to map categoryID to Name
  onUpdate: (id: string, info: Partial<Omit<Equipment, "equipmentID">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function EquipmentList({ items, categories, onUpdate, onDelete }: EquipmentListProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [confirmData, setConfirmData] = useState<{
    title: string;
    message: string;
    action: () => void | Promise<void>;
    confirmClass?: string;
  } | null>(null);

  // Helper to find the name of the category from the provided ID
  const getCategoryName = (id?: string) => {
    if (!id) return "Uncategorized";
    return categories.find((c) => c.categoryID === id)?.name || "Uncategorized";
  };

  const openConfirm = (
    title: string,
    message: string,
    action: () => void | Promise<void>,
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
    <div className="space-y-3 mt-6">
      {items.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-md text-base-content/50">
          No equipment found matching the criteria.
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.equipmentID}
            className="flex flex-col md:flex-row justify-between items-start md:items-center border bg-base-100 p-4 rounded-lg shadow-sm gap-4"
          >
            <div className="flex gap-4 items-center">
              {item.imageLink ? (
                <img
                  src={item.imageLink}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-md bg-base-200"
                />
              ) : (
                <div className="w-16 h-16 bg-base-300 rounded-md flex items-center justify-center text-xs text-base-content/40">
                  No Image
                </div>
              )}

              <div>
                <p className="font-bold text-lg">{item.name}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="badge badge-outline text-xs">
                    Qty: {item.totalInventory}
                  </span>
                  <span className="badge badge-secondary badge-outline text-xs">
                    {getCategoryName(item.categoryID)}
                  </span>
                  {item.isDisposable && (
                    <span className="badge badge-success badge-sm">Disposable</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <button
                className="btn btn-sm btn-outline flex-1 md:flex-none"
                onClick={() =>
                  onUpdate(item.equipmentID!, { isDisposable: !item.isDisposable })
                }
              >
                Toggle Disposable
              </button>
              <button
                className="btn btn-sm btn-error flex-1 md:flex-none"
                onClick={() => {
                  openConfirm(
                    "Delete Equipment",
                    `Are you sure you want to delete ${item.name}? This cannot be undone.`,
                    () => onDelete(item.equipmentID!),
                    "btn-error"
                  );
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
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
    </div>
  );
}