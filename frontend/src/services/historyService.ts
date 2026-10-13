import { api, tokenStorage } from './api';

const getAuthHeaders = (): Record<string, string> => {
  const token = tokenStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface ActivityLogUser {
  id: number | string;
  name: string;
  lastname?: string;
  email?: string;
  role?: string;
}

export interface ActivityLogFarm {
  id: number | string;
  name: string;
  code?: string;
}

export interface ActivityLog {
  id: number | string;
  user_id?: number | string | null;
  farm_id?: number | string | null;
  module: string;
  action: string;
  description: string;
  created_at: string;
  updated_at?: string;
  user?: ActivityLogUser | null;
  farm?: ActivityLogFarm | null;
  metadata?: Record<string, any> | null;
}

export interface HistoryFilterParams {
  module?: string;
  action?: string;
  user_id?: number | string;
  date_from?: string;
  date_to?: string;
  search?: string;
  farm_id?: number | string;
  page?: number;
  per_page?: number;
}

export interface HistoryPaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface HistoryStats {
  total_records: number;
  creations: number;
  modifications: number;
  deletions: number;
  creaciones?: number;
  modificaciones?: number;
  eliminaciones?: number;
  total?: number;
  totalRecords?: number;
  creates?: number;
  updates?: number;
  deletes?: number;
  farm_id?: number | null;
}

export interface HistoryResponse {
  logs: ActivityLog[];
  meta: HistoryPaginationMeta;
  stats?: HistoryStats;
}

export const historyService = {
  /**
   * Fetch activity logs with flexible filters, pagination, and fallback endpoints.
   */
  getLogs: async (params: HistoryFilterParams = {}): Promise<HistoryResponse> => {
    // Clean empty string params
    const cleanParams: Record<string, any> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        cleanParams[k] = v;
      }
    });

    let rawData: any = null;

    try {
      // Primary standard endpoint: /history
      const response = await api.get('/history', {
        params: cleanParams,
        headers: getAuthHeaders(),
      });
      rawData = response.data;
    } catch (primaryErr: any) {
      // If 404 or method issue, attempt fallback /admin/history
      if (primaryErr?.response?.status === 404 || primaryErr?.response?.status === 405) {
        try {
          const fallbackRes = await api.get('/admin/history', {
            params: cleanParams,
            headers: getAuthHeaders(),
          });
          rawData = fallbackRes.data;
        } catch (fallbackErr) {
          throw primaryErr;
        }
      } else {
        throw primaryErr;
      }
    }

    // Extract list of logs safely
    let logsList: ActivityLog[] = [];
    if (Array.isArray(rawData)) {
      logsList = rawData;
    } else if (Array.isArray(rawData?.data)) {
      logsList = rawData.data;
    } else if (rawData?.data && Array.isArray(rawData.data.data)) {
      logsList = rawData.data.data;
    } else if (Array.isArray(rawData?.logs)) {
      logsList = rawData.logs;
    } else if (Array.isArray(rawData?.items)) {
      logsList = rawData.items;
    }

    // Extract pagination meta safely
    const metaSource = rawData?.meta || rawData?.pagination || rawData?.data || {};
    const currentPage =
      typeof metaSource.current_page === 'number'
        ? metaSource.current_page
        : typeof rawData?.current_page === 'number'
        ? rawData.current_page
        : params.page || 1;

    const perPage =
      typeof metaSource.per_page === 'number'
        ? metaSource.per_page
        : typeof rawData?.per_page === 'number'
        ? rawData.per_page
        : params.per_page || 20;

    const total =
      typeof metaSource.total === 'number'
        ? metaSource.total
        : typeof rawData?.total === 'number'
        ? rawData.total
        : logsList.length;

    const lastPage =
      typeof metaSource.last_page === 'number'
        ? metaSource.last_page
        : typeof rawData?.last_page === 'number'
        ? rawData.last_page
        : Math.max(1, Math.ceil(total / perPage));

    // Calculate fallback quick counts for actions in returned set
    let fallbackCreates = 0;
    let fallbackUpdates = 0;
    let fallbackDeletes = 0;

    logsList.forEach((log) => {
      const act = String(log?.action || '').toUpperCase();
      if (act.includes('CREAR') || act.includes('CREATE') || act.includes('INSERT') || act.includes('REGISTR')) {
        fallbackCreates++;
      } else if (act.includes('ACTUALIZ') || act.includes('UPDATE') || act.includes('MODIF')) {
        fallbackUpdates++;
      } else if (act.includes('ELIMIN') || act.includes('DELETE') || act.includes('INHABILIT') || act.includes('BAJA')) {
        fallbackDeletes++;
      }
    });

    // Extract official server stats if provided by API (HistoryController@index or @stats)
    const rawStats = rawData?.stats || rawData;
    const totalRecords =
      typeof rawStats?.total_records === 'number'
        ? rawStats.total_records
        : typeof rawStats?.totalRecords === 'number'
        ? rawStats.totalRecords
        : typeof rawStats?.total === 'number'
        ? rawStats.total
        : total;

    const creationsCount =
      typeof rawStats?.creations === 'number'
        ? rawStats.creations
        : typeof rawStats?.creates === 'number'
        ? rawStats.creates
        : fallbackCreates;

    const modificationsCount =
      typeof rawStats?.modifications === 'number'
        ? rawStats.modifications
        : typeof rawStats?.updates === 'number'
        ? rawStats.updates
        : fallbackUpdates;

    const deletionsCount =
      typeof rawStats?.deletions === 'number'
        ? rawStats.deletions
        : typeof rawStats?.deletes === 'number'
        ? rawStats.deletes
        : fallbackDeletes;

    return {
      logs: logsList,
      meta: {
        current_page: currentPage,
        per_page: perPage,
        total: total,
        last_page: lastPage,
      },
      stats: {
        total_records: totalRecords,
        creations: creationsCount,
        modifications: modificationsCount,
        deletions: deletionsCount,
        total: totalRecords,
        totalRecords,
        creates: creationsCount,
        updates: modificationsCount,
        deletes: deletionsCount,
      },
    };
  },

  /**
   * Fetch dedicated history statistics from /history/stats or /admin/history/stats.
   */
  getStats: async (params: { farm_id?: number | string } = {}): Promise<HistoryStats | null> => {
    try {
      const response = await api.get('/history/stats', {
        params,
        headers: getAuthHeaders(),
      });
      const raw = response.data?.data || response.data;
      if (raw) {
        const total = Number(raw.total_records ?? raw.totalRecords ?? raw.total ?? 0);
        const creations = Number(raw.creations ?? raw.creaciones ?? raw.creates ?? 0);
        const modifications = Number(raw.modifications ?? raw.modificaciones ?? raw.updates ?? 0);
        const deletions = Number(raw.deletions ?? raw.eliminaciones ?? raw.deletes ?? 0);
        return {
          total_records: total,
          creations,
          modifications,
          deletions,
          creaciones: creations,
          modificaciones: modifications,
          eliminaciones: deletions,
          total,
          totalRecords: total,
          creates: creations,
          updates: modifications,
          deletes: deletions,
          farm_id: raw.farm_id ?? null,
        };
      }
      return null;
    } catch {
      try {
        const fallback = await api.get('/admin/history/stats', {
          params,
          headers: getAuthHeaders(),
        });
        const raw = fallback.data?.data || fallback.data;
        if (raw) {
          const total = Number(raw.total_records ?? raw.totalRecords ?? raw.total ?? 0);
          const creations = Number(raw.creations ?? raw.creaciones ?? raw.creates ?? 0);
          const modifications = Number(raw.modifications ?? raw.modificaciones ?? raw.updates ?? 0);
          const deletions = Number(raw.deletions ?? raw.eliminaciones ?? raw.deletes ?? 0);
          return {
            total_records: total,
            creations,
            modifications,
            deletions,
            creaciones: creations,
            modificaciones: modifications,
            eliminaciones: deletions,
            total,
            totalRecords: total,
            creates: creations,
            updates: modifications,
            deletes: deletions,
            farm_id: raw.farm_id ?? null,
          };
        }
        return null;
      } catch {
        return null;
      }
    }
  },

  /**
   * Fetch single activity log detail by ID.
   */
  getLogById: async (id: number | string): Promise<ActivityLog | null> => {
    try {
      const response = await api.get(`/history/${id}`, {
        headers: getAuthHeaders(),
      });
      return response.data?.data || response.data || null;
    } catch {
      try {
        const fallback = await api.get(`/admin/history/${id}`, {
          headers: getAuthHeaders(),
        });
        return fallback.data?.data || fallback.data || null;
      } catch {
        return null;
      }
    }
  },
};
