'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';

export default function ExportPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  async function handleExport(type: 'clients' | 'audit-logs' | 'zip') {
    setIsExporting(type);

    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/export/${type}?${params}`);

      if (!res.ok) {
        alert('Gagal mengekspor data.');
        return;
      }

      // Download file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const defaultExt = type === 'zip' ? 'zip' : 'csv';
      a.download =
        res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') ??
        `${type}_export.${defaultExt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Terjadi kesalahan saat mengekspor.');
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <>
      <Header title="Export Data" description="Unduh data sistem dalam format CSV" />
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {/* Filter Tanggal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📅 Filter Tanggal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Dari</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Sampai</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">Export Client</p>
                <p className="text-sm text-muted-foreground">Seluruh data client dalam CSV</p>
              </div>
              <Button
                className="w-full"
                onClick={() => handleExport('clients')}
                disabled={isExporting !== null}
              >
                {isExporting === 'clients' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Unduh CSV
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Download className="h-6 w-6 text-warning" />
              </div>
              <div className="text-center">
                <p className="font-medium">Export Audit Logs</p>
                <p className="text-sm text-muted-foreground">Log aktivitas sistem dalam CSV</p>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handleExport('audit-logs')}
                disabled={isExporting !== null || !dateFrom || !dateTo}
              >
                {isExporting === 'audit-logs' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Unduh CSV
              </Button>
              {(!dateFrom || !dateTo) && (
                <p className="text-xs text-muted-foreground">
                  ⚠️ Tanggal dari & sampai wajib diisi
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Download className="h-6 w-6 text-blue-500" />
              </div>
              <div className="text-center">
                <p className="font-medium">Export Dokumen (.zip)</p>
                <p className="text-sm text-muted-foreground">Arsip dokumen fisikal dalam .zip</p>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handleExport('zip')}
                disabled={isExporting !== null || !dateFrom || !dateTo}
              >
                {isExporting === 'zip' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Unduh ZIP
              </Button>
              {(!dateFrom || !dateTo) && (
                <p className="text-xs text-muted-foreground">
                  ⚠️ Tanggal dari & sampai wajib diisi
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
