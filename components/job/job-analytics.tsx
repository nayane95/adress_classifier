'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { Loader2 } from 'lucide-react';

interface AnalyticsProps {
  jobId: string;
}

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

export function JobAnalytics({ jobId }: AnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [confidenceData, setConfidenceData] = useState<any[]>([]);
  const [methodData, setMethodData] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch all rows for analytics (limiting to 2000 for performance)
      const { data: rows, error } = await supabase
        .from('job_rows')
        .select('final_category, confidence, classification_method')
        .eq('job_id', jobId)
        .limit(2000);

      if (error) {
        console.error('Error fetching analytics data:', error);
        setLoading(false);
        return;
      }

      processStats(rows);
      setLoading(false);
    };

    fetchData();
  }, [jobId]);

  const processStats = (rows: any[]) => {
    // 1. Category Distribution
    const categories: Record<string, number> = {};
    rows.forEach(row => {
      const cat = row.final_category || 'A_QUALIFIER';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    const catData = Object.entries(categories).map(([name, value]) => ({
      name,
      value,
    }));
    setCategoryData(catData);

    // 2. Confidence Distribution
    const confidenceBuckets = {
      '0-50%': 0,
      '50-70%': 0,
      '70-90%': 0,
      '90-100%': 0,
    };

    rows.forEach(row => {
      const conf = row.confidence || 0;
      if (conf >= 90) confidenceBuckets['90-100%']++;
      else if (conf >= 70) confidenceBuckets['70-90%']++;
      else if (conf >= 50) confidenceBuckets['50-70%']++;
      else confidenceBuckets['0-50%']++;
    });

    const confData = Object.entries(confidenceBuckets).map(([name, value]) => ({
      name,
      value,
    }));
    setConfidenceData(confData);

    // 3. Method Distribution
    const methods: Record<string, number> = {};
    rows.forEach(row => {
      const method = row.classification_method || 'Unknown';
      methods[method] = (methods[method] || 0) + 1;
    });

    const metData = Object.entries(methods).map(([name, value]) => ({
      name,
      value,
    }));
    setMethodData(metData);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Category Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Category Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Confidence Score Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* AI vs Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Classification Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={methodData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {methodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#F59E0B'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Stats */}
      <Card>
        <CardHeader>
            <CardTitle>Quick Insights</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Top Category</span>
                    <span className="font-semibold">{categoryData.sort((a,b) => b.value - a.value)[0]?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">High Confidence Rows</span>
                    <span className="font-semibold">{confidenceData.find(c => c.name === '90-100%')?.value || 0}</span>
                </div>
                 <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Unclassified / Needs Review</span>
                    <span className="font-semibold text-amber-600">{categoryData.find(c => c.name === 'A_QUALIFIER')?.value || 0}</span>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
