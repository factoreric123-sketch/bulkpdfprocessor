import { useState, useEffect } from 'react';

const CREDITS_KEY = 'pdf_processor_credits';
const INITIAL_CREDITS = 3;

export const useCredits = () => {
  const [credits, setCredits] = useState<number>(INITIAL_CREDITS);
  const [isLoading, setIsLoading] = useState(true);

  // Load credits from localStorage on mount
  useEffect(() => {
    const storedCredits = localStorage.getItem(CREDITS_KEY);
    if (storedCredits !== null) {
      setCredits(parseInt(storedCredits, 10));
    } else {
      // First time user, set initial credits
      localStorage.setItem(CREDITS_KEY, INITIAL_CREDITS.toString());
    }
    setIsLoading(false);
  }, []);

  // Update localStorage whenever credits change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(CREDITS_KEY, credits.toString());
    }
  }, [credits, isLoading]);

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
  };
};
