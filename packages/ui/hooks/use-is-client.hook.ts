import { useEffect, useState } from "react";

/**
 * Custom hook that determines if the code is running on the client side (in the browser).
 *
 * Returns `true` only on the client after hydration.
 * @example
 * ```tsx
 * const isClient = useIsClient();
 * // Use isClient to conditionally render or execute code specific to the client side.
 * ```
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) setIsClient(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return isClient;
}
