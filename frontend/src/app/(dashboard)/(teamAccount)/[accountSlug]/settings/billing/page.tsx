'use client';

import React from 'react';
import AccountBillingStatus from '@/components/billing/account-billing-status';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountBySlug } from '@/hooks/react-query';

const returnUrl = process.env.NEXT_PUBLIC_URL as string;

type AccountParams = {
  accountSlug: string;
};

export default function TeamBillingPage({
  params,
}: {
  params: Promise<AccountParams>;
}) {
  const unwrappedParams = React.use(params);
  const { accountSlug } = unwrappedParams;

  const { 
    data: teamAccount, 
    isLoading, 
    error 
  } = useAccountBySlug(accountSlug);

  if (error) {
    return (
      <Alert
        variant="destructive"
        className="border-red-300 dark:border-red-800 rounded-xl"
      >
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load account data'}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!teamAccount) {
    return (
      <Alert
        variant="destructive"
        className="border-red-300 dark:border-red-800 rounded-xl"
      >
        <AlertTitle>Account Not Found</AlertTitle>
        <AlertDescription>
          The requested team account could not be found.
        </AlertDescription>
      </Alert>
    );
  }

  if (teamAccount.role !== 'owner') {
    return (
      <Alert
        variant="destructive"
        className="border-red-300 dark:border-red-800 rounded-xl"
      >
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to access this page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-card-title">Team Billing</h3>
        <p className="text-sm text-foreground/70">
          Manage your team's subscription and billing details.
        </p>
      </div>

      <AccountBillingStatus
        accountId={teamAccount.account_id}
        returnUrl={`${returnUrl}/${accountSlug}/settings/billing`}
      />
    </div>
  );
}
