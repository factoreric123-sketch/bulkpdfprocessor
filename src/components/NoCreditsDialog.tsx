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
import { Coins } from 'lucide-react';

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

  const handleAction = () => {
    if (!isAuthenticated) {
      navigate('/auth');
    } else {
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-6 h-6 text-destructive" />
            <AlertDialogTitle>Insufficient Credits</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              This operation requires <strong>{requiredCredits} credit{requiredCredits > 1 ? 's' : ''}</strong>, 
              but you only have <strong>{availableCredits} credit{availableCredits !== 1 ? 's' : ''}</strong> remaining.
            </p>
            <p className="text-foreground font-medium">
              {!isAuthenticated && 'Sign in to get more credits or upgrade your account.'}
              {isAuthenticated && 'Please upgrade your account to continue processing PDFs.'}
            </p>
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="font-semibold mb-1">What's a credit?</p>
              <p className="text-muted-foreground">
                One credit = one PDF processed (one row in your Excel file)
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleAction}>
            {isAuthenticated ? 'Got it' : 'Sign In'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
