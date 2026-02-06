import { create } from 'zustand';
import type { ServerSummary, ActiveAlert, DashboardSummary, ServerStatus } from '../types';

interface DashboardState {
  servers: Map<number, ServerSummary>;
  alerts: ActiveAlert[];
  summary: DashboardSummary | null;

  updateServerMetrics: (serverId: number, data: {
    cpu_usage_pct?: number;
    mem_usage_pct?: number;
    disk_max_pct?: number;
    status?: ServerStatus;
  }) => void;

  setServers: (servers: ServerSummary[]) => void;
  setSummary: (summary: DashboardSummary) => void;
  addAlert: (alert: ActiveAlert) => void;
  removeAlert: (alertId: number) => void;
  setAlerts: (alerts: ActiveAlert[]) => void;
  acknowledgeAlert: (alertId: number) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  servers: new Map(),
  alerts: [],
  summary: null,

  updateServerMetrics: (serverId, data) =>
    set((state) => {
      const newServers = new Map(state.servers);
      const existing = newServers.get(serverId);
      if (existing) {
        newServers.set(serverId, {
          ...existing,
          cpu_usage_pct: data.cpu_usage_pct ?? existing.cpu_usage_pct,
          mem_usage_pct: data.mem_usage_pct ?? existing.mem_usage_pct,
          disk_max_pct: data.disk_max_pct ?? existing.disk_max_pct,
          status: data.status ?? existing.status,
        });
      }
      return { servers: newServers };
    }),

  setServers: (servers) =>
    set(() => {
      const map = new Map<number, ServerSummary>();
      servers.forEach((s) => map.set(s.server_id, s));
      return { servers: map };
    }),

  setSummary: (summary) => set({ summary }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 100),
    })),

  removeAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.alert_id !== alertId),
    })),

  setAlerts: (alerts) => set({ alerts }),

  acknowledgeAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.alert_id === alertId ? { ...a, acknowledged: true } : a
      ),
    })),
}));
