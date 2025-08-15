'use client';

import { useMemo } from 'react';
import AccountBillingStatus from '@/components/billing/account-billing-status';
import { useAccounts } from '@/hooks/use-accounts';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const returnUrl = process.env.NEXT_PUBLIC_URL as string;

export default function PersonalAccountBillingPage() {
  const { data: accounts, isLoading, error } = useAccounts();

  const personalAccount = useMemo(
    () => accounts?.find((account) => account.personal_account),
    [accounts],
  );

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

  if (!personalAccount) {
    return (
      <Alert
        variant="destructive"
        className="border-red-300 dark:border-red-800 rounded-xl"
      >
        <AlertTitle>Account Not Found</AlertTitle>
        <AlertDescription>
          Your personal account could not be found.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <AccountBillingStatus
        accountId={personalAccount.account_id}
        returnUrl={`${returnUrl}/settings/billing`}
      />
    </div>
  );
}
