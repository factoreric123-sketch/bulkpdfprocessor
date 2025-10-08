import { AlertCircle, FileX, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ErrorReportProps {
  successful: number;
  failed: string[];
  onClose?: () => void;
}

export const ErrorReport = ({ successful, failed, onClose }: ErrorReportProps) => {
  if (failed.length === 0) return null;

  return (
    <Alert className="border-warning bg-warning/10">
      <AlertCircle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-foreground">Processing Complete with Warnings</AlertTitle>
      <AlertDescription className="space-y-3 mt-2">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-foreground">{successful} file{successful !== 1 ? 's' : ''} processed successfully</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileX className="h-4 w-4 text-destructive" />
            <span>{failed.length} file{failed.length !== 1 ? 's' : ''} skipped (not found):</span>
          </div>
          <div className="ml-6 space-y-1 max-h-40 overflow-y-auto">
            {failed.map((fileName, idx) => (
              <div key={idx} className="text-sm text-muted-foreground font-mono">
                • {fileName}
              </div>
            ))}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
