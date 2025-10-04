import { Coins, Infinity } from 'lucide-react';
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
    <div className="flex items-center justify-center gap-3 bg-card/30 backdrop-blur-sm border border-primary-foreground/20 rounded-full px-6 py-3 shadow-lg">
      {isUnlimited ? (
        <>
          <Infinity className="w-5 h-5" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Unlimited Credits</span>
            {planName && (
              <Badge variant="secondary" className="text-sm font-bold px-3 py-1">
                {planName}
              </Badge>
            )}
          </div>
        </>
      ) : (
        <>
          <Coins className="w-5 h-5" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{planName ? 'Monthly Credits:' : 'Free Credits:'}</span>
            <Badge 
              variant={credits > 0 ? "default" : "destructive"}
              className="text-base font-bold px-3 py-1"
            >
              {credits}
            </Badge>
            {planName && (
              <Badge variant="secondary" className="text-sm px-2 py-1">
                {planName}
              </Badge>
            )}
          </div>
        </>
      )}
    </div>
  );
};
