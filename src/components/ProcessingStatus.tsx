import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProcessingStatusProps {
  status: 'idle' | 'processing' | 'success' | 'error';
  progress: number;
  message: string;
}

export const ProcessingStatus = ({ status, progress, message }: ProcessingStatusProps) => {
  if (status === 'idle') return null;

  return (
    <div className="bg-gradient-card rounded-lg p-6 shadow-medium border border-border">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {status === 'processing' && (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-5 h-5 text-destructive" />
          )}
          <p className="font-medium text-foreground">{message}</p>
        </div>
        
        {status === 'processing' && (
          <Progress value={progress} className="h-2" />
        )}
      </div>
    </div>
  );
};
