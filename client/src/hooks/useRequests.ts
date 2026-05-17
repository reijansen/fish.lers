import { useEffect, useRef, useState } from "react";
import * as requestsApi from "../api/requests.api";

/**
 * Request type (from API).
 */
export interface Request {
  requestID?: string;
  userID: string;
  items: RequestItem[];
  status: "pending" | "approved" | "rejected" | "ongoing" | "returned" | "completed";
  startDate: string;
  endDate: string;
  purpose?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
  overrideReason?: string;
  overrideFromStatus?: "approved" | "rejected";
  returnedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
}

export interface RequestItem {
  equipmentID: string;
  qty: number;
  notes?: string;
}

/**
 * useRequests Hook
 *
 * Key changes:
 * - No real-time Firestore listeners
 * - Fetches on mount, visibility return, and after mutations
 * - All operations go through requestsApi.* functions
 * - Error handling for network failures
 */
export function useRequests(userID?: string) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const cacheRef = useRef<{ key: string; data: Request[]; timestamp: number } | null>(null);
  const CACHE_TTL_MS = 7000;

  /**
   * Fetch requests from API.
   * Called on mount, tab visibility return, and after mutations.
   */
  const fetchRequests = async (force = false) => {
    const cacheKey = userID || "__all__";
    const cached = cacheRef.current;
    const now = Date.now();

    if (
      !force &&
      cached &&
      cached.key === cacheKey &&
      now - cached.timestamp < CACHE_TTL_MS
    ) {
      setRequests(cached.data);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    try {
      let items: Request[];

      if (userID) {
        // Fetch user's requests
        items = await requestsApi.getRequestsByUser(userID);
      } else {
        // Fetch all requests (admin view)
        items = await requestsApi.listRequests();
      }

      setRequests(items);
      cacheRef.current = { key: cacheKey, data: items, timestamp: Date.now() };
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch requests:", err);
      setError(err.message);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  };

  /**
   * Refetch on mount and when tab becomes visible again.
   */
  useEffect(() => {
    let isMounted = true;

    // Fetch immediately on mount
    fetchRequests();

    const handleVisibilityChange = () => {
      if (isMounted && document.visibilityState === "visible") {
        fetchRequests(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userID]);

  /**
   * Create a new request.
   */
  const createRequest = async (request: Omit<Request, "requestID" | "createdAt" | "updatedAt">) => {
    try {
      await requestsApi.createRequest(request);
      // Refetch to get the new request in the list
      await fetchRequests(true);
    } catch (err: any) {
      console.error("Failed to create request:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Approve a request (admin only).
   */
  const approveRequest = async (requestID: string) => {
    try {
      await requestsApi.approveRequest(requestID);
      // Refetch to update list
      await fetchRequests(true);
    } catch (err: any) {
      console.error("Failed to approve request:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Reject a request (admin only).
   */
  const rejectRequest = async (requestID: string, reason: string) => {
    try {
      await requestsApi.rejectRequest(requestID, reason);
      // Refetch to update list
      await fetchRequests(true);
    } catch (err: any) {
      console.error("Failed to reject request:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Super admin override: rejected -> approved.
   */
  const overrideApproveRequest = async (requestID: string, reason?: string) => {
    try {
      await requestsApi.overrideApproveRequest(requestID, reason);
      await fetchRequests(true);
    } catch (err: any) {
      console.error("Failed to override request to approved:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Super admin override: approved -> rejected.
   */
  const overrideRejectRequest = async (requestID: string, reason: string) => {
    try {
      await requestsApi.overrideRejectRequest(requestID, reason);
      await fetchRequests(true);
    } catch (err: any) {
      console.error("Failed to override request to rejected:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Mark request as ongoing (equipment borrowed).
   */
  const markOngoing = async (requestID: string) => {
    try {
      await requestsApi.markOngoing(requestID);
      // Refetch to update list
      await fetchRequests(true);
    } catch (err: any) {
      console.error("Failed to mark request as ongoing:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Mark request as returned (equipment returned).
   */
  const markReturned = async (requestID: string) => {
    try {
      await requestsApi.markReturned(requestID);
      // Refetch to update list
      await fetchRequests(true);
    } catch (err: any) {
      console.error("Failed to mark request as returned:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Delete a request (pending only).
   */
  const deleteRequest = async (requestID: string) => {
    try {
      await requestsApi.deleteRequest(requestID);
      // Refetch to remove from list
      await fetchRequests(true);
    } catch (err: any) {
      console.error("Failed to delete request:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Get pending requests (admin view).
   */
  const getPendingRequests = async () => {
    try {
      return await requestsApi.getPendingRequests();
    } catch (err: any) {
      console.error("Failed to fetch pending requests:", err);
      throw err;
    }
  };

  return {
    requests,
    isLoading,
    error,
    createRequest,
    approveRequest,
    rejectRequest,
    overrideApproveRequest,
    overrideRejectRequest,
    markOngoing,
    markReturned,
    deleteRequest,
    getPendingRequests,
    refetch: fetchRequests,
  };
}

export default useRequests;
