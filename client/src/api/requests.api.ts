/**
 * Requests API.
 * HTTP wrapper for equipment reservation request endpoints.
 *
 * This module wraps all request API calls for reservations and tracking.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./http";
import { measureActionLatency, trackSuperAdminApiFailure } from "../utils/telemetry";

/**
 * Request item type.
 */
export interface RequestItem {
  equipmentID: string;
  qty: number;
  notes?: string;
}

/**
 * Request type (equipment reservation).
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

interface ListOptions {
  page?: number;
  limit?: number;
}

function withListParams(basePath: string, options?: ListOptions): string {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Create a new request.
 * POST /api/requests
 * Body: { userID, items, startDate, endDate, purpose? }
 */
export async function createRequest(request: Omit<Request, "requestID" | "createdAt" | "updatedAt">): Promise<Request> {
  const data = await apiPost<Request>("/api/requests", request);
  return data;
}

/**
 * Get all requests (optionally filtered).
 * GET /api/requests?status=pending|approved|ongoing|returned|completed
 */
export async function listRequests(status?: string, options?: ListOptions): Promise<Request[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  const endpoint = query ? `/api/requests?${query}` : "/api/requests";
  const data = await apiGet<Request[]>(endpoint);
  return data;
}

/**
 * Get pending requests (awaiting approval).
 * GET /api/requests/pending
 */
export async function getPendingRequests(options?: ListOptions): Promise<Request[]> {
  const data = await apiGet<Request[]>(withListParams("/api/requests/pending", options));
  return data;
}

/**
 * Get all requests from a specific user.
 * GET /api/requests/user/:uid
 */
export async function getRequestsByUser(uid: string, options?: ListOptions): Promise<Request[]> {
  const data = await apiGet<Request[]>(withListParams(`/api/requests/user/${uid}`, options));
  return data;
}

/**
 * Get aggregated reserved quantities from ongoing requests.
 * GET /api/requests/ongoing/summary
 */
export async function getOngoingReservationSummary(): Promise<Record<string, number>> {
  const data = await apiGet<Record<string, number>>("/api/requests/ongoing/summary");
  return data;
}

/**
 * Get aggregated reserved quantities from approved + ongoing requests.
 * GET /api/requests/pending/summary
 */
export async function getPendingReservationSummary(): Promise<Record<string, number>> {
  const data = await apiGet<Record<string, number>>("/api/requests/pending/summary");
  return data;
}

/**
 * Get aggregated reserved quantities for a selected date range.
 * Includes approved + ongoing requests that overlap the range.
 * GET /api/requests/availability/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export async function getReservationSummaryForRange(
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const params = new URLSearchParams({ startDate, endDate });
  const data = await apiGet<Record<string, number>>(
    `/api/requests/availability/summary?${params.toString()}`
  );
  return data;
}

function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && startB <= endA;
}

/**
 * Get aggregated reserved quantities for a selected date range,
 * considering only ongoing requests.
 */
export async function getOngoingReservationSummaryForRange(
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const ongoingRequests = await listRequests("ongoing");
  const summary: Record<string, number> = {};

  for (const req of ongoingRequests || []) {
    if (!rangesOverlap(startDate, endDate, req.startDate, req.endDate)) continue;
    for (const item of req.items || []) {
      if (!item?.equipmentID) continue;
      summary[item.equipmentID] = (summary[item.equipmentID] || 0) + (item.qty || 0);
    }
  }

  return summary;
}

/**
 * Get a single request by ID.
 * GET /api/requests/:id
 */
export async function getRequest(requestID: string): Promise<Request> {
  const data = await apiGet<Request>(`/api/requests/${requestID}`);
  return data;
}

/**
 * Update a request.
 * PATCH /api/requests/:id
 * Body: partial request object
 */
export async function updateRequest(
  requestID: string,
  updates: Partial<Request>
): Promise<Request> {
  const data = await apiPatch<Request>(`/api/requests/${requestID}`, updates);
  return data;
}

/**
 * Approve a request (admin only).
 * POST /api/requests/:id/approve
 */
export async function approveRequest(requestID: string): Promise<Request> {
  const data = await apiPost<Request>(`/api/requests/${requestID}/approve`, {});
  return data;
}

/**
 * Reject a request (admin only).
 * POST /api/requests/:id/reject
 * Body: { reason }
 */
export async function rejectRequest(requestID: string, reason: string): Promise<Request> {
  const data = await apiPost<Request>(`/api/requests/${requestID}/reject`, { reason });
  return data;
}

/**
 * Super admin override from rejected -> approved.
 * POST /api/requests/:id/override-approve
 * Body: { reason? }
 */
export async function overrideApproveRequest(
  requestID: string,
  reason?: string
): Promise<Request> {
  const endpoint = `/api/requests/${requestID}/override-approve`;
  try {
    const data = await measureActionLatency(
      "super_admin.override_approve",
      () => apiPost<Request>(endpoint, { reason }),
      { requestID, hasReason: !!reason }
    );
    return data;
  } catch (error: any) {
    trackSuperAdminApiFailure({
      endpoint,
      action: "override_approve",
      error,
      context: { requestID, hasReason: !!reason },
    });
    throw error;
  }
}

/**
 * Super admin override from approved -> rejected.
 * POST /api/requests/:id/override-reject
 * Body: { reason }
 */
export async function overrideRejectRequest(
  requestID: string,
  reason: string
): Promise<Request> {
  const endpoint = `/api/requests/${requestID}/override-reject`;
  try {
    const data = await measureActionLatency(
      "super_admin.override_reject",
      () => apiPost<Request>(endpoint, { reason }),
      { requestID, hasReason: !!reason }
    );
    return data;
  } catch (error: any) {
    trackSuperAdminApiFailure({
      endpoint,
      action: "override_reject",
      error,
      context: { requestID, hasReason: !!reason },
    });
    throw error;
  }
}

/**
 * Mark request as ongoing (equipment borrowed).
 * POST /api/requests/:id/ongoing
 */
export async function markOngoing(requestID: string): Promise<Request> {
  const data = await apiPost<Request>(`/api/requests/${requestID}/ongoing`, {});
  return data;
}

/**
 * Mark request as returned (equipment returned).
 * POST /api/requests/:id/return
 */
export async function markReturned(requestID: string): Promise<Request> {
  const data = await apiPost<Request>(`/api/requests/${requestID}/return`, {});
  return data;
}

/**
 * Delete a request (pending only).
 * DELETE /api/requests/:id
 */
export async function deleteRequest(requestID: string): Promise<void> {
  await apiDelete(`/api/requests/${requestID}`);
}

export default {
  createRequest,
  listRequests,
  getPendingRequests,
  getRequestsByUser,
  getOngoingReservationSummary,
  getPendingReservationSummary,
  getReservationSummaryForRange,
  getOngoingReservationSummaryForRange,
  getRequest,
  updateRequest,
  approveRequest,
  rejectRequest,
  overrideApproveRequest,
  overrideRejectRequest,
  markOngoing,
  markReturned,
  deleteRequest,
};
