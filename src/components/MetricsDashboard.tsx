import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MetricsDashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('metrics_summary')
        .select('*')
        .order('hour', { ascending: false })
        .limit(24);
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const latestHour = metrics?.[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Operations/Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{latestHour?.total_operations || 0}</div>
          <p className="text-xs text-muted-foreground">
            {latestHour?.error_rate || 0}% error rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {((latestHour?.avg_duration_ms || 0) / 1000).toFixed(1)}s
          </div>
          <p className="text-xs text-muted-foreground">
            Per operation
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Files Processed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{latestHour?.total_files_processed || 0}</div>
          <p className="text-xs text-muted-foreground">
            Last hour
          </p>
        </CardContent>
      </Card>
    </div>
  );
}