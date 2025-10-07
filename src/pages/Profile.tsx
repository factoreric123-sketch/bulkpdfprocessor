import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCredits } from '@/hooks/useCredits';
import { useSubscription } from '@/hooks/useSubscription';
import { Home, User, CreditCard, Shield, Receipt, AlertCircle, Loader2, Mail, Calendar, Coins } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, credits, isUnlimited, isLoading: authLoading } = useCredits();
  const { subscription, openCustomerPortal, isLoading: subLoading } = useSubscription();
  
  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [authProvider, setAuthProvider] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }

    const loadProfile = async () => {
      try {
        // Get user metadata and auth provider
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser) {
          const provider = authUser.app_metadata?.provider || 'email';
          setAuthProvider(provider);
          
          // Load profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', authUser.id)
            .single();
          
          if (profile) {
            setDisplayName(profile.display_name || authUser.email || '');
          } else {
            setDisplayName(authUser.email || '');
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user, navigate, authLoading]);

  const handleSaveName = async () => {
    if (!user) return;
    
    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Display name updated successfully.',
      });
      setIsEditingName(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update display name.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Password changed successfully.',
      });
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const url = await openCustomerPortal();
      if (url) {
        window.open(url, '_blank');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to open billing portal.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to open billing portal.',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const nextBillingDate = subscription.subscription_end 
    ? new Date(subscription.subscription_end).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Account Profile</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        {/* User Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              User Information
            </CardTitle>
            <CardDescription>Your account details and sign-in method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="flex items-center gap-2">
                <Input value={user?.email || ''} disabled className="bg-muted" />
                <Badge variant="outline" className="shrink-0">
                  <Mail className="w-3 h-3 mr-1" />
                  {authProvider === 'google' ? 'Google' : 'Email'}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!isEditingName || isSavingName}
                  className={!isEditingName ? 'bg-muted' : ''}
                />
                {!isEditingName ? (
                  <Button onClick={() => setIsEditingName(true)} variant="outline">
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleSaveName} disabled={isSavingName}>
                      {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditingName(false);
                        setDisplayName(user?.email || '');
                      }}
                      variant="outline"
                      disabled={isSavingName}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Subscription & Credits
            </CardTitle>
            <CardDescription>Your current plan and credit balance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Plan</Label>
                <div className="flex items-center gap-2">
                  <Badge variant={subscription.subscribed ? "default" : "secondary"} className="text-base px-3 py-1">
                    {subscription.plan_name || 'Free'}
                  </Badge>
                </div>
              </div>

              {nextBillingDate && (
                <div className="space-y-2">
                  <Label>Next Billing Date</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    {nextBillingDate}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Available Credits</Label>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">
                  {isUnlimited ? '∞' : credits}
                </span>
                <span className="text-muted-foreground">
                  {isUnlimited ? 'Unlimited' : subscription.credits_per_month ? `/ ${subscription.credits_per_month} per month` : 'credits'}
                </span>
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button onClick={() => navigate('/subscriptions')} className="flex-1">
                {subscription.subscribed ? 'Change Plan' : 'Upgrade Plan'}
              </Button>
              {subscription.subscribed && (
                <Button onClick={handleManageBilling} variant="outline" className="flex-1" disabled={subLoading}>
                  Manage Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>Manage your account security settings</CardDescription>
          </CardHeader>
          <CardContent>
            {authProvider === 'google' ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You're signed in with Google. Password changes are managed through your Google account.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    minLength={6}
                    disabled={isChangingPassword}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    minLength={6}
                    disabled={isChangingPassword}
                  />
                </div>

                <Button type="submit" disabled={isChangingPassword || !newPassword || !confirmPassword}>
                  {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Change Password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Billing & Payment Section */}
        {subscription.subscribed && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Billing & Payments
              </CardTitle>
              <CardDescription>Manage your payment methods and view billing history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  Payment methods and billing history are managed through Stripe.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={handleManageBilling} variant="outline" className="flex-1" disabled={subLoading}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Update Payment Method
                </Button>
                <Button onClick={handleManageBilling} variant="outline" className="flex-1" disabled={subLoading}>
                  <Receipt className="w-4 h-4 mr-2" />
                  View Billing History
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Management */}
        {subscription.subscribed && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Account Management
              </CardTitle>
              <CardDescription>Manage your subscription status</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  To cancel your subscription, click the button below to access the billing portal where you can manage your subscription settings.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleManageBilling}
                variant="destructive"
                className="mt-4"
                disabled={subLoading}
              >
                Cancel Subscription
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Profile;
