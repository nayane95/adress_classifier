'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, RefreshCw, Activity } from 'lucide-react';

interface Job {
  id: string;
  filename: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  ai_rows: number;
  ai_usage_percent: number;
  avg_confidence: number;
  needs_review_count: number;
  search_calls_count: number;
  ai_tokens_estimate: number;
  current_step: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityMessage {
  id: string;
  message: string;
  message_type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  created_at: string;
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const router = useRouter();
  const t = useTranslations('jobDetail');
  const tStatus = useTranslations('status');
  
  const [job, setJob] = useState<Job | null>(null);
  const [activities, setActivities] = useState<ActivityMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    loadJob();
    subscribeToUpdates();
  }, [id]);

  const loadJob = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading job:', error);
      return;
    }

    setJob(data);
    setLoading(false);

    // Load activity feed
    const { data: activityData } = await supabase
      .from('activity_feed')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (activityData) {
      setActivities(activityData);
    }
  };

  const subscribeToUpdates = () => {
    // Subscribe to job updates
    const jobChannel = supabase
      .channel(`job:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setJob(payload.new as Job);
        }
      )
      .subscribe();

    // Subscribe to activity feed
    const activityChannel = supabase
      .channel(`activity:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: `job_id=eq.${id}`,
        },
        (payload) => {
          setActivities((prev) => [payload.new as ActivityMessage, ...prev]);
        }
      )
      .subscribe();

    return () => {
      jobChannel.unsubscribe();
      activityChannel.unsubscribe();
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500';
      case 'FAILED':
        return 'bg-red-500';
      case 'PARSING':
      case 'RULES':
      case 'ENRICHING':
      case 'AI_CLASSIFYING':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return 'text-green-600 bg-green-50';
      case 'ERROR':
        return 'text-red-600 bg-red-50';
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  if (loading || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progressPercent = (job.processed_rows / job.total_rows) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{job.filename}</h1>
                <p className="text-sm text-muted-foreground">
                  Job ID: {job.id.substring(0, 8)}...
                </p>
              </div>
            </div>
            <Badge className={getStatusColor(job.status)}>
              {tStatus(job.status)}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>{job.current_step || 'Processing...'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processed Rows</span>
                  <span className="font-medium">
                    {job.processed_rows} / {job.total_rows}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>AI Usage</CardDescription>
                <CardTitle className="text-3xl">
                  {job.ai_usage_percent.toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {job.ai_rows} of {job.total_rows} rows
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Avg Confidence</CardDescription>
                <CardTitle className="text-3xl">
                  {job.avg_confidence.toFixed(0)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Classification confidence
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Needs Review</CardDescription>
                <CardTitle className="text-3xl">{job.needs_review_count}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {((job.needs_review_count / job.total_rows) * 100).toFixed(1)}% of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Search Calls</CardDescription>
                <CardTitle className="text-3xl">{job.search_calls_count}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Enrichment API calls
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="activity" className="w-full">
            <TabsList>
              <TabsTrigger value="activity">
                <Activity className="h-4 w-4 mr-2" />
                Activity Feed
              </TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Live Activity Feed</CardTitle>
                  <CardDescription>
                    Real-time updates on classification progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className={`p-3 rounded-lg ${getMessageTypeColor(activity.message_type)}`}
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium">{activity.message}</p>
                          <span className="text-xs opacity-70">
                            {new Date(activity.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data">
              <Card>
                <CardHeader>
                  <CardTitle>Data Table</CardTitle>
                  <CardDescription>View and edit classified contacts</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Data table component will be implemented here with TanStack Table
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <Card>
                <CardHeader>
                  <CardTitle>Analytics</CardTitle>
                  <CardDescription>Classification insights and demographics</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Analytics charts will be implemented here with Recharts
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          {job.status === 'COMPLETED' && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Button className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={() => router.push(`/jobs/${job.id}/data`)}>
                    View Data Table
                  </Button>
                  <Button variant="outline" onClick={() => router.push(`/jobs/${job.id}/analytics`)}>
                    View Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
