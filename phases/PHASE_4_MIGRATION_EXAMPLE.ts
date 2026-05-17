/**
 * PHASE 4: Equipment Feature Frontend Migration Example
 *
 * This file shows how to convert logicEquipment.ts from direct Firestore calls
 * to API calls via the equipment.api wrapper.
 *
 * INSTRUCTIONS:
 * 1. Replace the imports in logicEquipment.ts with the NEW code below
 * 2. Replace each handler function with the API-based versions
 * 3. Test thoroughly in the browser
 * 4. Once working, delete query.ts (no longer needed)
 */

import { useEffect, useState } from "react";
import { Equipment, AvailableEquipmentItem } from "../../db";
import * as equipmentApi from "../../api/equipment.api";

/**
 * REPLACEMENT for logicEquipment hook.
 *
 * Key changes:
 * - No more Firestore listeners (listenerEquipment)
 * - Uses polling instead (fetches every 5 seconds)
 * - All operations go through equipmentApi.* functions
 * - Error handling for network failures
 */
export function logicEquipment() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch equipment from API.
   * Called on mount and periodically.
   */
  const fetchEquipment = async () => {
    try {
      const items = await equipmentApi.listEquipment();
      setEquipmentList(items);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch equipment:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Setup polling to refetch equipment every 5 seconds.
   * This simulates the real-time behavior of Firestore listeners.
   *
   * TODO: Replace with WebSocket or Server-Sent Events later for true real-time.
   */
  useEffect(() => {
    let isMounted = true;

    // Fetch immediately on mount
    fetchEquipment();

    // Poll every 5 seconds
    const interval = setInterval(() => {
      if (isMounted) {
        fetchEquipment();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  /**
   * REPLACEMENT for old handleAdd.
   * Create equipment and refetch list.
   */
  const handleAdd = async (equipment: Omit<Equipment, "equipmentID">) => {
    try {
      await equipmentApi.createEquipment(equipment);
      // Refetch to get the new item in the list
      await fetchEquipment();
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
      // Refetch to get the updated item
      await fetchEquipment();
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
      // Refetch to remove from list
      await fetchEquipment();
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
      // Refetch to remove from list
      await fetchEquipment();
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
      // Refetch to remove from active list
      await fetchEquipment();
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
      // Refetch to add back to active list
      await fetchEquipment();
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
  const [availableEquipment, setAvailableEquipment] = useState<AvailableEquipmentItem[]>([]);
  const [activeReservations, setActiveReservations] = useState<Record<string, number>>({});

  // TODO: For now, this still uses Firestore directly for requests.
  // After requests are migrated to the API, replace with API call.
  useEffect(() => {
    // TEMPORARY: Still using Firestore for requests
    // This will be replaced with API call in Phase X (requests migration)
    import("firebase/firestore").then(({ collection, onSnapshot }) => {
      import("../../firebase").then(({ db }) => {
        const unsubscribe = onSnapshot(collection(db, "requests"), (snapshot) => {
          const reservedTotals: Record<string, number> = {};
          snapshot.forEach((doc) => {
            const data = doc.data() as any;
            const status = (data.status || "").toString().toLowerCase();
            if (status !== "pending" && status !== "ongoing") return;
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
        return () => unsubscribe();
      });
    });
  }, []);

  useEffect(() => {
    const activeEquipment = (equipmentList || []).filter((item) => !item.isDeleted);
    const available = activeEquipment.map((eq) => {
      const reserved = activeReservations[eq.equipmentID || ""] || 0;
      const availableCount = (eq.totalInventory || 0) - reserved;
      return {
        ...eq,
        available: Math.max(0, availableCount),
        reserved,
        isAvailable: availableCount > 0,
      };
    });
    setAvailableEquipment(available);
  }, [equipmentList, activeReservations]);

  return { availableEquipment, activeReservations };
}
