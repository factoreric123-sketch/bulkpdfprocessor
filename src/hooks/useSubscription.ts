import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface SubscriptionData {
  subscribed: boolean;
  product_id: string | null;
  plan_name: string | null;
  subscription_end: string | null;
  credits_per_month: number | null;
}

export const useSubscription = () => {
  const [subscription, setSubscription] = useState<SubscriptionData>({
    subscribed: false,
    product_id: null,
    plan_name: null,
    subscription_end: null,
    credits_per_month: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setSubscription({
          subscribed: false,
          product_id: null,
          plan_name: null,
          subscription_end: null,
          credits_per_month: null,
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        setIsLoading(false);
        return;
      }

      setSubscription(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await checkSubscription();
      } else {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => {
          checkSubscription();
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setSubscription({
          subscribed: false,
          product_id: null,
          plan_name: null,
          subscription_end: null,
          credits_per_month: null,
        });
      }
    });

    return () => authSubscription.unsubscribe();
  }, []);

  const createCheckout = async (priceId: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
        headers,
      });

      if (error) throw error;
      return data.url;
    } catch (error) {
      console.error('Error creating checkout:', error);
      return null;
    }
  };
  const openCustomerPortal = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;
      return data.url;
    } catch (error) {
      console.error('Error opening customer portal:', error);
      return null;
    }
  };

  return {
    subscription,
    isLoading,
    user,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
};
