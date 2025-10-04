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
    monthlyPriceId: "price_1QdU1eP0e5cWYUQoSg0Q0Q0Q",
    annualPriceId: "price_1QdU1fP0e5cWYUQoSg0Q0Q0R",
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
    monthlyPriceId: "price_1QdU1gP0e5cWYUQoSg0Q0Q0S",
    annualPriceId: "price_1QdU1hP0e5cWYUQoSg0Q0Q0T",
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
    monthlyPriceId: "price_1QdU1iP0e5cWYUQoSg0Q0Q0U",
    annualPriceId: "price_1QdU1jP0e5cWYUQoSg0Q0Q0V",
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
  const { subscription, createCheckout, openCustomerPortal, user } = useSubscription();
  const { toast } = useToast();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to subscribe to a plan.",
        variant: "destructive",
      });
      return;
    }

    const url = await createCheckout(priceId);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast({
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleManageSubscription = async () => {
    const url = await openCustomerPortal();
    if (url) {
      window.open(url, '_blank');
    } else {
      toast({
        title: "Error",
        description: "Failed to open customer portal. Please try again.",
        variant: "destructive",
      });
    }
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
        {plans.map((plan) => (
          <Card key={plan.name} className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}>
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
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
                onClick={() => handleSubscribe(billingPeriod === 'monthly' ? plan.monthlyPriceId : plan.annualPriceId)}
              >
                {subscription.plan_name === plan.name ? 'Current Plan' : 'Subscribe'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
