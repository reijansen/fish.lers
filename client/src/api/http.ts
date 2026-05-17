/**
 * HTTP Client Utility.
 * Base fetch wrapper with error handling and base URL.
 *
 * All API calls should use this to ensure consistent headers, error handling, and auth token inclusion.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Make an HTTP request to the API.
 * Automatically includes Authorization header if token is available.
 */
export async function apiCall<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  // Get token from localStorage
  const token = localStorage.getItem("authToken");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return {} as T;
    }

    const body: ApiResponse<T> = await response.json();

    // Success responses
    if (response.ok) {
      return body.data || (body as unknown as T);
    }

    // Error responses
    throw new Error(body.error || `HTTP ${response.status}`);
  } catch (error: any) {
    // Network or parsing errors
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`API request failed: ${error}`);
  }
}

/**
 * GET request helper.
 */
export function apiGet<T>(endpoint: string): Promise<T> {
  return apiCall<T>(endpoint, { method: "GET" });
}

/**
 * POST request helper.
 */
export function apiPost<T>(endpoint: string, body: any): Promise<T> {
  return apiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * PATCH request helper.
 */
export function apiPatch<T>(endpoint: string, body: any): Promise<T> {
  return apiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * PUT request helper.
 */
export function apiPut<T>(endpoint: string, body: any): Promise<T> {
  return apiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request helper.
 */
export function apiDelete<T>(endpoint: string): Promise<T> {
  return apiCall<T>(endpoint, { method: "DELETE" });
}

export default {
  apiCall,
  apiGet,
  apiPost,
  apiPatch,
  apiPut,
  apiDelete,
};
