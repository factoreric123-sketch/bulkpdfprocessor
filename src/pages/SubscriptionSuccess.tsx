import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useCredits } from '@/hooks/useCredits';

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const { user } = useCredits();

  useEffect(() => {
    // Redirect to auth if not logged in
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Subscription Activated!</CardTitle>
          <CardDescription>
            Your subscription has been successfully activated. Your credits will be available shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Thank you for subscribing! You can now process more PDFs with your monthly credit allowance.
          </p>
          <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
            <p className="text-sm font-medium mb-2">What's next?</p>
            <ul className="text-sm text-left space-y-1 ml-4 list-disc">
              <li>Your credits will refresh automatically each month</li>
              <li>Access all PDF processing operations</li>
              <li>Manage your subscription anytime from the Plans page</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={() => navigate('/')} className="flex-1">
            Start Processing
          </Button>
          <Button onClick={() => navigate('/subscriptions')} variant="outline" className="flex-1">
            View Plans
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SubscriptionSuccess;
