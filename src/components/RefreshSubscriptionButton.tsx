import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

interface RefreshSubscriptionButtonProps {
  onRefresh?: () => void;
}

export const RefreshSubscriptionButton = ({ onRefresh }: RefreshSubscriptionButtonProps) => {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast({
          title: 'Not signed in',
          description: 'Please sign in to check your subscription status.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        throw error;
      }

      toast({
        title: 'Subscription updated',
        description: data.subscribed 
          ? `Active subscription: ${data.plan_name}` 
          : 'No active subscription found.',
      });

      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh subscription status.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
    </Button>
  );
};
