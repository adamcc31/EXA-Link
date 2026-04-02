import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Link2, Download } from 'lucide-react';

/**
 * Dashboard Overview — Halaman utama setelah login.
 * Server Component: data di-fetch langsung di server.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const supabaseAdmin = await createAdminClient();

  // Ambil statistik
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [clientsRes, newClientsRes, filesRes, downloadsRes, recentLogsRes] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString()),
    supabase
      .from('document_files')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'FILE_DOWNLOADED')
      .gte('created_at', startOfMonth.toISOString()),
    supabaseAdmin
      .from('audit_logs')
      .select('event_type, actor_type, actor_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const recentLogs = recentLogsRes.data ?? [];

  // Extract unique Agent and Client IDs
  const agentIds = Array.from(new Set(recentLogs.filter((l) => ['agent', 'admin'].includes(l.actor_type) && l.actor_id).map(l => l.actor_id as string)));
  const clientIds = Array.from(new Set(recentLogs.filter((l) => l.actor_type === 'client' && l.metadata && (l.metadata as any).client_id).map(l => (l.metadata as any).client_id as string)));

  const [agentsFetch, clientsFetch] = await Promise.all([
     agentIds.length > 0 ? supabaseAdmin.from('users').select('id, full_name').in('id', agentIds) : Promise.resolve({ data: [] }),
     clientIds.length > 0 ? supabaseAdmin.from('clients').select('id, full_name').in('id', clientIds) : Promise.resolve({ data: [] })
  ]);

  const agentMap = new Map((agentsFetch.data || []).map(a => [a.id, a.full_name]));
  const clientMap = new Map((clientsFetch.data || []).map(c => [c.id, c.full_name]));

  const formatLogItem = (log: any) => {
     const meta = log.metadata || {};
     const timeStr = new Date(log.created_at).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
     });

     let actorName = 'Sistem';
     let actorLabel = 'Klien';
     
     if (log.actor_type === 'client') {
       actorName = clientMap.get(meta.client_id) || 'Klien (No Name)';
       actorLabel = 'User';
     } else if (['agent', 'admin'].includes(log.actor_type)) {
       actorName = agentMap.get(log.actor_id) || 'Agen';
       actorLabel = log.actor_type === 'admin' ? 'Admin' : 'Agent';
     }

     switch(log.event_type) {
        case 'CHALLENGE_SUCCESS':
          return <p><span className="font-semibold">{actorLabel} ({actorName})</span> berhasil memverifikasi akses.</p>;
        case 'FILE_DOWNLOADED':
          return <p><span className="font-semibold">{actorLabel} ({actorName})</span> mengunduh file <span className="font-medium">{(meta.file_name ?? 'Dokumen')}</span>.</p>;
        case 'BATCH_UPLOAD_STARTED':
          return <p><span className="font-semibold">{actorLabel} ({actorName})</span> memulai bulk upload batch untuk <span className="font-medium">{meta.total_clients ?? 0} Klien</span>.</p>;
        case 'CLIENT_CREATED':
          return <p><span className="font-semibold">{actorLabel} ({actorName})</span> menambahkan data Klien baru.</p>;
        case 'TOKEN_GENERATED':
          return <p>Akses link untuk <span className="font-semibold">Klien baru</span> telah di-generate oleh <span className="font-semibold">{actorName}</span>.</p>;
        default:
          return <p><span className="font-semibold">{actorLabel} ({actorName})</span> melakukan {log.event_type}.</p>;
     }
  };

  const stats = [
    {
      label: 'Total Client',
      value: clientsRes.count ?? 0,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Client Baru (Bulan Ini)',
      value: newClientsRes.count ?? 0,
      icon: Users,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'File Aktif',
      value: filesRes.count ?? 0,
      icon: FileText,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Download (Bulan Ini)',
      value: downloadsRes.count ?? 0,
      icon: Download,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];



  return (
    <>
      <Header title="Dashboard" description="Ringkasan aktivitas sistem" />
      <div className="space-y-6 p-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value.toLocaleString('id-ID')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Aktivitas Terbaru */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🔔 Aktivitas Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Belum ada aktivitas tercatat.
              </p>
            ) : (
              <div className="space-y-3">
               {recentLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="text-muted-foreground">
                      {formatLogItem(log)}
                    </div>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
