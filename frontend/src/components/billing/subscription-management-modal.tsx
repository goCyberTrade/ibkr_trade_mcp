'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PricingSection } from '@/components/home/sections/pricing-section';
import { isLocalMode } from '@/lib/config';
import { createPortalSession } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubscription } from '@/hooks/react-query';
import Link from 'next/link';
import { CreditCard, Settings, HelpCircle } from 'lucide-react';
import { OpenInNewWindowIcon } from '@radix-ui/react-icons';
import SubscriptionStatusManagement from './subscription-status-management';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  returnUrl: string;
};

export default function SubscriptionManagementModal({ 
  open, 
  onOpenChange, 
  accountId, 
  returnUrl 
}: Props) {
  const { session, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [isManagingPayment, setIsManagingPayment] = useState(false);
  
  const {
    data: subscriptionData,
    isLoading,
    error: subscriptionQueryError,
  } = useSubscription();



  const handleManageSubscription = async () => {
    try {
      setIsManaging(true);
      const { url } = await createPortalSession({ return_url: returnUrl });
      window.location.href = url;
    } catch (err) {
      console.error('Failed to create portal session:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to create portal session',
      );
    } finally {
      setIsManaging(false);
    }
  };

  const handleManagePaymentMethods = async () => {
    try {
      setIsManagingPayment(true);
      const { url } = await createPortalSession({ 
        return_url: returnUrl 
      });
      window.location.href = url;
    } catch (err) {
      console.error('Failed to create payment portal session:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to open payment methods',
      );
    } finally {
      setIsManagingPayment(false);
    }
  };

  // In local development mode, show a simplified component
  if (isLocalMode()) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscription Management</DialogTitle>
          </DialogHeader>
          <div className="p-4 mb-4 bg-muted/30 border border-border rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              Running in local development mode - billing features are disabled
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Agent usage limits are not enforced in this environment
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show loading state
  if (isLoading || authLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscription Management</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error state
  if (error || subscriptionQueryError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscription Management</DialogTitle>
          </DialogHeader>
          <div className="p-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
            <p className="text-sm text-destructive">
              Error loading billing status:{' '}
              {error || subscriptionQueryError.message}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isPlan = (planId?: string) => {
    return subscriptionData?.plan_name === planId;
  };

  const planName = isPlan('free')
    ? 'Free'
    : isPlan('base')
      ? 'Pro'
      : isPlan('extra')
        ? 'Enterprise'
        : 'Unknown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Subscription Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {subscriptionData ? (
            <>
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Links</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 h-auto p-4 justify-start"
                      asChild
                    >
                      <Link href="/model-pricing">
                        <HelpCircle className="h-4 w-4" />
                        <div className="text-left">
                          <div className="font-medium">Model Pricing</div>
                        </div>
                      </Link>
                    </Button>
                    
                    <Button
                      onClick={handleManagePaymentMethods}
                      disabled={isManagingPayment}
                      variant="outline"
                      className="flex items-center gap-2 h-auto p-4 justify-start"
                    >
                      <CreditCard className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium">Payment Methods</div>
                      </div>
                    </Button>

                    <Button
                      onClick={handleManageSubscription}
                      disabled={isManaging}
                      variant="outline"
                      className="flex items-center gap-2 h-auto p-4 justify-start"
                    >
                      <Settings className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium">Billing Portal</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Subscription Details */}
              <SubscriptionStatusManagement
                subscription={subscriptionData?.subscription}
                subscriptionId={subscriptionData?.subscription_id}
                onSubscriptionUpdate={() => {
                  // Trigger a refetch of subscription data
                  window.location.reload();
                }}
                className="w-full"
              />
            </>
          ) : (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-4">Upgrade Your Plan</h3>
                <PricingSection returnUrl={returnUrl} showTitleAndTabs={false} insideDialog={true} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}