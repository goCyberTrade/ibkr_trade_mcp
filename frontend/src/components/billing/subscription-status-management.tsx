'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  Shield, 
  CheckCircle, 
  RotateCcw, 
  Clock 
} from 'lucide-react';
import { toast } from 'sonner';
import { cancelSubscription, reactivateSubscription } from '@/lib/api';
import { useSubscriptionCommitment } from '@/hooks/react-query';

interface SubscriptionStatusManagementProps {
  subscription?: {
    id: string;
    status: string;
    cancel_at_period_end: boolean;
    cancel_at?: number;
    current_period_end: number;
  };
  subscriptionId?: string;
  onSubscriptionUpdate?: () => void;
  className?: string;
}

export default function SubscriptionStatusManagement({
  subscription,
  subscriptionId,
  onSubscriptionUpdate,
  className,
}: SubscriptionStatusManagementProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const {
    data: commitmentInfo,
    isLoading: commitmentLoading,
    error: commitmentError
  } = useSubscriptionCommitment(subscriptionId || subscription?.id);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get the effective cancellation date (could be period end or cancel_at for yearly commitments)
  const getEffectiveCancellationDate = () => {
    if (subscription.cancel_at) {
      // Yearly commitment cancellation - use cancel_at timestamp
      return formatDate(subscription.cancel_at);
    }
    // Regular cancellation - use current period end
    return formatDate(subscription.current_period_end);
  };

  const formatEndDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      const response = await cancelSubscription();

      if (response.success) {
        toast.success(response.message);
        setShowCancelDialog(false);
        onSubscriptionUpdate?.();
      } else {
        toast.error(response.message);
      }
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast.error(error.message || 'Failed to cancel subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivate = async () => {
    setIsLoading(true);
    try {
      const response = await reactivateSubscription();

      if (response.success) {
        toast.success(response.message);
        onSubscriptionUpdate?.();
      } else {
        toast.error(response.message);
      }
    } catch (error: any) {
      console.error('Error reactivating subscription:', error);
      toast.error(error.message || 'Failed to reactivate subscription');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (commitmentLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm text-muted-foreground">Loading subscription status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if no subscription
  if (!subscription) {
    return null;
  }

  const hasCommitment = commitmentInfo?.has_commitment && !commitmentInfo?.can_cancel;
  // Check both cancel_at_period_end (regular cancellation) and cancel_at (yearly commitment cancellation)
  const isAlreadyCancelled = subscription.cancel_at_period_end || !!subscription.cancel_at;
  const canCancel = !isAlreadyCancelled;
  const canReactivate = isAlreadyCancelled;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-blue-600" />
          Subscription Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <Badge variant={isAlreadyCancelled ? 'destructive' : 'secondary'}>
            {isAlreadyCancelled
              ? subscription.cancel_at
                ? 'Cancelling at commitment end'
                : 'Cancelling at period end'
              : 'Active'}
          </Badge>
        </div>

        {/* Commitment Information */}
        {commitmentInfo?.has_commitment && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Commitment Type</span>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                12-Month Commitment
              </Badge>
            </div>

            {commitmentInfo.months_remaining !== undefined && commitmentInfo.months_remaining > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Time Remaining</span>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {commitmentInfo.months_remaining} months
                </div>
              </div>
            )}

            {commitmentInfo.commitment_end_date && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Commitment Ends</span>
                <span className="text-sm text-muted-foreground">
                  {formatEndDate(commitmentInfo.commitment_end_date)}
                </span>
              </div>
            )}
          </>
        )}

        {/* Commitment Warning for Active Subscriptions */}
        {hasCommitment && !isAlreadyCancelled && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-sm">
              You have {commitmentInfo?.months_remaining} months remaining in
              your yearly commitment. If you cancel, your subscription will end
              on{' '}
              {commitmentInfo?.commitment_end_date
                ? formatEndDate(commitmentInfo.commitment_end_date)
                : 'your commitment end date'}{' '}
              and you'll continue to have access until then.
            </AlertDescription>
          </Alert>
        )}

        {/* Cannot Cancel Warning */}
        {hasCommitment && !commitmentInfo?.can_cancel && !isAlreadyCancelled && (
          <Alert className="border-blue-200 bg-blue-50">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              Your subscription cannot be cancelled during the commitment period, but you can schedule 
              it to end when your commitment expires. You can upgrade to a higher plan at any time.
            </AlertDescription>
          </Alert>
        )}

        {/* Already Cancelled Status */}
        {isAlreadyCancelled && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {subscription.cancel_at ? (
                <>
                  Your subscription is scheduled to end on{' '}
                  {getEffectiveCancellationDate()}{' '}
                  (end of commitment period). You'll continue to have access until then.
                </>
              ) : (
                <>
                  Your subscription will end on{' '}
                  {getEffectiveCancellationDate()}. You'll continue
                  to have access until then.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Commitment Completed Message */}
        {commitmentInfo?.has_commitment && commitmentInfo?.can_cancel && !isAlreadyCancelled && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>Commitment period completed - you can now cancel anytime</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {canCancel && (
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  {hasCommitment ? 'Schedule Cancellation' : 'Cancel Subscription'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {hasCommitment ? 'Schedule Cancellation' : 'Cancel Subscription'}
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed">
                    {hasCommitment ? (
                      <>
                        Are you sure you want to schedule your subscription for cancellation? 
                        Since you have a yearly commitment, your subscription will be
                        scheduled to end on{' '}
                        {commitmentInfo?.commitment_end_date
                          ? formatEndDate(commitmentInfo.commitment_end_date)
                          : 'your commitment end date'}
                        . You'll continue to have full access until then.
                      </>
                    ) : (
                      <>
                        Are you sure you want to cancel your subscription?
                        You'll continue to have access until the end of your
                        current billing period (
                        {formatDate(subscription.current_period_end)}).
                      </>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelDialog(false)}
                    disabled={isLoading}
                  >
                    Keep Subscription
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : hasCommitment ? 'Yes, Schedule Cancellation' : 'Yes, Cancel'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {canReactivate && (
            <Button
              variant="default"
              size="sm"
              onClick={handleReactivate}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {isLoading ? 'Reactivating...' : 'Reactivate Subscription'}
            </Button>
          )}

          {!canCancel && !canReactivate && !hasCommitment && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Subscription is active
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-md">
          <strong>Need help?</strong> Contact support if you have questions
          about your subscription or need assistance with changes.
        </div>
      </CardContent>
    </Card>
  );
}