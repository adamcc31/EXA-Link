'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Loader2, AlertTriangle, FileImage, Eye } from 'lucide-react';
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
  document_year: string | null;
  files: DocumentFile[];
}

interface DocumentsData {
  client_name: string;
  token_type: string;
  documents: Document[];
}

export default function DocumentsAccessPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [data, setData] = useState<DocumentsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

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

  async function handleFileAction(e: React.MouseEvent, fileId: string, action: 'download' | 'view') {
    e.stopPropagation();
    e.preventDefault();

    const actionKey = `${fileId}:${action}`;

    // Cegah double-click atau klik bersamaan
    if (activeAction) return;

    // PENTING: Buka tab baru SECARA SINKRON di dalam user gesture agar tidak diblokir Safari/iOS.
    // Safari hanya mengizinkan window.open() di dalam synchronous call stack dari klik langsung.
    const newTab = window.open('about:blank', '_blank');
    if (newTab) {
      newTab.document.title = 'Memuat dokumen...';
      newTab.document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:system-ui,-apple-system,sans-serif;color:#555;background:#f8f9fa;">
          <div style="width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:#1d4ed8;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px;"></div>
          <p style="font-size:15px;margin:0;">Memuat dokumen...</p>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        </div>
      `;
    }

    setActiveAction(actionKey);

    try {
      const res = await fetch(`/api/access/${token}/documents/${fileId}/download?action=${action}`);
      const result = await res.json();

      if (result.success) {
        const signedUrl = result.data.download_url;

        if (newTab) {
          // Redirect tab yang sudah terbuka ke signed URL
          newTab.location.href = signedUrl;

          // Untuk aksi download: tab akan kosong setelah file terunduh, tutup otomatis
          if (action === 'download') {
            setTimeout(() => {
              try { newTab.close(); } catch { /* Tab mungkin sudah ditutup user */ }
            }, 3000);
          }
        } else {
          // Fallback jika popup tetap diblokir: gunakan <a> element
          const anchor = document.createElement('a');
          anchor.href = signedUrl;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          if (action === 'download') {
            anchor.setAttribute('download', result.data.file_name || 'document');
          }
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }
      } else {
        if (newTab) newTab.close();
        alert(result.error?.message ?? 'Gagal mengunduh file.');
      }
    } catch {
      if (newTab) newTab.close();
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setActiveAction(null);
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
        ) : data?.token_type === 'gensen' ? (
          /* Gensen 3-Container Layout */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GensenContainer 
              title="Hagaki" 
              docs={data.documents.filter(d => d.document_type === 'hagaki')} 
              onAction={handleFileAction}
              activeAction={activeAction}
            />
            <GensenContainer 
              title="Resi Transfer" 
              docs={data.documents.filter(d => d.document_type === 'resi_transfer')} 
              onAction={handleFileAction}
              activeAction={activeAction}
            />
            <GensenContainer 
              title="Kwitansi" 
              docs={data.documents.filter(d => d.document_type === 'kwitansi')} 
              onAction={handleFileAction}
              activeAction={activeAction}
            />
          </div>
        ) : (
          /* Standard Nenkin Layout */
          (data?.documents ?? []).map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base break-words min-w-0 flex-1">
                    {doc.title.replace(/\s\(\d{4}\)$/, '')}
                  </CardTitle>
                  <Badge variant="outline" className="shrink-0 mt-0.5">
                    {DOCUMENT_TYPE_LABEL[doc.document_type as keyof typeof DOCUMENT_TYPE_LABEL] ?? doc.document_type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {doc.files.map((file) => (
                  <DocumentRow 
                    key={file.id} 
                    file={file} 
                    onAction={handleFileAction} 
                    activeAction={activeAction} 
                  />
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

function GensenContainer({ title, docs, onAction, activeAction }: { 
  title: string; 
  docs: Document[]; 
  onAction: (e: React.MouseEvent, id: string, action: 'download' | 'view') => void;
  activeAction: string | null;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg border-b pb-2 flex items-center justify-between">
        {title}
        <Badge variant="secondary" className="text-[10px] uppercase">{docs.reduce((acc, d) => acc + d.files.length, 0)} File</Badge>
      </h3>
      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Tidak ada dokumen.</p>
      ) : (
        docs.map(doc => (
          <div key={doc.id} className="space-y-2">
            {doc.document_year && (
              <Badge variant="outline" className="bg-primary/5 text-[10px] font-bold">
                Tahun {doc.document_year}
              </Badge>
            )}
            {doc.files.map(file => (
              <DocumentRow 
                key={file.id} 
                file={file} 
                onAction={onAction} 
                activeAction={activeAction}
                isGensen
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function DocumentRow({ file, onAction, activeAction, isGensen = false }: { 
  file: DocumentFile; 
  onAction: (e: React.MouseEvent, id: string, action: 'download' | 'view') => void;
  activeAction: string | null;
  isGensen?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/30 ${isGensen ? 'bg-white shadow-sm' : ''}`}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <FileImage className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium break-all leading-relaxed">{file.original_file_name}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {formatUkuranFile(file.file_size)} • {new Date(file.uploaded_at).toLocaleDateString('id-ID')}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          onClick={(e) => onAction(e, file.id, 'download')}
          disabled={activeAction !== null}
          className="h-8 text-[11px]"
        >
          {activeAction === `${file.id}:download` ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Download className="mr-1 h-3 w-3" />
              Unduh
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => onAction(e, file.id, 'view')}
          disabled={activeAction !== null}
          className="h-8 text-[11px]"
        >
          {activeAction === `${file.id}:view` ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Eye className="mr-1 h-3 w-3" />
              Lihat
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
