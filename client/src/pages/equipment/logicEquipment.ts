import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Equipment, AvailableEquipmentItem } from "../../db";
import * as equipmentApi from "../../api/equipment.api";
import { useToast } from "../../context/toastContext";
/**
 * REPLACEMENT for logicEquipment hook.
 *
 * Key changes:
 * - No more Firestore listeners (listenerEquipment)
 * - Fetches on mount, visibility return, and after mutations
 * - All operations go through equipmentApi.* functions
 * - Error handling for network failures
 */
export function logicEquipment() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast  } = useToast();

  // Ref to track the latest request to prevent race conditions
  const lastFetchId = useRef(0);
  const isFetchingRef = useRef(false);
  const cacheRef = useRef<{ data: Equipment[]; timestamp: number } | null>(null);
  const CACHE_TTL_MS = 7000;

  /**
   * Fetch equipment from API.
   * Called on mount, visibility return, and after mutations.
   * * Added isBackground parameter to avoid flickering loaders during polling.
   */
  const fetchEquipment = useCallback(async (isBackground = false, force = false) => {
    const cached = cacheRef.current;
    const now = Date.now();
    if (!force && cached && now - cached.timestamp < CACHE_TTL_MS) {
      setEquipmentList(cached.data);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    const fetchId = ++lastFetchId.current;
    if (!isBackground) setIsLoading(true);

    try {
      const includeArchived = true; // always fetch full dataset for table
      const items = await equipmentApi.listEquipment(includeArchived);

      // Only update state if this is still the most recent request
      if (fetchId === lastFetchId.current) {
        setEquipmentList(items);
        cacheRef.current = { data: items, timestamp: Date.now() };
        setError(null);
      }
    } catch (err: any) {
      console.error("Failed to fetch equipment:", err);
      if (fetchId === lastFetchId.current) {
        setError(err.message);
      }
    } finally {
      isFetchingRef.current = false;
      if (fetchId === lastFetchId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Refetch on mount and when tab becomes visible again.
   */
  useEffect(() => {
    let isMounted = true;

    // Fetch immediately on mount
    fetchEquipment();

    const handleVisibilityChange = () => {
      if (isMounted && document.visibilityState === "visible") {
        fetchEquipment(true, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchEquipment]);

  /**
   * REPLACEMENT for old handleAdd.
   * Create equipment and refetch list.
   */
  const handleAdd = async (equipment: Omit<Equipment, "equipmentID">) => {
    try {
      await equipmentApi.createEquipment(equipment);
      showToast("Equipment added successfully", "success");
      // Refetch to get the new item in the list
      await fetchEquipment(true, true);
    } catch (err: any) {
      console.error("Failed to create equipment:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * REPLACEMENT for old handleEdit.
   * Update equipment and refetch list.
   */
  const handleEdit = async (
    equipmentID: string,
    info: Partial<Omit<Equipment, "equipmentID">>
  ) => {
    try {
      await equipmentApi.updateEquipment(equipmentID, info);
      showToast("Equipment updated successfully", "success");
      // Refetch to get the updated item
      await fetchEquipment(true, true);
    } catch (err: any) {
      console.error("Failed to update equipment:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * REPLACEMENT for old handleDelete.
   * Hard delete equipment and refetch list.
   */
  const handleDelete = async (equipmentID: string) => {
    try {
      await equipmentApi.deleteEquipment(equipmentID);
      showToast("Equipment deleted successfully", "success");
      // Refetch to remove from list
      await fetchEquipment(true, true);
    } catch (err: any) {
      console.error("Failed to delete equipment:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * REPLACEMENT for old handlePurge.
   * Delete equipment (which automatically logs it to purged collection via backend).
   */
  const handlePurge = async (item: Equipment) => {
    if (!item.equipmentID) return;
    try {
      await equipmentApi.deleteEquipment(item.equipmentID);
      showToast("Equipment purged successfully", "success");
      // Refetch to remove from list
      await fetchEquipment(true, true);
    } catch (err: any) {
      console.error("Failed to purge equipment:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * REPLACEMENT for old handleArchive.
   * Soft delete (archive) equipment and refetch list.
   */
  const handleArchive = async (equipmentID: string) => {
    try {
      await equipmentApi.archiveEquipment(equipmentID);
      showToast("Equipment archived successfully", "success");
      // Refetch to remove from active list
      await fetchEquipment(true, true);
    } catch (err: any) {
      console.error("Failed to archive equipment:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * REPLACEMENT for old handleRestore.
   * Restore archived equipment and refetch list.
   */
  const handleRestore = async (equipmentID: string) => {
    try {
      await equipmentApi.restoreEquipment(equipmentID);
      showToast("Equipment restored successfully", "success");
      // Refetch to add back to active list
      await fetchEquipment(true, true);
    } catch (err: any) {
      console.error("Failed to restore equipment:", err);
      setError(err.message);
      throw err;
    }
  };

  return {
    equipmentList,
    handleAdd,
    handleEdit,
    handleDelete,
    isLoading,
    handleArchive,
    handleRestore,
    handlePurge,
    error, // NEW: expose error state to components
  };
}

/**
 * REPLACEMENT for useFetchAvailableItems.
 *
 * This hook still calculates available inventory based on active reservations.
 * But now it fetches from the API instead of direct Firestore.
 *
 * NOTES:
 * - Still depends on equipment list (passed as parameter)
 * - Reads from Firestore directly to get active requests (TEMPORARY)
 * - TODO: Move request reading to API call once requests are migrated
 */
export function useFetchAvailableItems(
  equipmentList: Equipment[],
  _startDate?: string,
  _endDate?: string
) {
  const [activeReservations, setActiveReservations] = useState<Record<string, number>>({});

  // TODO: For now, this still uses Firestore directly for requests.
  // After requests are migrated to the API, replace with API call.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    // TEMPORARY: Still using Firestore for requests
    // This will be replaced with API call in Phase X (requests migration)
    const setupListener = async () => {
      const { collection, onSnapshot, query, where } = await import("firebase/firestore");
      const { db } = await import("../../firebase");

      // Optimization: Filter by status 'ongoing' at the query level
      const q = query(collection(db, "requests"), where("status", "==", "ongoing"));

      unsubscribe = onSnapshot(q, (snapshot) => {
        const reservedTotals: Record<string, number> = {};

        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          const reqStart = data.startDate;
          const reqEnd = data.endDate;

          if (_startDate && _endDate && reqStart && reqEnd) {
            const userStart = new Date(_startDate);
            const userEnd = new Date(_endDate);
            const existingStart = new Date(reqStart);
            const existingEnd = new Date(reqEnd);

            const overlaps = userStart <= existingEnd && userEnd >= existingStart;

            if (!overlaps) return;
          }

          const items = Array.isArray(data.items) ? data.items : [];
          items.forEach((item: any) => {
            const equipmentID = item?.equipmentID;
            const qty = Number(item?.qty) || 0;
            if (!equipmentID || qty <= 0) return;
            reservedTotals[equipmentID] = (reservedTotals[equipmentID] || 0) + qty;
          });
        });
        setActiveReservations(reservedTotals);
      });
    };

    setupListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [_startDate, _endDate]);

  /**
   * Memoize calculations to prevent recalculating on every parent render
   * unless the equipmentList or activeReservations actually change.
   */
  const availableEquipment = useMemo(() => {
    const activeEquipment = (equipmentList || []).filter((item) => !item.isDeleted);
    return activeEquipment.map((eq) => {
      const reserved = activeReservations[eq.equipmentID || ""] || 0;
      const availableCount = (eq.totalInventory || 0) - reserved;
      return {
        ...eq,
        available: Math.max(0, availableCount),
        reserved,
        isAvailable: availableCount > 0,
      } as AvailableEquipmentItem;
    });
  }, [equipmentList, activeReservations]);

  return { availableEquipment, activeReservations };
}
