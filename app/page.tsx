'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CSVUploader } from '@/components/upload/csv-uploader';
import { LanguageSwitcher } from '@/components/language-switcher';
import { FileSpreadsheet } from 'lucide-react';

export default function Home() {
  const t = useTranslations('common');
  const router = useRouter();

  const handleUploadSuccess = (jobId: string) => {
    // Redirect to job detail page
    router.push(`/jobs/${jobId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <FileSpreadsheet className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {t('appName')}
            </h1>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              AI-Powered Contact Classification
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your CSV and let our intelligent system classify contacts into CLIENT, PRESCRIBER, or SUPPLIER categories with high accuracy.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 my-12">
            <div className="p-6 rounded-lg bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200 dark:border-slate-800">
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Cost-Optimized AI</h3>
              <p className="text-sm text-muted-foreground">
                Rules-first approach minimizes AI costs while maintaining high accuracy
              </p>
            </div>

            <div className="p-6 rounded-lg bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200 dark:border-slate-800">
              <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Web Enrichment</h3>
              <p className="text-sm text-muted-foreground">
                Compliant web search and data enrichment for better classification
              </p>
            </div>

            <div className="p-6 rounded-lg bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200 dark:border-slate-800">
              <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Manual Editing</h3>
              <p className="text-sm text-muted-foreground">
                Review and edit classifications with full audit trail
              </p>
            </div>
          </div>

          {/* Upload Component */}
          <CSVUploader onUploadSuccess={handleUploadSuccess} />

          {/* Info Section */}
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>Expected CSV format: 25 columns starting with Avatar 128, Nom complet, N° TVA...</p>
            <p>Supports English and French • Real-time progress tracking • Export results</p>
          </div>
        </div>
      </main>
    </div>
  );
}
