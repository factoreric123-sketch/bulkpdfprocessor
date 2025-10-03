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
}

export const NoCreditsDialog = ({ 
  open, 
  onOpenChange, 
  requiredCredits, 
  availableCredits 
}: NoCreditsDialogProps) => {
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
              Sign up now to continue processing PDFs with a paid subscription!
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
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
