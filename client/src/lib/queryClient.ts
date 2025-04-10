import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Helper function to ensure URL is properly formatted
function getFullUrl(url: string): string {
  try {
    // If it's already a full URL, just return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // For API endpoints, ensure they have a leading slash
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    
    // Return relative URLs as is - fetch will resolve them against the current origin
    return url;
  } catch (error) {
    console.error("Error formatting URL:", error);
    return url; // Return original URL as fallback
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = getFullUrl(url);
  
  try {
    // Add a timeout to prevent infinite hanging requests
    let timeoutId: NodeJS.Timeout | null = null;
    const controller = new AbortController();
    
    // Create a promise that will resolve with the fetch result or reject after timeout
    const fetchPromise = fetch(fullUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller.signal
    });
    
    // Create a timeout promise
    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Request timed out after 15 seconds'));
        controller.abort(); // Abort the fetch
      }, 15000); // 15 second timeout for mutations (longer than queries)
    });
    
    // Race the fetch against the timeout
    const res = await Promise.race([fetchPromise, timeoutPromise])
      .finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API request failed for ${method} ${fullUrl}:`, error);
    
    // For API mutations, we still want to throw errors since the UI needs to handle these
    // differently than query errors (showing error toasts, etc.)
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = getFullUrl(queryKey[0] as string);
    
    try {
      // Add a timeout to prevent infinite hanging requests
      let timeoutId: NodeJS.Timeout | null = null;
      const controller = new AbortController();
      
      // Create a promise that will resolve with the fetch result or reject after timeout
      const fetchPromise = fetch(url, {
        credentials: "include",
        signal: controller.signal
      });
      
      // Create a timeout promise
      const timeoutPromise = new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => {
          try {
            controller.abort(); // Abort the fetch
            reject(new Error('Request timed out after 10 seconds'));
          } catch (error) {
            console.error('Error aborting fetch:', error);
            reject(new Error('Request timed out after 10 seconds'));
          }
        }, 10000); // 10 second timeout - increased from 5sec
      });
      
      // Race the fetch against the timeout
      const res = await Promise.race([fetchPromise, timeoutPromise])
        .finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (err: unknown) {
      console.error(`Query failed for ${url}:`, err);
      
      // For any error, return a safe default value to prevent UI from breaking
      // This way users still see something usable even if there's a network error
      // Error messages are logged to console for debugging
      console.warn(`Request to ${url} failed. Returning empty data to maintain application stability.`);
      
      // Return a safe empty result data structure
      return { 
        processing: false, 
        gptOutput: null, 
        chats: [], 
        attachments: [] 
      };
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
