import { createQueryHook } from "@/hooks/use-query";
import { threadKeys } from "./keys";
import { checkBillingStatus } from "@/lib/api";

export const useBillingStatusQuery = (enabled = true) =>
  createQueryHook(
    threadKeys.billingStatus,
    () => checkBillingStatus(),
    {
      enabled,
      retry: 1,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchInterval: (query: any) => {
        if (query.state.data && !query.state.data.can_run) {
          return 1000 * 60;
        }
        return false;
      },
    }
  )();
