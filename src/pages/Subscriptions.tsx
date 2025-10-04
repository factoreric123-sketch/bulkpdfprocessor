import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubscriptionPlans } from '@/components/SubscriptionPlans';
import { RefreshSubscriptionButton } from '@/components/RefreshSubscriptionButton';
import { useCredits } from '@/hooks/useCredits';

const Subscriptions = () => {
  const navigate = useNavigate();
  const { user } = useCredits();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            {user && <RefreshSubscriptionButton />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Subscription Plans</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upgrade your account to get more PDF processing credits each month. Choose the plan that works best for you.
          </p>
        </div>

        <SubscriptionPlans />
      </main>
    </div>
  );
};

export default Subscriptions;
