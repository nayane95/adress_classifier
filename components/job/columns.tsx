'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

export type JobRow = {
  id: string;
  row_index: number;
  final_category: string | null;
  confidence: number | null;
  needs_review: boolean;
  classification_method: string | null;
  normalized_json: any;
  enrichment_status: string | null;
  ai_used: boolean;
  manual_override: boolean;
  last_processing_step: string | null;
  reason_en: string | null;
  reason_fr: string | null;
  public_signals_en: string | null;
  public_signals_fr: string | null;
};

export const columns: ColumnDef<JobRow>[] = [
  {
    accessorKey: 'row_index',
    header: '#',
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue('row_index')}</span>,
  },
  {
    id: 'avatar',
    header: 'Avatar',
    cell: ({ row }) => (
      <Avatar 
        base64Svg={row.original.normalized_json?.avatar} 
        fallbackText={row.original.normalized_json?.nom_complet}
        size="sm"
      />
    ),
  },
  {
    id: 'name',
    accessorFn: (row) => row.normalized_json?.nom_complet || 'N/A',
    header: 'Name',
  },
  {
    id: 'email',
    accessorFn: (row) => row.normalized_json?.email || '-',
    header: 'Email',
  },
  {
    accessorKey: 'final_category',
    header: 'Category',
    cell: ({ row }) => {
      const category = row.getValue('final_category') as string;
      
      let color = 'bg-gray-500';
      if (category === 'CLIENT') color = 'bg-green-500';
      else if (category === 'PRESCRIBER') color = 'bg-blue-500';
      else if (category === 'SUPPLIER') color = 'bg-purple-500';
      else if (category === 'A_QUALIFIER') color = 'bg-yellow-500';

      return (
        <Badge className={color}>
          {category || 'A_QUALIFIER'}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'public_signals_en',
    header: 'Public Signals',
    cell: ({ row }) => (
      <div className="min-w-[300px] whitespace-normal">
        <p className="text-xs text-muted-foreground">
          {row.original.public_signals_en || row.original.public_signals_fr || '-'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'reason_en',
    header: 'Reason',
    cell: ({ row }) => (
      <div className="min-w-[300px] whitespace-normal">
        <p className="text-xs text-muted-foreground">
          {row.original.reason_en || row.original.reason_fr || '-'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'confidence',
    header: 'Confidence',
    cell: ({ row }) => {
      const confidence = row.getValue('confidence') as number;
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${confidence > 80 ? 'bg-green-500' : confidence > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
              style={{ width: `${confidence}%` }} 
            />
          </div>
          <span className="text-xs">{confidence ? `${confidence}%` : '-'}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'classification_method',
    header: 'Method',
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {row.getValue('classification_method')}
      </Badge>
    ),
  },
  {
    accessorKey: 'needs_review',
    header: 'Review',
    cell: ({ row }) => {
      const needsReview = row.getValue('needs_review') as boolean;
      return needsReview ? (
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
      ) : (
        <CheckCircle className="h-4 w-4 text-green-500 opacity-20" />
      );
    },
  },
  {
    accessorKey: 'ai_used',
    header: 'AI',
    cell: ({ row }) => (
      <Badge variant={row.getValue('ai_used') ? 'default' : 'secondary'} className="text-[10px]">
        {row.getValue('ai_used') ? 'YES' : 'NO'}
      </Badge>
    ),
  },
  {
    accessorKey: 'enrichment_status',
    header: 'Enrichment',
    cell: ({ row }) => {
      const status = row.getValue('enrichment_status') as string;
      if (!status) return '-';
      return (
        <Badge variant="outline" className={`text-[10px] ${status === 'FAILED' ? 'text-red-500 border-red-200' : 'text-blue-500 border-blue-200'}`}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'manual_override',
    header: 'Override',
    cell: ({ row }) => (
      <Badge variant={row.getValue('manual_override') ? 'destructive' : 'secondary'} className="text-[10px]">
        {row.getValue('manual_override') ? 'YES' : 'NO'}
      </Badge>
    ),
  },
  {
    accessorKey: 'last_processing_step',
    header: 'Step',
    cell: ({ row }) => (
      <span className="text-[10px] font-mono text-muted-foreground uppercase">
        {row.getValue('last_processing_step') || '-'}
      </span>
    ),
  },
];
