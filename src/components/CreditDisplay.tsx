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
    <div className="flex items-center gap-2 bg-primary-foreground/10 border border-primary-foreground/20 rounded-lg px-3 py-1.5 backdrop-blur-sm">
      {isUnlimited ? (
        <>
          <Infinity className="w-4 h-4" />
          <span className="font-medium text-sm">Unlimited</span>
          {planName && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {planName}
            </Badge>
          )}
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          <span className="font-medium text-sm">{credits}</span>
          <span className="opacity-80 text-sm">credits</span>
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
