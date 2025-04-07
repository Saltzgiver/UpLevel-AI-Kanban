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
    const res = await fetch(fullUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API request failed for ${method} ${fullUrl}:`, error);
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const res = await fetch(url, {
        credentials: "include",
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`Query failed for ${url}:`, error);
      
      // For aborted requests or network errors, return a default value
      // to prevent UI from breaking completely
      if (error && error.name && 
          (error.name === 'AbortError' || error.name === 'TypeError' || error.name === 'NetworkError')) {
        console.warn(`Request to ${url} was aborted or had a network error. Returning empty data.`);
        return { processing: false, gptOutput: null, chats: [], attachments: [] };
      }
      
      throw error;
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
