import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

const CREDITS_KEY = 'pdf_processor_credits';
const INITIAL_CREDITS = 3;

export const useCredits = () => {
  const [credits, setCredits] = useState<number>(INITIAL_CREDITS);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Initialize user and credits
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        // Load from database for authenticated users
        await loadCreditsFromDB(session.user.id);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Migrate localStorage credits to database
        setTimeout(async () => {
          await migrateLocalCreditsToDb(session.user.id);
          await loadCreditsFromDB(session.user.id);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        // Reset to localStorage
        const storedCredits = localStorage.getItem(CREDITS_KEY);
        setCredits(storedCredits ? parseInt(storedCredits, 10) : INITIAL_CREDITS);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      console.error('Error loading credits:', error);
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
        console.error('Error migrating credits:', error);
      }
    }
  };

  // Update storage whenever credits change
  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // Update database for authenticated users
        supabase
          .from('user_credits')
          .update({ credits })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) console.error('Error updating credits:', error);
          });
      } else {
        // Update localStorage for anonymous users
        localStorage.setItem(CREDITS_KEY, credits.toString());
      }
    }
  }, [credits, isLoading, user]);

  const deductCredits = (amount: number): boolean => {
    if (credits >= amount) {
      setCredits(prev => prev - amount);
      return true;
    }
    return false;
  };

  const hasCredits = (amount: number = 1): boolean => {
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
  };
};
