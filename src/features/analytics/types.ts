/**
 * Types untuk feature Analytics.
 * Akan dipopulasi di Fase 4 saat implementasi dashboard.
 */

export interface DashboardSummary {
  total_clients: number;
  new_clients: number;
  total_files_uploaded: number;
  total_link_accesses: number;
  total_downloads: number;
  storage_used_bytes: number;
  active_tokens: number;
  expired_tokens: number;
}

export interface TrendDataPoint {
  date: string;
  count: number;
}

export interface DashboardTrends {
  clients_by_day: TrendDataPoint[];
  uploads_by_day: TrendDataPoint[];
  accesses_by_day: TrendDataPoint[];
}

export interface AgentStats {
  agent: {
    id: string;
    full_name: string;
  };
  stats: {
    clients_created: number;
    files_uploaded: number;
    tokens_generated: number;
    last_active_at: string;
  };
}
