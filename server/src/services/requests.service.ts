import { getAuth } from "../config/firebase.js";
import { Request, RequestCreateInput, RequestUpdateInput, RequestApprovalPayload } from "../models/request.js";
import { RequestRepository } from "../repositories/requests.repo.js";

/**
 * Request Service.
 * Handles business logic for equipment reservation requests.
 *
 * Purpose: Business logic layer for request operations.
 */
export class RequestService {
  private static readonly DEFAULT_LIST_LIMIT = 100;
  private static readonly MAX_LIST_LIMIT = 200;
  private static readonly LIST_CACHE_TTL_MS = 10_000;
  private static readonly listCache = new Map<string, { expiresAt: number; data: Request[] }>();

  private static getCachedList(key: string): Request[] | null {
    const cached = this.listCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.listCache.delete(key);
      return null;
    }
    return cached.data;
  }

  private static setCachedList(key: string, data: Request[]): void {
    this.listCache.set(key, {
      data,
      expiresAt: Date.now() + this.LIST_CACHE_TTL_MS,
    });
  }

  private static invalidateListCache(): void {
    this.listCache.clear();
  }

  private static normalizeListOptions(options?: { page?: number; limit?: number }) {
    const rawPage = Number(options?.page || 1);
    const rawLimit = Number(options?.limit || this.DEFAULT_LIST_LIMIT);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), this.MAX_LIST_LIMIT)
      : this.DEFAULT_LIST_LIMIT;
    return { page, limit };
  }

  /**
   * Create a new request.
   * Validates that user exists and equipment is available.
   */
  static async createRequest(data: RequestCreateInput): Promise<Request> {
    if (!data.userID || !data.items || data.items.length === 0) {
      throw new Error("Invalid request: must have userID and items");
    }

    if (!data.startDate || !data.endDate) {
      throw new Error("Invalid request: must have startDate and endDate");
    }

    // Verify user exists and fetch display name
    let createdByName: string = data.userID;
    try {
      const user = await getAuth().getUser(data.userID);
      createdByName = user.displayName || user.email || data.userID;
    } catch {
      throw new Error("User not found");
    }

    const requestID = await RequestRepository.create({
      ...data,
      createdByName,
    });
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error("Failed to create request");
    }

    this.invalidateListCache();
    return request;
  }

  /**
   * Get a request by ID.
   */
  static async getRequestById(requestID: string): Promise<Request> {
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error(`Request not found: ${requestID}`);
    }

    return await this.enrichRequestWithUserName(request);
  }

  /**
   * Get all requests (paginated/filtered).
   */
  static async getAllRequests(
    status?: string,
    options?: { page?: number; limit?: number }
  ): Promise<Request[]> {
    const normalized = this.normalizeListOptions(options);
    const cacheKey = `all:${status || "__all__"}:p${normalized.page}:l${normalized.limit}`;
    const cached = this.getCachedList(cacheKey);
    if (cached) return cached;

    const data = await RequestRepository.getAll(status, normalized);
    const enriched = await this.enrichRequestsWithUserNames(data);
    this.setCachedList(cacheKey, enriched);
    return enriched;
  }

  /**
   * Get pending requests (awaiting approval).
   */
  static async getPendingRequests(options?: { page?: number; limit?: number }): Promise<Request[]> {
    const normalized = this.normalizeListOptions(options);
    const cacheKey = `pending:p${normalized.page}:l${normalized.limit}`;
    const cached = this.getCachedList(cacheKey);
    if (cached) return cached;

    const data = await RequestRepository.getPending(normalized);
    const enriched = await this.enrichRequestsWithUserNames(data);
    this.setCachedList(cacheKey, enriched);
    return enriched;
  }

  /**
   * Get requests by user.
   */
  static async getRequestsByUser(
    userID: string,
    options?: { page?: number; limit?: number }
  ): Promise<Request[]> {
    const normalized = this.normalizeListOptions(options);
    const cacheKey = `user:${userID}:p${normalized.page}:l${normalized.limit}`;
    const cached = this.getCachedList(cacheKey);
    if (cached) return cached;

    const data = await RequestRepository.getByUserId(userID, normalized);
    const enriched = await this.enrichRequestsWithUserNames(data);
    this.setCachedList(cacheKey, enriched);
    return enriched;
  }

  /**
   * Aggregate reserved quantities across ongoing requests.
   * Used by student request form to compute real-time availability without
   * exposing direct Firestore list listeners to student clients.
   */
  static async getOngoingReservationSummary(): Promise<Record<string, number>> {
    return await RequestRepository.getOngoingReservationSummary();
  }

  /**
   * Update a request (by requester or admin).
   * Status transitions are validated.
   */
  static async updateRequest(requestID: string, updates: RequestUpdateInput): Promise<Request> {
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error(`Request not found: ${requestID}`);
    }

    // Validate status transition if status is being changed
    if (updates.status && updates.status !== request.status) {
      this.validateStatusTransition(request.status, updates.status);
    }

    await RequestRepository.update(requestID, updates);

    const updated = await RequestRepository.getById(requestID);
    if (!updated) {
      throw new Error("Failed to update request");
    }

    this.invalidateListCache();
    return await this.enrichRequestWithUserName(updated);
  }

  /**
   * Approve a request (admin only).
   */
  static async approveRequest(requestID: string, adminUid: string): Promise<Request> {
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error(`Request not found: ${requestID}`);
    }

    if (request.status !== "pending") {
      throw new Error(`Cannot approve request with status: ${request.status}`);
    }

    await RequestRepository.approve(requestID, adminUid);

    const updated = await RequestRepository.getById(requestID);
    if (!updated) {
      throw new Error("Failed to approve request");
    }

    this.invalidateListCache();
    return await this.enrichRequestWithUserName(updated);
  }

  /**
   * Reject a request (admin only).
   */
  static async rejectRequest(requestID: string, reason: string, adminUid: string): Promise<Request> {
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error(`Request not found: ${requestID}`);
    }

    if (request.status !== "pending") {
      throw new Error(`Cannot reject request with status: ${request.status}`);
    }

    await RequestRepository.rejectByAdmin(requestID, reason, adminUid);

    const updated = await RequestRepository.getById(requestID);
    if (!updated) {
      throw new Error("Failed to reject request");
    }

    this.invalidateListCache();
    return await this.enrichRequestWithUserName(updated);
  }

  /**
   * Super admin override: rejected -> approved.
   */
  static async overrideApproveRequest(
    requestID: string,
    superAdminUid: string,
    reason?: string
  ): Promise<Request> {
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error(`Request not found: ${requestID}`);
    }

    const currentStatus = String(request.status || "").toLowerCase();
    if (!["rejected", "declined"].includes(currentStatus)) {
      throw new Error(`Can only override rejected requests. Current status: ${request.status}`);
    }

    await RequestRepository.overrideDecision(requestID, {
      newStatus: "approved",
      superAdminUid,
      previousStatus: "rejected",
      reason,
    });

    const updated = await RequestRepository.getById(requestID);
    if (!updated) {
      throw new Error("Failed to override request to approved");
    }

    this.invalidateListCache();
    return await this.enrichRequestWithUserName(updated);
  }

  /**
   * Super admin override: approved -> rejected.
   */
  static async overrideRejectRequest(
    requestID: string,
    superAdminUid: string,
    reason: string
  ): Promise<Request> {
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error(`Request not found: ${requestID}`);
    }

    if (request.status !== "approved") {
      throw new Error(`Can only override approved requests. Current status: ${request.status}`);
    }

    await RequestRepository.overrideDecision(requestID, {
      newStatus: "rejected",
      superAdminUid,
      previousStatus: "approved",
      reason,
    });

    const updated = await RequestRepository.getById(requestID);
    if (!updated) {
      throw new Error("Failed to override request to rejected");
    }

    this.invalidateListCache();
    return await this.enrichRequestWithUserName(updated);
  }

  /**
   * Mark request as ongoing (equipment borrowed).
   */
  static async markOngoing(requestID: string): Promise<Request> {
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error(`Request not found: ${requestID}`);
    }

    if (request.status !== "approved") {
      throw new Error(`Only approved requests can be marked ongoing`);
    }

    await RequestRepository.markOngoing(requestID);

    const updated = await RequestRepository.getById(requestID);
    if (!updated) {
      throw new Error("Failed to mark request as ongoing");
    }

    this.invalidateListCache();
    return await this.enrichRequestWithUserName(updated);
  }

  /**
   * Mark request as returned (equipment returned).
   */
  static async markReturned(requestID: string): Promise<Request> {
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error(`Request not found: ${requestID}`);
    }

    if (request.status !== "ongoing") {
      throw new Error(`Only ongoing requests can be marked as returned`);
    }

    await RequestRepository.markReturned(requestID);

    const updated = await RequestRepository.getById(requestID);
    if (!updated) {
      throw new Error("Failed to mark request as returned");
    }

    this.invalidateListCache();
    return await this.enrichRequestWithUserName(updated);
  }

  /**
   * Delete a request (typically only pending requests).
   */
  static async deleteRequest(requestID: string): Promise<void> {
    const request = await RequestRepository.getById(requestID);

    if (!request) {
      throw new Error(`Request not found: ${requestID}`);
    }

    if (request.status !== "pending") {
      throw new Error(`Cannot delete request with status: ${request.status}`);
    }

    await RequestRepository.delete(requestID);
    this.invalidateListCache();
  }

  /**
   * Enrich a single request with user display name.
   */
  private static async enrichRequestWithUserName(request: Request): Promise<Request> {
    if (!request.userID || request.createdByName) {
      return request; // Already enriched or no userID
    }

    try {
      const user = await getAuth().getUser(request.userID);
      return {
        ...request,
        createdByName: user.displayName || user.email || request.userID,
      };
    } catch (error) {
      console.warn(`Failed to fetch user ${request.userID}:`, error);
      return request; // Return as-is if user lookup fails
    }
  }

  /**
   * Enrich multiple requests with user display names.
   */
  private static async enrichRequestsWithUserNames(requests: Request[]): Promise<Request[]> {
    const userIds = new Set<string>();
    requests.forEach((req) => {
      if (req.userID && !req.createdByName) {
        userIds.add(req.userID);
      }
    });

    // Fetch all unique users in parallel
    const userMap = new Map<string, string>();
    await Promise.all(
      Array.from(userIds).map(async (uid) => {
        try {
          const user = await getAuth().getUser(uid);
          userMap.set(uid, user.displayName || user.email || uid);
        } catch (error) {
          console.warn(`Failed to fetch user ${uid}:`, error);
        }
      })
    );

    // Enrich all requests
    return requests.map((req) => ({
      ...req,
      createdByName: req.createdByName || userMap.get(req.userID) || req.userID,
    }));
  }

  /**
   * Validate status transitions.
   * Defines which status transitions are allowed.
   */
  private static validateStatusTransition(currentStatus: string, newStatus: string): void {
    const allowedTransitions: Record<string, string[]> = {
      pending: ["approved", "rejected"],
      approved: ["ongoing", "rejected"],
      ongoing: ["returned"],
      returned: ["completed"],
      rejected: [],
      completed: [],
    };

    const allowed = allowedTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }
  }
}
