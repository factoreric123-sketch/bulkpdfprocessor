import { Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CreditDisplayProps {
  credits: number;
  isLoading?: boolean;
}

export const CreditDisplay = ({ credits, isLoading }: CreditDisplayProps) => {
  if (isLoading) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-card/30 backdrop-blur-sm border border-primary-foreground/20 rounded-full px-6 py-3 shadow-lg">
      <Coins className="w-5 h-5" />
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Free Credits:</span>
        <Badge 
          variant={credits > 0 ? "default" : "destructive"}
          className="text-base font-bold px-3 py-1"
        >
          {credits}
        </Badge>
      </div>
    </div>
  );
};
