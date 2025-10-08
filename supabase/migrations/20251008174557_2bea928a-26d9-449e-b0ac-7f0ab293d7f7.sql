-- Add DELETE policy to prevent users from deleting subscription records
CREATE POLICY "Prevent subscription record deletion"
ON public.user_subscriptions
FOR DELETE
TO authenticated
USING (false);