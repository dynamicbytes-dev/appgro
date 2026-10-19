import { api, tokenStorage } from './api';
import type {
  AnalyticsFinancial,
  AnalyticsOperations,
  AnalyticsStaff,
  AnalyticsSummary,
} from '../types/analytics';

const getAuthHeaders = (): Record<string, string> => {
  const token = tokenStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Normaliza el `farm_id` (acepta 'all'/vacío/número/string). */
const normalizeFarmId = (
  farmId?: number | string
): number | string | undefined => {
  if (farmId === undefined || farmId === null || farmId === '') return undefined;
  const str = String(farmId).toLowerCase();
  if (str === 'all') return undefined;
  return Number.isInteger(Number(farmId)) ? Number(farmId) : farmId;
};

const buildParams = (farmId?: number | string): Record<string, number | string> => {
  const params: Record<string, number | string> = {};
  const normalized = normalizeFarmId(farmId);
  if (normalized !== undefined) params.farm_id = normalized;
  return params;
};

/**
 * Servicio del módulo Analítica y Reportes.
 *
 * Los cuatro endpoints viven bajo `/analytics` (alias `/analitica`) y
 * consolidan los indicadores de Lotes, Galpones, Inventario y
 * Actividades en el backend.
 */
export const analyticsService = {
  getSummary: async (farmId?: number | string): Promise<AnalyticsSummary> => {
    const response = await api.get('/analytics/summary', {
      params: buildParams(farmId),
      headers: getAuthHeaders(),
    });
    return response.data?.data;
  },

  getFinancial: async (farmId?: number | string): Promise<AnalyticsFinancial> => {
    const response = await api.get('/analytics/financial', {
      params: buildParams(farmId),
      headers: getAuthHeaders(),
    });
    return response.data?.data;
  },

  getOperations: async (farmId?: number | string): Promise<AnalyticsOperations> => {
    const response = await api.get('/analytics/operations', {
      params: buildParams(farmId),
      headers: getAuthHeaders(),
    });
    return response.data?.data;
  },

  getStaff: async (farmId?: number | string): Promise<AnalyticsStaff> => {
    const response = await api.get('/analytics/staff', {
      params: buildParams(farmId),
      headers: getAuthHeaders(),
    });
    return response.data?.data;
  },

  /**
   * Reporte ejecutivo de KPIs (misma fuente real que alimenta el PDF) para un módulo.
   * GET /reports/{module}/executive-kpis
   */
  getExecutiveKpis: async (
    module: string,
    farmId?: number | string
  ): Promise<any> => {
    const response = await api.get(`/reports/${module}/executive-kpis`, {
      params: buildParams(farmId),
      headers: getAuthHeaders(),
    });
    return response.data;
  },
};

export default analyticsService;
