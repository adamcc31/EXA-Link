'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

interface AuditLog {
  id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  FILE_DOWNLOADED: 'File Diunduh',
  FILE_UPLOADED: 'File Diupload',
  FILE_DELETED: 'File Dihapus',
  CHALLENGE_SUCCESS: 'Verifikasi Berhasil',
  CHALLENGE_FAILED: 'Verifikasi Gagal',
  CHALLENGE_LOCKOUT: 'Lockout',
  LINK_ACCESSED: 'Link Dibuka',
  TOKEN_GENERATED: 'Token Dibuat',
  TOKEN_REVOKED: 'Token Direvoke',
  CLIENT_CREATED: 'Client Dibuat',
  CLIENT_UPDATED: 'Client Diupdate',
  USER_LOGIN: 'Login',
  USER_LOGOUT: 'Logout',
  USER_CREATED: 'User Dibuat',
  DATA_EXPORTED: 'Data Diekspor',
};

const ACTOR_COLORS: Record<string, string> = {
  admin: 'bg-primary',
  agent: 'bg-success',
  client: 'bg-warning',
  system: 'bg-muted-foreground',
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [eventType, setEventType] = useState('');
  const perPage = 50;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        ...(eventType && { event_type: eventType }),
      });
      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setTotal(data.meta?.total ?? 0);
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, [page, eventType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <>
      <Header title="Monitor Aktivitas" description="Audit log sistem" />
      <div className="space-y-4 p-6">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua Event</option>
            {Object.entries(EVENT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Waktu</th>
                    <th className="px-4 py-3 text-left font-medium">Event</th>
                    <th className="px-4 py-3 text-center font-medium">Aktor</th>
                    <th className="px-4 py-3 text-left font-medium">Resource</th>
                    <th className="px-4 py-3 text-left font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Memuat...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Tidak ada data.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {EVENT_LABELS[log.event_type] ?? log.event_type}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {log.actor_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {log.resource_type}
                          {log.resource_id && (
                            <span className="ml-1 font-mono text-muted-foreground">
                              {log.resource_id.substring(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {log.ip_address ?? '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {total} total event
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="flex items-center px-2 text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
