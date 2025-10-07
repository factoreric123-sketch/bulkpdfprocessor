import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      
      await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          status: 'none',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          stripe_product_id: null,
          plan_name: null,
          current_period_end: null,
          credits_per_month: null,
        });
      
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let planName = null;
    let creditsPerMonth = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      productId = subscription.items.data[0].price.product as string;
      const priceId = subscription.items.data[0].price.id;
      
      // Map product to plan details
      const planMapping: Record<string, { name: string; credits: number | null }> = {
        'price_1SFjzJENle41ZznsmkHxGSkf': { name: 'Starter Monthly', credits: 50 },
        'price_1SFjzKENle41ZznsrawHjDO0': { name: 'Starter Annual', credits: 50 },
        'price_1SFjzLENle41Zznsx9GYdFr0': { name: 'Professional Monthly', credits: 200 },
        'price_1SFjzMENle41ZznswKtrTxPR': { name: 'Professional Annual', credits: 200 },
        'price_1SFjzNENle41ZznsP1Sbgr7L': { name: 'Business Monthly', credits: null },
        'price_1SFjzOENle41ZznslJ4HYSZ9': { name: 'Business Annual', credits: null },
      };
      
      const planDetails = planMapping[priceId];
      planName = planDetails?.name || 'Unknown Plan';
      creditsPerMonth = planDetails?.credits || null;
      
      logStep("Determined subscription tier", { productId, planName, creditsPerMonth });
      
      await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          stripe_product_id: productId,
          plan_name: planName,
          status: 'active',
          current_period_end: subscriptionEnd,
          credits_per_month: creditsPerMonth,
        });
    } else {
      logStep("No active subscription found");
      
      await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: 'none',
          stripe_subscription_id: null,
          stripe_product_id: null,
          plan_name: null,
          current_period_end: null,
          credits_per_month: null,
        });
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      plan_name: planName,
      subscription_end: subscriptionEnd,
      credits_per_month: creditsPerMonth,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
