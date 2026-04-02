'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  XCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { formatUkuranFile } from '@/lib/utils';
import { DOCUMENT_TYPE_LABEL } from '@/types/enums';

interface ClientDetail {
  id: string;
  full_name: string;
  date_of_birth: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  documents: Array<{
    id: string;
    document_type: string;
    title: string;
    files: Array<{
      id: string;
      original_file_name: string;
      file_size: number;
      uploaded_at: string;
      retention_expires_at: string;
    }>;
    created_at: string;
  }>;
  tokens: Array<{
    id: string;
    prefix: string;
    expires_at: string;
    is_active: boolean;
    failed_attempts: number;
    locked_until: string | null;
    generated_by: { id: string; full_name: string };
    created_at: string;
  }>;
  created_by: { id: string; full_name: string };
  created_at: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);

  useEffect(() => {
    fetchClient();
  }, [params.id]);

  async function fetchClient() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/clients/${params.id}`);
      const data = await res.json();
      if (data.success) setClient(data.data);
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerateToken() {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/clients/${params.id}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in_days: 14 }),
      });
      const data = await res.json();

      if (data.success) {
        setGeneratedUrl(data.data.access_url);
        setShowUrlDialog(true);
        fetchClient(); // Refresh data
      }
    } catch {
      // Silent fail
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRevokeToken(tokenId: string) {
    try {
      await fetch(`/api/clients/${params.id}/tokens/${tokenId}`, {
        method: 'DELETE',
      });
      fetchClient();
    } catch {
      // Silent fail
    }
  }

  if (isLoading || !client) {
    return (
      <>
        <Header title="Detail Client" />
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  const activeToken = client.tokens.find((t) => t.is_active && new Date(t.expires_at) > new Date());

  return (
    <>
      <Header title={client.full_name} />
      <div className="space-y-6 p-6">
        {/* Back button */}
        <Link href="/dashboard/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Daftar Client
          </Button>
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Info Client */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">👤 Informasi Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nama Lengkap</span>
                <span className="font-medium">{client.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tanggal Lahir</span>
                <span>{new Date(client.date_of_birth).toLocaleDateString('id-ID')}</span>
              </div>
              {client.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telepon</span>
                  <span>{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{client.email}</span>
                </div>
              )}
              {client.notes && (
                <div>
                  <span className="text-muted-foreground">Catatan:</span>
                  <p className="mt-1">{client.notes}</p>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-xs text-muted-foreground">
                <span>Dibuat oleh {client.created_by.full_name}</span>
                <span>{new Date(client.created_at).toLocaleDateString('id-ID')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Token */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">🔗 Link Akses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeToken ? (
                <div className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-success text-success-foreground">Aktif</Badge>
                    <span className="text-xs text-muted-foreground">
                      Expired: {new Date(activeToken.expires_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <p className="font-mono text-sm">Prefix: {activeToken.prefix}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tidak ada link aktif untuk client ini.
                </p>
              )}

              <div className="flex gap-2">
                <Button onClick={handleGenerateToken} disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Generate Link Baru
                </Button>
                {activeToken && (
                  <Button
                    variant="destructive"
                    onClick={() => handleRevokeToken(activeToken.id)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Revoke
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dokumen */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              📁 Dokumen ({client.documents.reduce((acc, d) => acc + d.files.length, 0)} file)
            </CardTitle>
            <Link href={`/dashboard/upload?client=${client.id}`}>
              <Button size="sm">📤 Upload</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {client.documents.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Belum ada dokumen untuk client ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Tipe</th>
                      <th className="px-4 py-2 text-left font-medium">Judul</th>
                      <th className="px-4 py-2 text-center font-medium">File</th>
                      <th className="px-4 py-2 text-left font-medium">Upload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.documents.map((doc) => (
                      <tr key={doc.id} className="border-b">
                        <td className="px-4 py-2">
                          <Badge variant="outline">
                            {DOCUMENT_TYPE_LABEL[doc.document_type as keyof typeof DOCUMENT_TYPE_LABEL] ?? doc.document_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">{doc.title}</td>
                        <td className="px-4 py-2 text-center">{doc.files.length}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generated URL Dialog */}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔗 Link Akses Berhasil Dibuat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
              ⚠️ URL ini hanya ditampilkan sekali. Simpan atau kirimkan ke client sekarang.
            </div>
            <div className="flex items-center gap-2">
              <Input value={generatedUrl} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigator.clipboard.writeText(generatedUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
