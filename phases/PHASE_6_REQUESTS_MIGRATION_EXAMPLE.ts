/**
 * PHASE 6: Requests Feature Frontend Migration Example
 *
 * This file shows how to convert requests operations from direct Firestore calls
 * to API calls via the requests.api wrapper.
 *
 * INSTRUCTIONS:
 * 1. Create/update client/src/hooks/useRequests.ts with code from this file
 * 2. Replace Firestore listeners with API polling
 * 3. Update client/src/pages/requestform/RequestPage.tsx to use new API
 * 4. Update client/src/pages/tracking/TrackingPage.tsx to use new API
 * 5. Test request creation and approval workflow
 */

import { useEffect, useState } from "react";
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
  rejectionReason?: string;
  returnedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
 * - Uses polling instead (fetch every 5 seconds)
 * - All operations go through requestsApi.* functions
 * - Error handling for network failures
 */
export function useRequests(userID?: string) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch requests from API.
   * Called on mount and periodically.
   */
  const fetchRequests = async () => {
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
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch requests:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Setup polling to refetch requests every 5 seconds.
   * This simulates real-time behavior of Firestore listeners.
   */
  useEffect(() => {
    let isMounted = true;

    // Fetch immediately on mount
    fetchRequests();

    // Poll every 5 seconds
    const interval = setInterval(() => {
      if (isMounted) {
        fetchRequests();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userID]);

  /**
   * Create a new request.
   */
  const createRequest = async (request: Omit<Request, "requestID" | "createdAt" | "updatedAt">) => {
    try {
      await requestsApi.createRequest(request);
      // Refetch to get the new request in the list
      await fetchRequests();
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
      await fetchRequests();
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
      await fetchRequests();
    } catch (err: any) {
      console.error("Failed to reject request:", err);
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
      await fetchRequests();
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
      await fetchRequests();
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
      await fetchRequests();
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
    markOngoing,
    markReturned,
    deleteRequest,
    getPendingRequests,
    refetch: fetchRequests,
  };
}

export default useRequests;
