import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';

export const SubscriptionStatus = () => {
  const { subscription, isLoading } = useCredits();

  if (isLoading || !subscription.subscribed) {
    return null;
  }

  const endDate = subscription.subscription_end 
    ? new Date(subscription.subscription_end).toLocaleDateString()
    : 'N/A';

  return (
    <Alert className="mb-6 border-primary/50 bg-primary/5">
      <CreditCard className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Active Subscription
        <Badge variant="secondary">{subscription.plan_name}</Badge>
      </AlertTitle>
      <AlertDescription className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3" />
          Renews: {endDate}
        </span>
        {subscription.credits_per_month !== null ? (
          <span className="text-sm">
            {subscription.credits_per_month} credits/month
          </span>
        ) : (
          <span className="text-sm font-semibold">Unlimited credits</span>
        )}
      </AlertDescription>
    </Alert>
  );
};
