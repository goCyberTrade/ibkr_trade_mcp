'use client';

import { createMutationHook, createQueryHook } from '@/hooks/use-query';
import {
  createCheckoutSession,
  checkBillingStatus,
  getAvailableModels,
  CreateCheckoutSessionRequest
} from '@/lib/api';
import { billingApi } from '@/lib/api-enhanced';
import { modelKeys, usageKeys } from './keys';

export const useAvailableModels = createQueryHook(
  modelKeys.available,
  getAvailableModels,
  {
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  }
);

export const useBillingStatus = createQueryHook(
  ['billing', 'status'],
  checkBillingStatus,
  {
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  }
);

export const useCreateCheckoutSession = createMutationHook(
  (request: CreateCheckoutSessionRequest) => createCheckoutSession(request),
  {
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    errorContext: {
      operation: 'create checkout session',
      resource: 'billing'
    }
  }
);

export const useUsageLogs = (page: number = 0, itemsPerPage: number = 1000) => 
  createQueryHook(
    usageKeys.logs(page, itemsPerPage),
    () => billingApi.getUsageLogs(page, itemsPerPage),
    {
      staleTime: 30 * 1000, // 30 seconds
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  )(); 