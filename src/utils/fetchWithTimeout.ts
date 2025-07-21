/**
 * Fetch with timeout utility
 * Wraps the standard fetch API with a timeout mechanism to prevent hanging requests
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number; // Timeout in milliseconds
}

export async function fetchWithTimeout(
  url: string, 
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  // Create an AbortController to cancel the request if it times out
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    
    throw error;
  }
}