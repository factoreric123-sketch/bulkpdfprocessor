import { Infinity, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CreditDisplayProps {
  credits: number;
  isLoading?: boolean;
  planName?: string | null;
  isUnlimited?: boolean;
}

export const CreditDisplay = ({ credits, isLoading, planName, isUnlimited }: CreditDisplayProps) => {
  if (isLoading) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm">
      {isUnlimited ? (
        <>
          <Infinity className="w-4 h-4 text-primary" />
          <span className="font-medium">Unlimited</span>
          {planName && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {planName}
            </Badge>
          )}
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-medium">{credits}</span>
          <span className="text-muted-foreground">credits</span>
          {planName && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {planName}
            </Badge>
          )}
        </>
      )}
    </div>
  );
};
