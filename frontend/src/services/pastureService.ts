import { api, tokenStorage } from './api';
import type {
  PastureBiomassSurvey,
  CreatePastureBiomassSurveyDTO,
  PastureTreatment,
  CreatePastureTreatmentDTO,
  PotreroManagement,
} from '../types/auth';

const getAuthHeaders = (): Record<string, string> => {
  const token = tokenStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Fase 2 del módulo Potreros: manejo agronómico (tratamientos y aforo de
 * forraje) y métricas de rotación derivadas.
 */
export const pastureService = {
  /**
   * Ficha de manejo: métricas derivadas + historiales.
   */
  getManagement: async (potreroId: number | string): Promise<PotreroManagement> => {
    const response = await api.get(`/potreros/${potreroId}/management`, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  /* ----------------------------- Tratamientos ----------------------------- */

  getTreatments: async (potreroId: number | string): Promise<PastureTreatment[]> => {
    const response = await api.get(`/potreros/${potreroId}/treatments`, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data || [];
  },

  createTreatment: async (
    potreroId: number | string,
    data: CreatePastureTreatmentDTO
  ): Promise<PastureTreatment> => {
    const response = await api.post(`/potreros/${potreroId}/treatments`, data, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  updateTreatment: async (
    potreroId: number | string,
    treatmentId: number | string,
    data: Partial<CreatePastureTreatmentDTO>
  ): Promise<PastureTreatment> => {
    const response = await api.put(`/potreros/${potreroId}/treatments/${treatmentId}`, data, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  deleteTreatment: async (potreroId: number | string, treatmentId: number | string): Promise<void> => {
    await api.delete(`/potreros/${potreroId}/treatments/${treatmentId}`, {
      headers: getAuthHeaders(),
    });
  },

  /* -------------------------------- Aforos -------------------------------- */

  getBiomassSurveys: async (potreroId: number | string): Promise<PastureBiomassSurvey[]> => {
    const response = await api.get(`/potreros/${potreroId}/biomass-surveys`, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data || [];
  },

  createBiomassSurvey: async (
    potreroId: number | string,
    data: CreatePastureBiomassSurveyDTO
  ): Promise<PastureBiomassSurvey> => {
    const response = await api.post(`/potreros/${potreroId}/biomass-surveys`, data, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  updateBiomassSurvey: async (
    potreroId: number | string,
    surveyId: number | string,
    data: Partial<CreatePastureBiomassSurveyDTO>
  ): Promise<PastureBiomassSurvey> => {
    const response = await api.put(`/potreros/${potreroId}/biomass-surveys/${surveyId}`, data, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  deleteBiomassSurvey: async (potreroId: number | string, surveyId: number | string): Promise<void> => {
    await api.delete(`/potreros/${potreroId}/biomass-surveys/${surveyId}`, {
      headers: getAuthHeaders(),
    });
  },
};
