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
    <div className="inline-flex items-center gap-1.5 bg-primary-foreground/10 border border-primary-foreground/20 rounded-full px-2.5 py-1 text-xs backdrop-blur-sm w-auto">
      {isUnlimited ? (
        <>
          <Infinity className="w-3.5 h-3.5" />
          <span className="font-medium">Unlimited</span>
          {planName && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
              {planName}
            </Badge>
          )}
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-medium">{credits}</span>
          <span className="opacity-80">credits</span>
          {planName && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
              {planName}
            </Badge>
          )}
        </>
      )}
    </div>
  );
};
