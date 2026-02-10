'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JobRow } from './columns';
import { 
  Building2, 
  Mail, 
  MapPin, 
  Search, 
  Brain, 
  Info, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink,
  History
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface RowDetailDrawerProps {
  row: JobRow | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RowDetailDrawer({ row, isOpen, onClose }: RowDetailDrawerProps) {
  const t = useTranslations('jobDetail');
  
  if (!row) return null;

  const getCategoryColor = (category: string | null) => {
    if (category === 'CLIENT') return 'bg-green-500 text-white';
    if (category === 'PRESCRIBER') return 'bg-blue-500 text-white';
    if (category === 'SUPPLIER') return 'bg-purple-500 text-white';
    if (category === 'A_QUALIFIER') return 'bg-yellow-500 text-slate-900';
    return 'bg-gray-500 text-white';
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return 'text-slate-400';
    if (confidence > 80) return 'text-green-600';
    if (confidence > 50) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} direction="right">
      <DrawerContent className="h-full mt-0 rounded-none border-l shadow-2xl overflow-y-auto">
        <DrawerHeader className="border-b bg-slate-50/50 pb-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <DrawerTitle className="text-2xl font-bold tracking-tight text-slate-900">
                {row.normalized_json?.nom_complet || 'Unnamed Contact'}
              </DrawerTitle>
              <DrawerDescription className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider bg-slate-200 px-1.5 py-0.5 rounded">Row #{row.row_index}</span>
                <span>•</span>
                <span className="text-slate-500">ID: {row.id.substring(0, 8)}</span>
              </DrawerDescription>
            </div>
            <Badge className={`${getCategoryColor(row.final_category)} px-3 py-1 text-sm font-semibold`}>
              {row.final_category || 'A_QUALIFIER'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="flex flex-col p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confidence</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${getConfidenceColor(row.confidence)}`}>
                  {row.confidence ? `${row.confidence}%` : 'N/A'}
                </span>
                <span className="text-xs text-slate-400">match</span>
              </div>
            </div>
            <div className="flex flex-col p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Method</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{row.classification_method || 'PENDING'}</span>
                {row.ai_used && <Brain className="h-3.5 w-3.5 text-indigo-500" />}
              </div>
            </div>
          </div>
        </DrawerHeader>

        <div className="p-6 space-y-8">
          {/* Contact Info Section */}
          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
              <Info className="h-4 w-4 text-slate-400" />
              Contact Information
            </h4>
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-700 truncate">{row.normalized_json?.email || 'No email provided'}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-700 truncate">
                  {[row.normalized_json?.ville, row.normalized_json?.pays].filter(Boolean).join(', ') || 'No location information'}
                </span>
              </div>
              {row.normalized_json?.activites && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <Building2 className="h-4 w-4 text-slate-400 mt-0.5" />
                  <span className="text-sm text-slate-700">{row.normalized_json.activites}</span>
                </div>
              )}
            </div>
          </section>

          {/* Reasoning Section */}
          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
              <Brain className="h-4 w-4 text-slate-400" />
              Classification reasoning
            </h4>
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 relative">
              <div className="absolute top-4 right-4 opacity-10">
                <Brain className="h-12 w-12 text-indigo-900" />
              </div>
              <p className="text-sm text-indigo-900 font-medium leading-relaxed italic">
                "{row.reason_en || row.reason_fr || 'No reasoning provided yet.'}"
              </p>
            </div>
          </section>

          {/* Enrichment Evidence Section */}
          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
              <Search className="h-4 w-4 text-slate-400" />
              Web Enrichment Signals
            </h4>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-500">Signal Summary</span>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter">
                  Status: {row.enrichment_status || 'NONE'}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-mono bg-white p-3 rounded border border-slate-100 mb-4">
                {row.public_signals_en || row.public_signals_fr || 'No public signals captured.'}
              </p>
              
              {row.enrichment_status === 'DONE' && (
                <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold cursor-not-allowed opacity-50">
                  <ExternalLink className="h-3 w-3" />
                  View Original Sources (Coming soon)
                </div>
              )}
            </div>
          </section>

          {/* Technical Info Section */}
          <section className="space-y-4 pb-10">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
              <History className="h-4 w-4 text-slate-400" />
              Technical Metadata
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">Last Step</span>
                <span className="font-mono bg-slate-100 px-2 py-1 rounded truncate">{row.last_processing_step || '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">Needs Review</span>
                <span className={`font-semibold ${row.needs_review ? 'text-amber-600' : 'text-emerald-600'} flex items-center gap-1`}>
                  {row.needs_review ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                  {row.needs_review ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">Manual Override</span>
                <span className={`font-semibold ${row.manual_override ? 'text-red-600' : 'text-slate-600'}`}>
                  {row.manual_override ? 'ACTIVE' : 'NONE'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">Enriched</span>
                <span className="text-slate-700 font-semibold">{row.enrichment_status === 'DONE' ? 'SUCCESSFUL' : 'NONE'}</span>
              </div>
            </div>
          </section>
        </div>

        <DrawerFooter className="border-t bg-slate-50 p-6">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close Detail
            </Button>
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 shadow-md">
              Apply Manual Override
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
