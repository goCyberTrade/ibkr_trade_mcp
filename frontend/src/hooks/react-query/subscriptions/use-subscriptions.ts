'use client';

import { createMutationHook, createQueryHook } from '@/hooks/use-query';
import {
  getSubscription,
  getSubscriptionCommitment,
  createPortalSession,
  SubscriptionStatus,
  CommitmentInfo,
} from '@/lib/api';
import { subscriptionKeys } from './keys';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

export const useSubscription = createQueryHook(
  subscriptionKeys.details(),
  getSubscription,
  {
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  },
);

// Smart subscription hook that adapts refresh based on streaming state
export const useSubscriptionWithStreaming = (isStreaming: boolean = false) => {
  const [isVisible, setIsVisible] = useState(true);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return useQuery({
    queryKey: subscriptionKeys.details(),
    queryFn: getSubscription,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
    refetchInterval: (data) => {
      // No refresh if tab is hidden
      if (!isVisible) return false;
      
      // If actively streaming: refresh every 5s (costs are changing)
      if (isStreaming) return 5 * 1000;
      
      // If visible but not streaming: refresh every 5min
      return 5 * 60 * 1000;
    },
    refetchIntervalInBackground: false, // Stop when tab backgrounded
  });
};

export const useCreatePortalSession = createMutationHook(
  (params: { return_url: string }) => createPortalSession(params),
  {
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
  },
);

export const useSubscriptionCommitment = (subscriptionId?: string) => {
  return useQuery({
    queryKey: subscriptionKeys.commitment(subscriptionId || ''),
    queryFn: () => getSubscriptionCommitment(subscriptionId!),
    enabled: !!subscriptionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

export const isPlan = (
  subscriptionData: SubscriptionStatus | null | undefined,
  planId?: string,
): boolean => {
  if (!subscriptionData) return planId === 'free';
  return subscriptionData.plan_name === planId;
};
