import React, { useState, useEffect, useMemo } from "react";
import { Boxes, Package, Recycle, AlertTriangle } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import CategoryDialog from "./CategoryDialog";
import { db } from "../../firebase";
import { Equipment, Category } from "../../db";
import { logicEquipment } from "./logicEquipment";
import AddEquipmentDialog from "./AddEquipmentDialog";
import EquipmentTable from "./EquipmentTable";
import EquipmentCardList from "./EquipmentCardList";
import LoadingOverlay from "../../components/LoadingOverlay";
import MobileStatsPager from "../../components/MobileStatsPager";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const LOW_STOCK_THRESHOLD = 5;

export default function Dashboard() {
  const {
    equipmentList,
    handleAdd,
    handleEdit,
    handleDelete,
    handleArchive,
    handleRestore,
    handlePurge,
    isLoading
  } = logicEquipment();

  // --- STATE ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "disposable" | "durable">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [tab, setTab] = useState<"active" | "archived" | "purged">("active");
  const [purgedEquipment, setPurgedEquipment] = useState<Equipment[]>([]);

  // --- FIRESTORE SUBSCRIPTIONS ---

  // Listen for Customizable Categories
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        categoryID: doc.id,
        ...doc.data(),
      })) as Category[];
      setCategories(list);
    });
    return () => unsub();
  }, []);

  // Listen for Purged Equipment (History)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "equipment_purged"), (snapshot) => {
      const list: Equipment[] = snapshot.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          equipmentID: doc.id,
          ...data,
          isDeleted: true,
        };
      });
      setPurgedEquipment(list);
    });
    return () => unsub();
  }, []);

  // --- COMPUTED VALUES ---

  const stats = useMemo(() => {
    const totalQuantity = equipmentList.reduce((sum, item) => sum + (item.totalInventory ?? 0), 0);
    const disposableCount = equipmentList.filter((item) => item.isDisposable).length;
    const lowStockCount = equipmentList.filter(
      (item) => (item.totalInventory ?? 0) <= LOW_STOCK_THRESHOLD
    ).length;

    return { totalQuantity, disposableCount, lowStockCount };
  }, [equipmentList]);

  const filteredEquipment = useMemo(() => {
    const search = debouncedSearchTerm.trim().toLowerCase();
    let baseList = equipmentList;

    if (tab === "active") {
      baseList = equipmentList.filter(item => !item.isDeleted);
    } else if (tab === "archived") {
      baseList = equipmentList.filter(item => item.isDeleted);
    } else {
      baseList = purgedEquipment;
    }

    const filtered = baseList.filter((item) => {
      // Search by Name or Category ID
      const matchesSearch =
        !search ||
        item.name?.toLowerCase().includes(search);

      // Filter by Category ID
      const matchesCategory = categoryFilter === "all" || item.categoryID === categoryFilter;

      // Filter by Item Type
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "disposable" ? item.isDisposable : !item.isDisposable);

      return matchesSearch && matchesCategory && matchesType;
    });

    return filtered.sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  }, [equipmentList, purgedEquipment, debouncedSearchTerm, categoryFilter, typeFilter, sortOrder, tab]);

  const filtersActive = searchTerm.trim().length > 0 || categoryFilter !== "all" || typeFilter !== "all";

  const resetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setTypeFilter("all");
  };

  return (
    <>
      <LoadingOverlay show={isLoading} message="Synchronizing inventory..." />

      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Equipment Inventory</h1>
            <p className="text-base-content/70">Manage your lab assets and dynamic categories.</p>
          </div>
          <div className="flex gap-2">
            <CategoryDialog categories={categories} />
            <AddEquipmentDialog onAdd={handleAdd} categories={categories} />
          </div>
        </div>

        {/* Stats Cards */}
        <MobileStatsPager
          breakpoint="lg"
          items={[
            { label: "Unique Items", value: equipmentList.length },
            { label: "Total Quantity", value: stats.totalQuantity, colorClass: "text-secondary" },
            { label: "Disposable", value: stats.disposableCount, colorClass: "text-success" },
            { label: "Low Stock", value: stats.lowStockCount, colorClass: "text-warning" },
          ]}
        />
        <div className="hidden lg:flex stats stats-horizontal shadow bg-base-200 w-full">
          <div className="stat">
            <div className="stat-figure text-primary"><Boxes className="w-8 h-8" /></div>
            <div className="stat-title">Unique Items</div>
            <div className="stat-value">{equipmentList.length}</div>
            
          </div>

          <div className="stat">
            <div className="stat-figure text-secondary"><Package className="w-8 h-8" /></div>
            <div className="stat-title">Total Quantity</div>
            <div className="stat-value">{stats.totalQuantity}</div>
            
          </div>

          <div className="stat">
            <div className="stat-figure text-success"><Recycle className="w-8 h-8" /></div>
            <div className="stat-title">Disposable</div>
            <div className="stat-value">{stats.disposableCount}</div>
            
          </div>

          <div className="stat">
            <div className="stat-figure text-warning"><AlertTriangle className="w-8 h-8" /></div>
            <div className="stat-title">Low Stock</div>
            <div className="stat-value">{stats.lowStockCount}</div>
            
          </div>
        </div>

        {/* Main Card */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body p-0">
            <div className="tabs tabs-boxed bg-base-300 p-2 flex flex-wrap">
              {["active", "archived", "purged"].map((t) => (
                <button
                  key={t}
                  className={`tab capitalize transition-all ${tab === t ? "tab-active bg-primary text-white font-semibold" : ""}`}
                  onClick={() => setTab(t as any)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="card-body space-y-4">
            {tab === "purged" && (
              <div className="alert alert-info py-2">
                <span>Purged items are read-only history of permanently removed equipment.</span>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="form-control w-full">
                <div className="label"><span className="label-text">Search equipment</span></div>
                <input
                  type="text"
                  placeholder="Search by name..."
                  className="input input-bordered w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>

              <label className="form-control w-full lg:w-64">
                <div className="label"><span className="label-text">Category Filter</span></div>
                <select
                  className="select select-bordered"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat.categoryID} value={cat.categoryID}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control w-full lg:w-48">
                <div className="label"><span className="label-text">Item Type</span></div>
                <select
                  className="select select-bordered"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                >
                  <option value="all">All items</option>
                  <option value="disposable">Disposable only</option>
                  <option value="durable">Durable only</option>
                </select>
              </label>

              <div className="flex gap-2 flex-wrap">
                {filtersActive && (
                  <button className="btn btn-ghost" onClick={resetFilters}>Reset</button>
                )}
              </div>
            </div>

            {/* Table Metadata */}
            <div className="text-sm text-base-content/70 flex flex-wrap items-center justify-between gap-2">
              <span>
                Showing <b>{filteredEquipment.length}</b> records in <b>{tab}</b> view
              </span>
              <span className="badge badge-outline">
                {stats.totalQuantity} total pieces • {stats.disposableCount} disposable
              </span>
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block">
              <EquipmentTable
                equipmentList={filteredEquipment}
                categories={categories} // Required to map categoryID to Name for display
                onEdit={handleEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onPurge={handlePurge}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                view={tab}
              />
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden">
              <EquipmentCardList
                equipmentList={filteredEquipment}
                categories={categories}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onPurge={handlePurge}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                view={tab}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
