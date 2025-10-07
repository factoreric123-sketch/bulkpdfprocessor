import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  monthlyPriceId: string;
  annualPriceId: string;
  credits: string;
  features: string[];
  popular?: boolean;
}

const plans: Plan[] = [
  {
    name: "Starter",
    monthlyPrice: "$9",
    annualPrice: "$69",
    monthlyPriceId: "price_1SFjzJENle41ZznsmkHxGSkf",
    annualPriceId: "price_1SFjzKENle41ZznsrawHjDO0",
    credits: "50 credits/month",
    features: [
      "50 PDF processing credits per month",
      "All PDF operations (merge, split, delete, reorder, rename)",
      "Email support",
      "Basic templates",
    ],
  },
  {
    name: "Professional",
    monthlyPrice: "$29",
    annualPrice: "$199",
    monthlyPriceId: "price_1SFjzLENle41Zznsx9GYdFr0",
    annualPriceId: "price_1SFjzMENle41ZznswKtrTxPR",
    credits: "200 credits/month",
    features: [
      "200 PDF processing credits per month",
      "All PDF operations",
      "Priority email support",
      "Advanced templates",
      "Batch processing",
    ],
    popular: true,
  },
  {
    name: "Business",
    monthlyPrice: "$79",
    annualPrice: "$599",
    monthlyPriceId: "price_1SFjzNENle41ZznsP1Sbgr7L",
    annualPriceId: "price_1SFjzOENle41ZznslJ4HYSZ9",
    credits: "Unlimited credits",
    features: [
      "Unlimited PDF processing credits",
      "All PDF operations",
      "24/7 priority support",
      "Custom templates",
      "Advanced batch processing",
      "API access",
    ],
  },
];

export const SubscriptionPlans = () => {
  const { subscription, createCheckout, openCustomerPortal, user, isLoading } = useSubscription();
  const { toast } = useToast();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [processingPriceId, setProcessingPriceId] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to subscribe to a plan.",
        variant: "destructive",
      });
      return;
    }

    setProcessingPriceId(priceId);
    
    try {
      const url = await createCheckout(priceId);
      if (url) {
        window.open(url, '_blank');
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingPriceId(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const url = await openCustomerPortal();
      if (url) {
        window.open(url, '_blank');
      } else {
        throw new Error('Failed to open customer portal');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open customer portal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isPlanActive = (planName: string) => {
    if (!subscription.plan_name) return false;
    return subscription.plan_name.toLowerCase().includes(planName.toLowerCase());
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
        <p className="text-muted-foreground mb-6">Select the perfect plan for your PDF processing needs</p>
        
        <div className="inline-flex items-center gap-4 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 rounded-md transition-colors ${
              billingPeriod === 'monthly' ? 'bg-background shadow-sm' : ''
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-6 py-2 rounded-md transition-colors ${
              billingPeriod === 'annual' ? 'bg-background shadow-sm' : ''
            }`}
          >
            Annual <Badge variant="secondary" className="ml-2">Save 20%</Badge>
          </button>
        </div>
      </div>

      {subscription.subscribed && (
        <div className="mb-8 p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
          <p className="text-sm mb-2">
            Current Plan: <strong>{subscription.plan_name}</strong>
          </p>
          <Button onClick={handleManageSubscription} variant="outline" size="sm">
            Manage Subscription
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const isActive = isPlanActive(plan.name);
          const priceId = billingPeriod === 'monthly' ? plan.monthlyPriceId : plan.annualPriceId;
          const isProcessing = processingPriceId === priceId;
          
          return (
            <Card key={plan.name} className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''} ${isActive ? 'ring-2 ring-primary' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
              )}
              {isActive && (
                <Badge className="absolute -top-3 right-4 bg-green-500">Your Plan</Badge>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold">
                    {billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
                  </span>
                  <span className="text-muted-foreground">/{billingPeriod === 'monthly' ? 'month' : 'year'}</span>
                </CardDescription>
                <p className="text-sm text-muted-foreground mt-2">{plan.credits}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(priceId)}
                  disabled={isActive || isProcessing || isLoading}
                >
                  {isProcessing ? 'Processing...' : isActive ? 'Current Plan' : 'Subscribe'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
