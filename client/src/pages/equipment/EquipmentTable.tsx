import React from "react";
import EditEquipmentDialog from "./EditEquipmentDialog";
import { Equipment, Category } from "../../db";
import ConfirmDialog from "../../components/confirmDialog";

interface EquipmentTableProps {
  equipmentList: Equipment[];
  categories: Category[]; // Added categories for lookup
  onEdit: (id: string, info: Partial<Omit<Equipment, "equipmentID">>) => Promise<void>
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (item: Equipment) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (order: "asc" | "desc") => void;
  view: "active" | "archived" | "purged";
}

const LOW_STOCK_THRESHOLD = 5;

export default function EquipmentTable({
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
}: EquipmentTableProps) {
  const [selectedItem, setSelectedItem] = React.useState<Equipment | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [inlineEditItem, setInlineEditItem] = React.useState<Equipment | null>(null);

  // Helper to resolve ID to Name
  const getCategoryName = React.useCallback((id?: string) => {
    if (!id) return "Uncategorized";
    const found = categories.find(c => c.categoryID === id);
    return found ? found.name : "Uncategorized";
  }, [categories]);

  const getSerialNumbers = React.useCallback((item: Equipment | null) => {
    if (!item || item.isDisposable) return [];
    if (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
      return item.serialNumbers;
    }
    const qty = Math.max(item.totalInventory ?? 0, 0);
    const base = (item.equipmentID || item.name || "ITEM").toString();
    const prefix = base.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ITEM";
    return Array.from({ length: qty }, (_, idx) => `${prefix}-${String(idx + 1).padStart(3, "0")}`);
  }, []);

  const openDetails = (item: Equipment) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const closeDetails = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
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
    <div className="overflow-x-auto">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
        <div className="form-control w-full sm:w-60">
          <label className="label py-1">
            <span className="label-text text-sm font-medium">Sort alphabetically</span>
          </label>
          <select
            className="select select-bordered select-sm"
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as "asc" | "desc")}
          >
            <option value="asc">A → Z (Ascending)</option>
            <option value="desc">Z → A (Descending)</option>
          </select>
        </div>
      </div>
      <table className="table w-full min-w-[720px]">
        <thead>
          <tr>
            <th>Name</th>
            <th>Quantity</th>
            <th>Category</th>
            <th>Disposable</th>
            <th>Image</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {equipmentList.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-8 text-base-content/60">
                No equipment found
              </td>
            </tr>
          ) : (
            equipmentList.map((item) => {
              const archived = !!item.isDeleted;
              const archivedAt = item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : null;
              const purgedAt = (item as any).purgedAt ? new Date((item as any).purgedAt).toLocaleDateString() : null;
              const statusLabel = view === "purged" ? "Purged" : "Archived";
              return (
                <tr
                  key={item.equipmentID}
                  className={`transition-colors cursor-pointer ${!archived ? "hover:bg-primary/10" : ""
                    }`}
                  onClick={() => openDetails(item)}
                >
                  <td>
                    <div className="font-semibold">{item.name}</div>
                    {item.equipmentID && (
                      <div className="text-xs text-base-content/60">ID: {item.equipmentID}</div>
                    )}
                    {archived && (
                      <div className="text-xs flex items-center gap-2 mt-1 text-warning">
                        <span className={`badge ${view === "purged" ? "badge-error" : "badge-warning"} badge-outline`}>
                          {statusLabel}
                        </span>
                        {(view === "purged" ? purgedAt : archivedAt) && (
                          <span>since {view === "purged" ? purgedAt : archivedAt}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.totalInventory ?? 0}</span>
                        {(item.totalInventory ?? 0) <= LOW_STOCK_THRESHOLD && (
                          <span className="badge badge-warning badge-sm">Low</span>
                        )}
                      </div>
                      <div className="text-xs text-base-content/60">
                        Pending: {(item as any).reserved ?? 0} · Available now:{" "}
                        {Math.max((item.totalInventory ?? 0) - ((item as any).reserved ?? 0), 0)}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-outline">
                      {getCategoryName(item.categoryID)}
                    </span>
                  </td>
                  <td>
                    {item.isDisposable ? (
                      <span className="badge badge-success">Disposable</span>
                    ) : (
                      <span className="badge badge-neutral">Durable</span>
                    )}
                  </td>
                  <td>
                    {item.imageLink ? (
                      <img
                        src={item.imageLink}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <span className="text-base-content/60">No image</span>
                    )}
                  </td>
                  <td className="justify-center items-center gap-2">
                    <div
                      className="flex flex-wrap gap-2 justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {view === "active" && !archived && (
                        <>
                          <EditEquipmentDialog item={item} categories={categories} onEdit={onEdit} />
                          <button
                            className="btn btn-xs"
                            onClick={() => {
                              openConfirm(
                                "Archive Equipment",
                                `Archive ${item.name}? This hides it from requests but keeps history.`,
                                () => onArchive(item.equipmentID!),
                                "btn-warning"
                              );
                            }}
                          >
                            Archive
                          </button>
                        </>
                      )}
                      {view === "archived" && archived && (
                        <>
                          <button
                            className="btn btn-xs btn-ghost"
                            onClick={() => {
                              if (!item.equipmentID) return;

                              openConfirm(
                                "Restore Equipment",
                                `Restore ${item.name}? This will make it active again.`,
                                () => onRestore(item.equipmentID!)
                              );
                            }}
                          >
                            Restore
                          </button>
                          <button
                            className="btn btn-xs btn-error"
                            onClick={() => {
                              openConfirm(
                                "Permanently Delete",
                                `Permanently delete ${item.name}? This cannot be undone.`,
                                () => onPurge(item),
                                "btn-error"
                              );
                            }}
                          >
                            Purge
                          </button>
                        </>
                      )}
                      {view === "purged" && (
                        <div className="text-xs text-base-content/60">
                          History record
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
      {isModalOpen && selectedItem && (
        <div
          className="modal modal-open modal-bottom sm:modal-middle"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetails();
          }}
        >
          <div className="modal-box w-full max-w-2xl p-6">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4"
              onClick={(e) => {
                e.stopPropagation();
                closeDetails();
              }}
            >
              X
            </button>
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-sm text-base-content/60">Equipment</p>
                <h3 className="text-2xl font-bold leading-tight">{selectedItem.name}</h3>
                {selectedItem.equipmentID && (
                  <p className="text-sm text-base-content/60 mt-1">
                    ID: {selectedItem.equipmentID}
                  </p>
                )}
                {selectedItem.isDeleted && (
                  <div className="alert alert-warning mt-3">
                    <span>
                      Archived item{selectedItem.deletedAt ? ` since ${new Date(selectedItem.deletedAt).toLocaleString()}` : ''}.
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-base-200 rounded-xl p-4 flex items-center justify-center">
                  {selectedItem.imageLink ? (
                    <img
                      src={selectedItem.imageLink}
                      alt={selectedItem.name}
                      className="w-full max-h-96 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-base-content/60 text-center py-16">No image available</div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-base-content/60 uppercase tracking-wide">Category</p>
                      <p className="text-lg font-semibold">
                        {getCategoryName(selectedItem.categoryID)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-base-content/60 uppercase tracking-wide">Type</p>
                      <p className="text-lg font-semibold">
                        {selectedItem.isDisposable ? "Disposable" : "Durable"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-base-content/60 uppercase tracking-wide">Quantity</p>
                      <p className="text-lg font-semibold">{selectedItem.totalInventory ?? 0}</p>
                      <p className="text-xs text-base-content/60">
                        Pending: {(selectedItem as any).reserved ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-base-content/60 uppercase tracking-wide">Status</p>
                      <p className="text-lg font-semibold">
                        {(selectedItem.totalInventory ?? 0) <= LOW_STOCK_THRESHOLD ? "Low Stock" : "In Stock"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-outline">
                      {selectedItem.isDisposable ? "Single-use" : "Reusable"}
                    </span>
                    {(selectedItem.totalInventory ?? 0) <= LOW_STOCK_THRESHOLD && (
                      <span className="badge badge-warning">Needs restock</span>
                    )}
                  </div>
                  {!selectedItem.isDisposable && (
                    <div className="space-y-2">
                      <p className="text-xs text-base-content/60 uppercase tracking-wide">
                        Serial numbers
                      </p>
                      <div className="bg-base-200 rounded-lg p-3 max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {getSerialNumbers(selectedItem).map((serial) => (
                          <span
                            key={serial}
                            className="font-mono text-sm px-2 py-1 rounded border border-base-300 bg-base-100"
                          >
                            {serial}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-base-content/60">
                        Each durable piece is uniquely labeled for return inspections.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <p className="text-sm font-semibold text-base-content/80">Manage item</p>
              <div className="flex flex-wrap gap-2">
                {view === "active" && !selectedItem.isDeleted && (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setInlineEditItem(selectedItem);
                        closeDetails();
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-warning btn-sm"
                      onClick={() => {
                      if (!selectedItem.equipmentID) return;

                      openConfirm(
                        "Archive Equipment",
                        `Archive ${selectedItem.name}? This hides it from requests but keeps history.`,
                        () => onArchive(selectedItem.equipmentID!),
                        "btn-warning"
                      );

                      closeDetails();
                    }}
                    >
                      Archive
                    </button>
                  </>
                )}
                {view === "archived" && selectedItem.isDeleted && (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => {
                        if (!selectedItem.equipmentID) return;
                        onRestore(selectedItem.equipmentID);
                        closeDetails();
                      }}
                    >
                      Restore
                    </button>
                    <button
                      className="btn btn-error btn-sm"
                      onClick={() => {
                      if (!selectedItem.equipmentID) return;

                      openConfirm(
                        "Permanently Delete",
                        `Permanently delete ${selectedItem.name}? This cannot be undone.`,
                        () => onPurge(selectedItem),
                        "btn-error"
                      );

                      closeDetails();
                    }}
                    >
                      Purge
                    </button>
                  </>
                )}
                {view === "purged" && (
                  <div className="text-xs text-base-content/60">
                    This record is already purged. No actions available.
                  </div>
                )}
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={closeDetails}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {inlineEditItem && (
        <EditEquipmentDialog
          item={inlineEditItem}
          categories={categories}
          onEdit={onEdit}
          openImmediately
          onClose={() => setInlineEditItem(null)}
        />
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
        onConfirm={() => {
          confirmData?.action();
          setConfirmOpen(false);
          setConfirmData(null);
        }}
      />
    </div>
  );
}