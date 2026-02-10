'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/client';
import Papa from 'papaparse';

interface CSVUploaderProps {
  onUploadSuccess?: (jobId: string) => void;
}

export function CSVUploader({ onUploadSuccess }: CSVUploaderProps) {
  const t = useTranslations('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10);
    setError(null);

    try {
      const supabase = createClient();

      // Read file content
      const fileContent = await file.text();
      setProgress(30);

      // Parse CSV to validate
      const parsed = Papa.parse(fileContent, { header: true });
      
      if (parsed.errors.length > 0) {
        throw new Error('CSV parsing error: ' + parsed.errors[0].message);
      }

      setProgress(50);

      // Upload file to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('csv-uploads')
        .upload(`temp/${fileName}`, file);

      if (uploadError) {
        throw new Error('Upload failed: ' + uploadError.message);
      }

      setProgress(70);

      // Call parse-csv Edge Function
      const { data: parseData, error: parseError } = await supabase.functions.invoke('parse-csv', {
        body: {
          fileContent,
          filename: file.name,
          userId: 'anonymous', // Replace with actual user ID when auth is implemented
          language: document.cookie.includes('locale=fr') ? 'fr' : 'en',
        },
      });

      if (parseError) {
        throw new Error('Parse failed: ' + parseError.message);
      }

      setProgress(100);

      // Success - call the callback
      if (onUploadSuccess && parseData.jobId) {
        onUploadSuccess(parseData.jobId);
      }

      // Reset
      setTimeout(() => {
        setFile(null);
        setProgress(0);
        setUploading(false);
      }, 1000);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${file ? 'bg-muted/50' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {file ? (
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-12 w-12 text-primary" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t('dragDrop')}</p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{progress < 50 ? t('uploading') : t('validating')}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1"
          >
            {uploading ? t('uploading') : t('title')}
          </Button>
          
          {file && !uploading && (
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setError(null);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
