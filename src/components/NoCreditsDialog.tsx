import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditCard } from 'lucide-react';

interface NoCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredCredits: number;
  availableCredits: number;
  isAuthenticated: boolean;
}

export const NoCreditsDialog = ({ 
  open, 
  onOpenChange, 
  requiredCredits, 
  availableCredits,
  isAuthenticated 
}: NoCreditsDialogProps) => {
  const navigate = useNavigate();
  const deficit = requiredCredits - availableCredits;

  const handleAction = () => {
    if (isAuthenticated) {
      navigate('/subscriptions');
    } else {
      navigate('/auth');
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Insufficient Credits
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              This operation requires <strong>{requiredCredits} credits</strong>, but you only
              have <strong>{availableCredits} credits</strong> available.
            </p>
            <p className="text-sm">
              You need <strong>{deficit} more credit{deficit !== 1 ? 's' : ''}</strong> to
              complete this operation.
            </p>
            {isAuthenticated ? (
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <p className="font-medium mb-2">Upgrade to a subscription plan to get:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>50-200 credits per month (or unlimited)</li>
                  <li>All PDF processing operations</li>
                  <li>Priority support</li>
                  <li>Advanced features</li>
                </ul>
              </div>
            ) : (
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <p className="font-medium">Sign in to get more credits!</p>
                <p className="text-sm mt-1">
                  Create an account to access subscription plans with monthly credits.
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleAction}>
            {isAuthenticated ? 'View Plans' : 'Sign In'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
