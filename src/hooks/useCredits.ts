import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';

const CREDITS_KEY = 'pdf_processor_credits';
const INITIAL_CREDITS = 3;

interface SubscriptionData {
  subscribed: boolean;
  product_id: string | null;
  plan_name: string | null;
  subscription_end: string | null;
  credits_per_month: number | null;
}

export const useCredits = () => {
  const [credits, setCredits] = useState<number>(INITIAL_CREDITS);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData>({
    subscribed: false,
    product_id: null,
    plan_name: null,
    subscription_end: null,
    credits_per_month: null,
  });

  const checkAndRefreshSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (!error && data) {
        setSubscription(data);
        
        // If user has unlimited credits (Business plan), set credits to a high number
        if (data.subscribed && data.credits_per_month === null) {
          setCredits(999999);
        } else if (data.subscribed && data.credits_per_month) {
          // Check if we need to refill credits based on subscription period
          const { data: userCreditsData } = await supabase
            .from('user_credits')
            .select('credits, updated_at')
            .eq('user_id', userId)
            .single();

          if (userCreditsData) {
            const lastUpdate = new Date(userCreditsData.updated_at);
            const now = new Date();
            const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
            
            // Refill credits if it's been more than 30 days
            if (daysSinceUpdate >= 30) {
              await supabase
                .from('user_credits')
                .update({ credits: data.credits_per_month })
                .eq('user_id', userId);
              setCredits(data.credits_per_month);
            } else {
              setCredits(userCreditsData.credits);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error checking subscription:', error);
    }
  };

  // Initialize user and credits
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        // Load from database for authenticated users
        await loadCreditsFromDB(session.user.id);
        await checkAndRefreshSubscription(session.user.id);
      } else {
        // Load from localStorage for anonymous users
        const storedCredits = localStorage.getItem(CREDITS_KEY);
        if (storedCredits !== null) {
          setCredits(parseInt(storedCredits, 10));
        } else {
          localStorage.setItem(CREDITS_KEY, INITIAL_CREDITS.toString());
        }
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Migrate localStorage credits to database
        setTimeout(async () => {
          await migrateLocalCreditsToDb(session.user.id);
          await loadCreditsFromDB(session.user.id);
          await checkAndRefreshSubscription(session.user.id);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        // Reset to localStorage
        const storedCredits = localStorage.getItem(CREDITS_KEY);
        setCredits(storedCredits ? parseInt(storedCredits, 10) : INITIAL_CREDITS);
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

  // Auto-refresh subscription status every 60 seconds for authenticated users
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      await checkAndRefreshSubscription(user.id);
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user]);

  const loadCreditsFromDB = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setCredits(data.credits);
    } catch (error) {
      logger.error('Error loading credits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const migrateLocalCreditsToDb = async (userId: string) => {
    const localCredits = localStorage.getItem(CREDITS_KEY);
    if (localCredits && parseInt(localCredits, 10) < INITIAL_CREDITS) {
      try {
        await supabase
          .from('user_credits')
          .update({ credits: parseInt(localCredits, 10) })
          .eq('user_id', userId);
        localStorage.removeItem(CREDITS_KEY);
      } catch (error) {
        logger.error('Error migrating credits:', error);
      }
    }
  };

  // Update storage whenever credits change (for anonymous users only)
  useEffect(() => {
    if (!isLoading && !user) {
      // Update localStorage for anonymous users only
      localStorage.setItem(CREDITS_KEY, credits.toString());
    }
  }, [credits, isLoading, user]);

  const deductCredits = async (amount: number): Promise<boolean> => {
    // Unlimited credits (Business plan)
    if (credits === 999999) {
      return true;
    }
    
    if (credits < amount) {
      return false;
    }

    // For authenticated users, use the secure edge function
    if (user) {
      try {
        const { data, error } = await supabase.functions.invoke('deduct-credits', {
          body: { amount }
        });

        if (error) throw error;
        
        if (data?.success) {
          setCredits(prev => prev - amount);
          return true;
        }
        return false;
      } catch (error) {
        logger.error('Error deducting credits:', error);
        return false;
      }
    } else {
      // For anonymous users, update localStorage directly
      setCredits(prev => prev - amount);
      return true;
    }
  };

  const hasCredits = (amount: number = 1): boolean => {
    // Unlimited credits (Business plan)
    if (credits === 999999) {
      return true;
    }
    return credits >= amount;
  };

  const resetCredits = () => {
    setCredits(INITIAL_CREDITS);
    localStorage.setItem(CREDITS_KEY, INITIAL_CREDITS.toString());
  };

  return {
    credits,
    isLoading,
    deductCredits,
    hasCredits,
    resetCredits,
    user,
    subscription,
    isUnlimited: credits === 999999,
  };
};
