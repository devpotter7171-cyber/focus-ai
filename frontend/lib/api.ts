const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ─── Simple GET response cache ─────────────────────────────────────────────
// Avoids duplicate network calls when multiple components mount simultaneously
// (e.g. Sidebar + Dashboard both calling /courses/).
// TTL is short (10s) so data stays fresh but rapid re-renders don't re-fetch.

const _getCache = new Map<string, { data: unknown; ts: number }>();
const GET_CACHE_TTL = 10_000; // 10 seconds

function _getCached<T>(key: string): T | null {
    const entry = _getCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > GET_CACHE_TTL) {
        _getCache.delete(key);
        return null;
    }
    return entry.data as T;
}

function _setCache(key: string, data: unknown) {
    _getCache.set(key, { data, ts: Date.now() });
    // Prevent unbounded growth — evict oldest if > 100 entries.
    if (_getCache.size > 100) {
        const oldest = _getCache.keys().next().value;
        if (oldest) _getCache.delete(oldest);
    }
}

/** Bust the GET cache for a specific endpoint (call after mutations). */
export function invalidateCache(endpoint?: string) {
    if (endpoint) {
        _getCache.delete(endpoint);
    } else {
        _getCache.clear();
    }
}

interface FetchOptions extends RequestInit {
    timeout?: number;
    includeAuth?: boolean; // Whether to include auth token (default: true)
}

export class ApiError extends Error {
    status: number;
    statusText: string;
    data?: unknown;

    constructor(status: number, statusText: string, data?: unknown) {
        super(`API Error: ${status} ${statusText}`);
        this.status = status;
        this.statusText = statusText;
        this.data = data;
    }
}

let cachedToken: { token: string; expiry: number } | null = null;

// Helper to get auth token
async function getAuthToken(): Promise<string | null> {
    const now = Date.now();
    if (cachedToken && cachedToken.expiry > now) {
        return cachedToken.token;
    }

    try {
        const { auth } = await import('@/lib/firebase');

        const token = await new Promise<string | null>((resolve) => {
            // Fast path: if user is already logged in
            if (auth.currentUser) {
                auth.currentUser.getIdToken().then(resolve).catch(() => resolve(null));
                return;
            }

            // Slow path: wait for auth state to resolve (with timeout)
            const timeout = setTimeout(() => {
                unsubscribe();
                resolve(null);
            }, 5000);

            const unsubscribe = auth.onAuthStateChanged(async (user) => {
                clearTimeout(timeout);
                unsubscribe();
                if (user) {
                    try {
                        const t = await user.getIdToken();
                        resolve(t);
                    } catch {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });

        if (token) {
            cachedToken = { token, expiry: now + 5000 }; // Cache for 5 seconds
        }
        return token;
    } catch {
        return null;
    }
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { timeout = 15000, includeAuth = true, ...fetchOptions } = options;
    const method = (fetchOptions.method || "GET").toUpperCase();

    // Serve from cache for GET requests (skip if body/method is non-GET).
    if (method === "GET") {
        const hit = _getCached<T>(endpoint);
        if (hit !== null) return hit;
    }

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        const url = `${API_BASE_URL}${endpoint}`;

        // Get auth token if needed
        let authToken: string | null = null;
        if (includeAuth) {
            authToken = await getAuthToken();
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(fetchOptions.headers as Record<string, string> || {}),
        };

        // Add auth header if token is available
        if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
        }

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
                headers,
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = null;
                }

                // Don't retry on client errors (4xx)
                if (response.status >= 400 && response.status < 500) {
                    clearTimeout(id);
                    throw new ApiError(response.status, response.statusText, errorData);
                }

                // Retry on server errors (5xx) or network errors
                throw new ApiError(response.status, response.statusText, errorData);
            }

            clearTimeout(id);

            // Handle 204 No Content
            if (response.status === 204) {
                return {} as T;
            }

            const json = await response.json();
            // Cache successful GET responses.
            if (method === "GET") {
                _setCache(endpoint, json);
            }
            return json;
        } catch (error) {
            clearTimeout(id);
            lastError = error as Error;

            // Don't retry on abort or client errors
            if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                throw error;
            }

            if (error instanceof Error && error.name === 'AbortError') {
                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
                throw new Error('Request timed out after multiple attempts');
            }

            // Retry on network errors
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
            }

            throw error;
        }
    }

    throw lastError || new Error('Request failed after retries');
}

export async function markSubtopicComplete(courseId: string, unitId: string, subtopicId: string, userId?: string) {
    const url = `/courses/${courseId}/units/${unitId}/subtopics/${subtopicId}/complete`;
    const params = userId ? `?user_id=${userId}` : '';
    return apiFetch(`${url}${params}`, {
        method: 'POST'
    });
}

export async function getCourseProgress(courseId: string, userId?: string) {
    const url = `/courses/${courseId}/progress`;
    const params = userId ? `?user_id=${userId}` : '';
    return apiFetch<{ completed_subtopics: string[], confused_subtopics?: string[] }>(`${url}${params}`);
}
