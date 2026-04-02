'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Loader2, AlertTriangle, FileImage } from 'lucide-react';
import { formatUkuranFile } from '@/lib/utils';
import { DOCUMENT_TYPE_LABEL } from '@/types/enums';

interface DocumentFile {
  id: string;
  original_file_name: string;
  file_size: number;
  uploaded_at: string;
}

interface Document {
  id: string;
  document_type: string;
  title: string;
  files: DocumentFile[];
}

interface DocumentsData {
  client_name: string;
  documents: Document[];
}

export default function DocumentsAccessPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [data, setData] = useState<DocumentsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [token]);

  async function fetchDocuments() {
    try {
      const res = await fetch(`/api/access/${token}/documents`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
      } else {
        setUnauthorized(true);
      }
    } catch {
      setUnauthorized(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownload(fileId: string, fileName: string) {
    setDownloadingId(fileId);

    try {
      const res = await fetch(`/api/access/${token}/documents/${fileId}/download`);
      const result = await res.json();

      if (result.success) {
        // Redirect ke signed URL
        window.open(result.data.download_url, '_blank');
      } else {
        alert(result.error?.message ?? 'Gagal mengunduh file.');
      }
    } catch {
      alert('Terjadi kesalahan.');
    } finally {
      setDownloadingId(null);
    }
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Unauthorized — redirect ke challenge
  if (unauthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="space-y-4 py-10 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
            <h2 className="text-xl font-bold">Sesi Berakhir</h2>
            <p className="text-sm text-muted-foreground">
              Sesi Anda telah berakhir. Silakan verifikasi ulang identitas Anda.
            </p>
            <Button onClick={() => router.push(`/access/${token}`)}>
              Verifikasi Ulang
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalFiles = (data?.documents ?? []).reduce(
    (acc, doc) => acc + doc.files.length,
    0,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <FileText className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Dokumen Anda</h1>
          <p className="mt-1 text-muted-foreground">
            Selamat datang, <span className="font-semibold text-foreground">{data?.client_name}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {totalFiles} file tersedia untuk diunduh
          </p>
        </div>

        {/* Document Cards */}
        {(data?.documents ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">Belum ada dokumen yang tersedia.</p>
            </CardContent>
          </Card>
        ) : (
          (data?.documents ?? []).map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{doc.title}</CardTitle>
                  <Badge variant="outline">
                    {DOCUMENT_TYPE_LABEL[doc.document_type as keyof typeof DOCUMENT_TYPE_LABEL] ?? doc.document_type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {doc.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <FileImage className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{file.original_file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatUkuranFile(file.file_size)} • {new Date(file.uploaded_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleDownload(file.id, file.original_file_name)}
                      disabled={downloadingId === file.id}
                    >
                      {downloadingId === file.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="mr-1 h-3.5 w-3.5" />
                          Unduh
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}

        <p className="text-center text-xs text-muted-foreground">
          © 2026 EXATA — File dapat diunduh selama link masih berlaku
        </p>
      </div>
    </div>
  );
}
