import React from "react";
import { AlertTriangle, Archive, RotateCcw, Trash2, Pencil } from "lucide-react";
import EditEquipmentDialog from "./EditEquipmentDialog";
import type { Equipment, Category } from "../../db";

interface Props {
  equipmentList: Equipment[];
  categories: Category[];
  onEdit: (id: string, info: Partial<Omit<Equipment, "equipmentID">>) => Promise<void>;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (item: Equipment) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (order: "asc" | "desc") => void;
  view: "active" | "archived" | "purged";
}

const LOW_STOCK_THRESHOLD = 5;

export default function EquipmentCardList({
  equipmentList,
  categories,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  onPurge,
  sortOrder,
  onSortOrderChange,
  view,
}: Props) {
  const [selectedItem, setSelectedItem] = React.useState<Equipment | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const getCategoryName = React.useCallback(
    (id?: string) => {
      if (!id) return "Uncategorized";
      const found = categories.find((c) => c.categoryID === id);
      return found ? found.name : "Uncategorized";
    },
    [categories]
  );

  const openDetails = (item: Equipment) => {
    setSelectedItem(item);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <label className="form-control w-full max-w-xs">
          <div className="label py-1">
            <span className="label-text text-sm font-medium">Sort</span>
          </div>
          <select
            className="select select-bordered"
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as "asc" | "desc")}
          >
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
        </label>
      </div>

      {equipmentList.length === 0 ? (
        <div className="text-center py-10 text-base-content/60">No equipment found</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {equipmentList.map((item) => {
            const archived = !!item.isDeleted;
            const qty = item.totalInventory ?? 0;
            const lowStock = view !== "purged" && !archived && qty <= LOW_STOCK_THRESHOLD;
            const categoryName = getCategoryName(item.categoryID);
            const isDisposable = !!item.isDisposable;

            return (
              <div
                key={item.equipmentID}
                role="button"
                tabIndex={0}
                onClick={() => openDetails(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openDetails(item);
                }}
                className="card bg-base-100 border border-base-300 shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="card-body p-4 space-y-2">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-base leading-snug min-w-0 truncate">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {lowStock && (
                        <span className="badge badge-warning gap-1 whitespace-nowrap">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Low
                        </span>
                      )}
                      {archived && view !== "purged" && (
                        <span className="badge badge-warning badge-outline whitespace-nowrap">Archived</span>
                      )}
                      {view === "purged" && (
                        <span className="badge badge-error badge-outline whitespace-nowrap">Purged</span>
                      )}
                    </div>
                  </div>

                  {/* ID */}
                  {item.equipmentID && (
                    <div className="text-[11px] text-base-content/50 font-mono truncate">
                      ID: {item.equipmentID}
                    </div>
                  )}

                  {/* Key chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-outline max-w-[18rem]">
                      <span className="truncate">{categoryName}</span>
                    </span>
                    <span className={`badge ${isDisposable ? "badge-success" : "badge-neutral"}`}>
                      {isDisposable ? "Disposable" : "Durable"}
                    </span>
                    <span className="badge badge-ghost">Qty: {qty}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailsOpen && selectedItem && (
        <div
          className="modal modal-open modal-bottom sm:modal-middle"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetails();
          }}
        >
          <div className="modal-box w-full max-w-xl p-4 sm:p-6 max-h-[85dvh] overflow-y-auto">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
              onClick={(e) => {
                e.stopPropagation();
                closeDetails();
              }}
            >
              ✕
            </button>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">Equipment</p>
                  <h3 className="text-xl sm:text-2xl font-bold leading-tight truncate">{selectedItem.name}</h3>
                  {selectedItem.equipmentID && (
                    <p className="text-xs text-base-content/60 mt-1 font-mono truncate">
                      ID: {selectedItem.equipmentID}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-base-200 rounded-xl p-3">
                  <div className="text-xs text-base-content/60">Category</div>
                  <div className="font-semibold truncate">{getCategoryName(selectedItem.categoryID)}</div>
                </div>
                <div className="bg-base-200 rounded-xl p-3">
                  <div className="text-xs text-base-content/60">Quantity</div>
                  <div className="font-semibold">{selectedItem.totalInventory ?? 0}</div>
                </div>
                <div className="bg-base-200 rounded-xl p-3">
                  <div className="text-xs text-base-content/60">Type</div>
                  <div className="font-semibold">{selectedItem.isDisposable ? "Disposable" : "Durable"}</div>
                </div>
                <div className="bg-base-200 rounded-xl p-3">
                  <div className="text-xs text-base-content/60">Status</div>
                  <div className="font-semibold">
                    {view === "purged" ? "Purged" : selectedItem.isDeleted ? "Archived" : "Active"}
                  </div>
                </div>
              </div>

              <div className="bg-base-200 rounded-xl p-3">
                <div className="text-xs text-base-content/60 mb-2">Image</div>
                <div className="w-full rounded-lg bg-base-100 border border-base-300 overflow-hidden">
                  {selectedItem.imageLink ? (
                    <img
                      src={selectedItem.imageLink}
                      alt={selectedItem.name}
                      className="w-full h-44 sm:h-56 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-base-content/60 text-center py-10">No image available</div>
                  )}
                </div>
              </div>

              {/* Mobile actions live in the modal */}
              {view !== "purged" && (
                <div className="sticky bottom-0 bg-base-100 pt-3">
                  <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    {view === "active" && !selectedItem.isDeleted && (
                      <>
                        <EditEquipmentDialog
                          item={selectedItem}
                          categories={categories}
                          onEdit={onEdit}
                          renderTrigger={(open) => (
                            <button type="button" className="btn btn-secondary w-full gap-2" onClick={open}>
                              <Pencil className="w-4 h-4" />
                              Edit
                            </button>
                          )}
                        />
                        <button
                          type="button"
                          className="btn btn-outline w-full gap-2"
                          onClick={() => {
                            if (!confirm(`Archive ${selectedItem.name}? This hides it from requests but keeps history.`))
                              return;
                            onArchive(selectedItem.equipmentID!);
                            closeDetails();
                          }}
                        >
                          <Archive className="w-4 h-4" />
                          Archive
                        </button>
                      </>
                    )}
                    {view === "archived" && selectedItem.isDeleted && (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost w-full gap-2"
                          onClick={() => {
                            onRestore(selectedItem.equipmentID!);
                            closeDetails();
                          }}
                        >
                          <RotateCcw className="w-4 h-4" />
                          Restore
                        </button>
                        <button
                          type="button"
                          className="btn btn-error w-full gap-2"
                          onClick={() => {
                            if (!confirm(`Permanently delete ${selectedItem.name}? This cannot be undone.`)) return;
                            onPurge(selectedItem);
                            closeDetails();
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Purge
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
