/**
 * Centralized API client configuration
 * In development, defaults to relative '/api' proxy.
 * In production with a custom backend domain, uses VITE_API_URL.
 */

const rawBaseUrl = (import.meta.env.VITE_API_URL || '').trim();
export const API_BASE_URL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

/**
 * Returns the fully qualified or relative URL for a given API endpoint path.
 * Example: apiUrl('/api/rooms/create') -> 'https://api.domain.com/api/rooms/create' or '/api/rooms/create'
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
