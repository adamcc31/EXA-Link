'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Search, ChevronLeft, ChevronRight, Eye, ChevronDown, ChevronUp, Clock, CheckCircle2, Download } from 'lucide-react';

interface BatchClient {
  id: string;
  full_name: string;
  date_of_birth: string;
  document_count: number;
  has_opened: boolean;
  has_downloaded: boolean;
  is_active: boolean | null;
}

interface Batch {
  batch_id: string;
  created_at: string;
  agent_name: string;
  total_clients: number;
  clients: BatchClient[];
}

export default function ClientsPage() {
  const [tab, setTab] = useState('batch');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchPage, setBatchPage] = useState(1);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [clientPage, setClientPage] = useState(1);
  const [clientTotal, setClientTotal] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const perPage = 20;

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(clientPage),
        per_page: String(perPage),
        ...(search && { search }),
      });
      const res = await fetch(`/api/clients?${params}`);
      const data = await res.json();
      if (data.success) {
        setClients(data.data);
        setClientTotal(data.meta?.total ?? 0);
      }
    } catch {
      // fail silent
    } finally {
      setIsLoading(false);
    }
  }, [clientPage, search]);

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(batchPage),
        per_page: String(perPage),
      });

      const res = await fetch(`/api/batches?${params}`);
      const data = await res.json();

      if (data.success) {
        setBatches(data.data.data);
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, [batchPage]);

  useEffect(() => {
    if (tab === 'batch') {
      fetchBatches();
    } else {
      fetchClients();
    }
  }, [fetchBatches, fetchClients, tab]);

  const totalClientPages = Math.ceil(clientTotal / perPage);

  function getTokenBadge(token: any) {
    if (!token) return <Badge variant="outline">— Belum</Badge>;
    const expiresAt = new Date(token.expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
    if (expiresAt < now) return <Badge variant="destructive">Expired</Badge>;
    if (daysLeft <= 7) return <Badge className="bg-warning text-warning-foreground">{daysLeft} hari</Badge>;
    return <Badge className="bg-success text-success-foreground">Aktif</Badge>;
  }

  function getClientStatusBadge(client: BatchClient) {
    if (!client.is_active) {
      return <Badge variant="outline">—</Badge>;
    }
    
    if (client.has_downloaded) {
      return <Badge className="bg-success text-success-foreground"><Download className="w-3 h-3 mr-1" /> Diunduh</Badge>;
    } else if (client.has_opened) {
      return <Badge className="bg-primary/20 text-primary"><CheckCircle2 className="w-3 h-3 mr-1" /> Dilihat</Badge>;
    }
    
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Terkirim</Badge>;
  }

  function getManualClientStatusBadge(client: any) {
    if (!client.active_token || !client.active_token.is_active) {
      return <Badge variant="outline">—</Badge>;
    }
    
    if (client.active_token.has_downloaded) {
      return <Badge className="bg-success text-success-foreground"><Download className="w-3 h-3 mr-1" /> Diunduh</Badge>;
    } else if (client.active_token.has_opened) {
      return <Badge className="bg-primary/20 text-primary"><CheckCircle2 className="w-3 h-3 mr-1" /> Dilihat</Badge>;
    }
    
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Terkirim</Badge>;
  }

  const toggleExpand = (id: string) => {
    setExpandedBatchId(expandedBatchId === id ? null : id);
  };

  return (
    <>
      <Header title="Kelola Klien" description="Daftar klien dan riwayat bulk upload" />
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between mb-4">
           <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-auto">
             <button
                onClick={() => setTab('batch')}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${tab === 'batch' ? 'bg-background text-foreground shadow-sm' : ''}`}
             >
               Riwayat Batch Upload
             </button>
             <button
                onClick={() => setTab('all')}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${tab === 'all' ? 'bg-background text-foreground shadow-sm' : ''}`}
             >
               Semua Klien (Manual)
             </button>
           </div>
           
           {tab === 'batch' ? (
             <Link href="/dashboard/upload">
                <Button>Upload Batch Baru</Button>
             </Link>
           ) : (
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
               <DialogTrigger render={<Button type="button" />}>
                 <Plus className="mr-2 h-4 w-4" /> Tambah Klien
               </DialogTrigger>
               <DialogContent>
                 <DialogHeader><DialogTitle>Tambah Klien Baru</DialogTitle></DialogHeader>
                 <ClientForm onSuccess={() => { setIsDialogOpen(false); fetchClients(); }} />
               </DialogContent>
             </Dialog>
           )}
        </div>

        {/* Tab 1: Batch View */}
        {tab === 'batch' && (
          <div className="mt-0">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium w-10"></th>
                        <th className="px-4 py-3 text-left font-medium">Waktu Upload</th>
                        <th className="px-4 py-3 text-left font-medium">Diupload Oleh</th>
                        <th className="px-4 py-3 text-center font-medium">Total Data Klien</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                         <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Memuat data...</td>
                        </tr>
                      ) : batches.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Belum ada riwayat upload.</td>
                        </tr>
                      ) : (
                        batches.map((batch) => (
                          <React.Fragment key={batch.batch_id}>
                            <tr className="border-b transition-colors hover:bg-muted/30 cursor-pointer" onClick={() => toggleExpand(batch.batch_id)}>
                              <td className="px-4 py-3 text-center text-muted-foreground">
                                 {expandedBatchId === batch.batch_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </td>
                              <td className="px-4 py-3 font-medium">
                                {new Date(batch.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{batch.agent_name}</td>
                              <td className="px-4 py-3 text-center font-bold text-primary">{batch.total_clients} Klien</td>
                            </tr>
                            {expandedBatchId === batch.batch_id && (
                              <tr className="bg-muted/10 border-b">
                                <td colSpan={4} className="p-0">
                                  <div className="border-l-4 border-primary pl-4 pr-6 py-4 space-y-3">
                                    {batch.clients && batch.clients.length > 0 ? (
                                      <table className="w-full text-xs">
                                         <thead className="text-left text-muted-foreground mb-2">
                                            <tr className="border-b border-border/50">
                                              <th className="pb-2 font-medium">Nama</th>
                                              <th className="pb-2 font-medium">Tgl Lahir</th>
                                              <th className="pb-2 text-center font-medium">Status</th>
                                              <th className="pb-2 text-center font-medium">Dokumen</th>
                                              <th className="pb-2 text-center font-medium">Token</th>
                                              <th className="pb-2 text-right font-medium">Aksi</th>
                                            </tr>
                                         </thead>
                                         <tbody>
                                         {batch.clients.map(client => (
                                            <tr key={client.id} className="group hover:bg-card/50">
                                                <td className="py-2.5 font-medium">{client.full_name}</td>
                                                <td className="py-2.5 text-muted-foreground">{new Date(client.date_of_birth).toLocaleDateString('id-ID')}</td>
                                                <td className="py-2.5 text-center">{getManualClientStatusBadge(client)}</td>
                                                <td className="py-2.5 text-center">{client.document_count} file</td>
                                                <td className="py-2.5 text-center">{getTokenBadge((client as any).active_token)}</td>
                                                <td className="py-2.5 text-right">
                                                   <Link href={`/dashboard/clients/${client.id}`}>
                                                      <Button variant="ghost" size="sm" className="h-7 text-xs"><Eye className="w-3 h-3 mr-1" /> Detail</Button>
                                                   </Link>
                                                </td>
                                            </tr>
                                         ))}
                                         </tbody>
                                      </table>
                                    ) : (
                                      <p className="text-xs text-muted-foreground text-center py-2">Memuat list klien...</p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="flex items-center justify-between border-t px-4 py-3">
                    <div className="flex gap-1 ml-auto">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setBatchPage((p) => Math.max(1, p - 1))} disabled={batchPage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setBatchPage((p) => p + 1)} disabled={batches.length < perPage}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 2: Flat View */}
        {tab === 'all' && (
          <div className="mt-0">
             <div className="mb-4 relative w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari nama klien..." value={search} onChange={(e) => { setSearch(e.target.value); setClientPage(1); }} className="pl-10" />
            </div>
            
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Nama</th>
                        <th className="px-4 py-3 text-left font-medium">Tgl Lahir</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                        <th className="px-4 py-3 text-center font-medium">Dokumen</th>
                        <th className="px-4 py-3 text-center font-medium">Token</th>
                        <th className="px-4 py-3 text-left font-medium">Dibuat Oleh</th>
                        <th className="px-4 py-3 text-center font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Memuat data...</td></tr>
                      ) : clients.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{search ? 'Tidak ada client yang sesuai pencarian.' : 'Belum ada client terdaftar.'}</td></tr>
                      ) : (
                        clients.map((client) => (
                          <tr key={client.id} className="border-b transition-colors hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium">{client.full_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{new Date(client.date_of_birth).toLocaleDateString('id-ID')}</td>
                            <td className="px-4 py-3 text-center">{getManualClientStatusBadge(client)}</td>
                            <td className="px-4 py-3 text-center">{client.document_count} file</td>
                            <td className="px-4 py-3 text-center">{getTokenBadge(client.active_token)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{client.created_by.full_name}</td>
                            <td className="px-4 py-3 text-center">
                              <Link href={`/dashboard/clients/${client.id}`}>
                                <Button variant="ghost" size="sm"><Eye className="mr-1 h-3.5 w-3.5" /> Detail</Button>
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {totalClientPages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground">Menampilkan {(clientPage - 1) * perPage + 1}–{Math.min(clientPage * perPage, clientTotal)} dari {clientTotal} client</p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setClientPage((p) => Math.max(1, p - 1))} disabled={clientPage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setClientPage((p) => Math.min(totalClientPages, p + 1))} disabled={clientPage === totalClientPages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

/** Form untuk membuat client baru (embedded dalam Dialog). */
function ClientForm({ onSuccess }: { onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const body = {
      full_name: formData.get('full_name') as string,
      date_of_birth: formData.get('date_of_birth') as string,
      phone: (formData.get('phone') as string) || undefined,
      email: (formData.get('email') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    };

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? 'Gagal membuat client.');
        return;
      }
      onSuccess();
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="full_name" className="text-sm font-medium">Nama Lengkap *</label>
        <Input id="full_name" name="full_name" placeholder="Masukkan nama lengkap client" required />
      </div>

      <div className="space-y-2">
        <label htmlFor="date_of_birth" className="text-sm font-medium">Tanggal Lahir *</label>
        <Input id="date_of_birth" name="date_of_birth" type="date" required />
      </div>

      <div className="space-y-2">
        <label htmlFor="phone" className="text-sm font-medium">Nomor Telepon</label>
        <Input id="phone" name="phone" placeholder="+62" />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <Input id="email" name="email" type="email" placeholder="email@contoh.com" />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium">Catatan</label>
        <textarea id="notes" name="notes" rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="(opsional)" />
      </div>

      {error && <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : 'Simpan Client'}
        </Button>
      </div>
    </form>
  );
}
