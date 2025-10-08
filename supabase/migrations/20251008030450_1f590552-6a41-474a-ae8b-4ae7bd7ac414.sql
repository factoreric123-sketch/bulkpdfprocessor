-- Fix 1: Drop the insecure UPDATE policy on user_credits
DROP POLICY IF EXISTS "Users can update their own credits" ON public.user_credits;

-- Fix 2: Add CHECK constraints to prevent invalid credit values
ALTER TABLE public.user_credits
ADD CONSTRAINT credits_non_negative CHECK (credits >= 0),
ADD CONSTRAINT credits_max_limit CHECK (credits <= 1000000);

-- Fix 3: Create security definer function for credit adjustments (only edge functions can call this)
CREATE OR REPLACE FUNCTION public.deduct_user_credits(_user_id uuid, _amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
BEGIN
  -- Get current credits
  SELECT credits INTO current_credits
  FROM public.user_credits
  WHERE user_id = _user_id;
  
  -- Check if user has enough credits
  IF current_credits >= _amount THEN
    UPDATE public.user_credits
    SET credits = credits - _amount,
        updated_at = NOW()
    WHERE user_id = _user_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Fix 4: Update handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  
  -- Insert initial credits (3 free credits)
  INSERT INTO public.user_credits (user_id, credits)
  VALUES (NEW.id, 3);
  
  RETURN NEW;
END;
$$;

-- Fix 5: Update update_updated_at_column function with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix 6: Add restrictive policy to block all user updates to credits
CREATE POLICY "Block direct credit updates"
ON public.user_credits
FOR UPDATE
TO authenticated
USING (false);

-- Fix 7: Add DELETE policy to prevent users from deleting credit records
CREATE POLICY "Prevent credit record deletion"
ON public.user_credits
FOR DELETE
TO authenticated
USING (false);