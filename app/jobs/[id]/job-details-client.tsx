'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Download, RefreshCw, Activity, 
  CheckCircle, AlertTriangle, Search, Brain, 
  FileText, Clock, BarChart3, ChevronRight 
} from 'lucide-react';
import { DataTable } from '@/components/job/data-table';
import { columns } from '@/components/job/columns';
import { JobAnalytics } from '@/components/job/job-analytics';

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
  language: 'en' | 'fr';
  created_at: string;
  updated_at: string;
}

interface ActivityMessage {
  id: string;
  message: string;
  message_type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  created_at: string;
  metadata?: any;
}

export default function JobDetailsClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const t = useTranslations('jobDetail');
  const tStatus = useTranslations('status');
  
  const [job, setJob] = useState<Job | null>(null);
  const [activities, setActivities] = useState<ActivityMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    loadJob();
    subscribeToUpdates();
  }, [jobId]);

  // Auto-scroll activity feed
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
    }
  }, [activities]);

  const loadJob = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
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
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (activityData) {
      setActivities(activityData);
    }
  };

  const subscribeToUpdates = () => {
    const jobChannel = supabase
      .channel(`job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setJob(payload.new as Job);
        }
      )
      .subscribe();

    const activityChannel = supabase
      .channel(`activity:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: `job_id=eq.${jobId}`,
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
      case 'COMPLETED': return 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-200';
      case 'FAILED': return 'bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-200';
      case 'PARSING':
      case 'RULES':
      case 'ENRICHING':
      case 'AI_CLASSIFYING': return 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-200 animate-pulse';
      default: return 'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 border-slate-200';
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'ERROR': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const handleExport = async () => {
    if (!job) return;
    try {
        const { data: rows, error } = await supabase
            .from('job_rows')
            .select('row_index, final_category, confidence, reason_en, reason_fr, public_signals_en, public_signals_fr, classification_method, ai_used, enrichment_status, manual_override, last_processing_step, normalized_json')
            .eq('job_id', job.id)
            .order('row_index', { ascending: true });

        if (error) throw error;
        if (!rows || rows.length === 0) return;

        const typedRows = rows as any[];
        
        const headers = ['ID', 'Category', 'Confidence', 'Reason', 'Public Signals', 'Method', 'AI Used', 'Enrichment', 'Override', 'Step'];
        const firstRowKeys = Object.keys(typedRows[0].normalized_json || {});
        const allHeaders = [...headers, ...firstRowKeys];
        
        const csvRows = typedRows.map(row => {
            const baseData = [
            row.row_index,
            row.final_category || 'A_QUALIFIER',
            `${row.confidence || 0}%`,
            job.language === 'fr' ? row.reason_fr : row.reason_en,
            job.language === 'fr' ? row.public_signals_fr : row.public_signals_en,
            row.classification_method,
            row.ai_used ? 'YES' : 'NO',
            row.enrichment_status,
            row.manual_override ? 'YES' : 'NO',
            row.last_processing_step
            ];
            
            const normalizedData = firstRowKeys.map(key => row.normalized_json?.[key] || '');
            return [...baseData, ...normalizedData].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [allHeaders.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `job_${job.id.substring(0, 8)}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error('Export failed:', err);
    }
  };

  if (loading || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
            <p className="text-slate-500 font-medium">Loading Job Details...</p>
        </div>
      </div>
    );
  }

  const progressPercent = (job.processed_rows / job.total_rows) * 100;

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 shadow-sm backdrop-blur-xl bg-white/90">
        <div className="container mx-auto px-4 py-4 md:py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.push('/')}
                className="hover:bg-slate-100 rounded-full"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{job.filename}</h1>
                    <Badge variant="outline" className={`${getStatusColor(job.status)} border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide`}>
                        {tStatus(job.status)}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                    <span className="font-mono">ID: {job.id.substring(0, 8)}</span>
                    <span>•</span>
                    <span>{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {job.status !== 'COMPLETED' && job.status !== 'FAILED' && (
                <Button 
                  size="sm" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all hover:shadow-lg"
                  onClick={async () => {
                    await supabase.functions.invoke('orchestrate-job', { body: { jobId: job.id } });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin-slow" />
                  Run Classification
                </Button>
              )}
              {job.status === 'COMPLETED' && (
                <Button 
                    size="sm" 
                    variant="outline"
                    className="border-slate-200 hover:bg-slate-50"
                    onClick={handleExport}
                >
                    <Download className="h-4 w-4 mr-2 text-slate-600" />
                    Export CSV
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid gap-8">
            
          {/* Progress Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Current Status</span>
                    <span className="text-lg font-medium text-slate-900">{job.current_step || 'Initializing...'}</span>
                </div>
                <div className="text-right">
                    <span className="text-3xl font-bold text-slate-900">{Math.round(progressPercent)}%</span>
                </div>
            </div>
            <Progress value={progressPercent} className="h-3 rounded-full bg-slate-100 [&>div]:bg-indigo-600" />
            <div className="flex justify-between mt-2 text-xs text-slate-500 font-medium">
                <span>0 Rows</span>
                <span>{job.processed_rows} / {job.total_rows} Processed</span>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Brain className="h-6 w-6 text-indigo-600" />
                    </div>
                    {job.ai_usage_percent < 80 ? (
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Optimal</span>
                    ) : (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">High</span>
                    )}
                </div>
                <div className="space-y-1">
                    <span className="text-sm font-medium text-slate-500">AI Rows</span>
                    <h3 className="text-2xl font-bold text-slate-900">{job.ai_rows.toLocaleString()}</h3>
                </div>
                <div className="mt-4 text-xs text-slate-500">
                    <span className="font-semibold text-indigo-600">{job.ai_usage_percent.toFixed(1)}%</span> of total rows
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                        <CheckCircle className="h-6 w-6 text-emerald-600" />
                    </div>
                    <span className="text-xs font-medium text-slate-500">Target: &gt;80%</span>
                </div>
                <div className="space-y-1">
                    <span className="text-sm font-medium text-slate-500">Avg Confidence</span>
                    <h3 className="text-2xl font-bold text-slate-900">{job.avg_confidence.toFixed(0)}%</h3>
                </div>
                <div className="mt-4 text-xs text-slate-500">
                    Classification certainty
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-amber-50 rounded-lg">
                        <AlertTriangle className="h-6 w-6 text-amber-600" />
                    </div>
                </div>
                <div className="space-y-1">
                    <span className="text-sm font-medium text-slate-500">Needs Review</span>
                    <h3 className="text-2xl font-bold text-slate-900">{job.needs_review_count.toLocaleString()}</h3>
                </div>
                <div className="mt-4 text-xs text-slate-500">
                    <span className="font-semibold text-amber-600">{((job.needs_review_count / job.total_rows) * 100).toFixed(1)}%</span> require attention
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Search className="h-6 w-6 text-blue-600" />
                    </div>
                </div>
                <div className="space-y-1">
                    <span className="text-sm font-medium text-slate-500">Enrichments</span>
                    <h3 className="text-2xl font-bold text-slate-900">{job.search_calls_count.toLocaleString()}</h3>
                </div>
                <div className="mt-4 text-xs text-slate-500">
                    External API calls made
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden min-h-[500px]">
            <Tabs defaultValue="activity" className="w-full">
                <div className="border-b px-6 py-4 bg-slate-50/50">
                    <TabsList className="bg-slate-100/50 p-1 rounded-lg">
                        <TabsTrigger value="activity" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                            <Activity className="h-4 w-4 mr-2" />
                            Activity Feed
                        </TabsTrigger>
                        <TabsTrigger value="data" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Data Table
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Analytics
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="p-6">
                    <TabsContent value="activity" className="mt-0 focus-visible:outline-hidden">
                        <div className="max-w-3xl mx-auto space-y-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-slate-900">Live Processing Log</h3>
                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hidden md:flex">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2 animate-pulse"></span>
                                    Real-time Updates
                                </Badge>
                            </div>
                            
                            <div className="relative border-l-2 border-slate-100 pl-8 space-y-8" ref={scrollRef}>
                                {activities.map((activity) => (
                                    <div key={activity.id} className="relative group">
                                        <div className={`absolute -left-[41px] p-1.5 rounded-full border-2 border-white shadow-sm transition-colors ${
                                            activity.message_type === 'SUCCESS' ? 'bg-emerald-100' : 
                                            activity.message_type === 'ERROR' ? 'bg-red-100' : 
                                            'bg-slate-100 group-hover:bg-indigo-100'
                                        }`}>
                                            {getTimelineIcon(activity.message_type)}
                                        </div>
                                        
                                        <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-sm font-medium text-slate-900">{activity.message}</p>
                                                <span className="text-xs text-slate-400 whitespace-nowrap ml-4">
                                                    {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </div>

                                            {activity.metadata?.type === 'AI_INTERACTION' && (
                                                <div className="mt-3 bg-slate-50 rounded-md border border-slate-200 overflow-hidden text-xs">
                                                    <details className="group/details">
                                                        <summary className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-2 text-indigo-600 font-medium">
                                                                <Brain className="h-3.5 w-3.5" />
                                                                <span>AI Reasoning Details</span>
                                                            </div>
                                                            <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open/details:rotate-90" />
                                                        </summary>
                                                        
                                                        <div className="p-3 border-t border-slate-200 space-y-3 bg-white">
                                                            <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                                                                <div>Model: <span className="text-slate-900">{activity.metadata.model}</span></div>
                                                                <div>Rows: <span className="text-slate-900">{activity.metadata.row_indices?.join(', ')}</span></div>
                                                            </div>
                                                            
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">User Prompt</div>
                                                                <div className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[10px] text-slate-600 max-h-24 overflow-y-auto">
                                                                    {activity.metadata.user_prompt}
                                                                </div>
                                                            </div>
                                                            
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Analysis Result</div>
                                                                <div className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[10px] text-slate-600 max-h-40 overflow-y-auto">
                                                                    {activity.metadata.raw_response}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </details>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {activities.length === 0 && (
                                    <div className="text-center py-10 text-slate-400 italic">
                                        Waiting for activity...
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="data" className="mt-0 focus-visible:outline-hidden">
                        <DataTable columns={columns} jobId={job.id} />
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-0 focus-visible:outline-hidden">
                        <JobAnalytics jobId={job.id} />
                    </TabsContent>
                </div>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
