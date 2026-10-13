import React from 'react';
import { Card } from '../ui/Card';
import { Layers, CheckCircle2, Power, Tag } from 'lucide-react';
import type { SpeciesStats } from '../../services/speciesService';

export interface SpeciesStatsCardsProps {
  stats?: Partial<SpeciesStats> | null;
  speciesList?: any[];
  isLoading?: boolean;
}

export const SpeciesStatsCards: React.FC<SpeciesStatsCardsProps> = ({
  stats,
  speciesList,
}) => {
  const listTotal = Array.isArray(speciesList) ? speciesList.length : 0;
  const listActive = Array.isArray(speciesList)
    ? speciesList.filter(
        (s) =>
          s &&
          (s.is_active === true ||
            s.is_active === 1 ||
            s.is_active === '1' ||
            s.status === 'active')
      ).length
    : 0;
  const listInactive = Math.max(0, listTotal - listActive);
  const listCategories = Array.isArray(speciesList)
    ? new Set(
        speciesList
          .map((s) => (s?.category || s?.sector || '').toLowerCase().trim())
          .filter(Boolean)
      ).size
    : 0;

  // Respaldo dinámico: si stats tiene valores los usamos, o nos sincronizamos reactivamente con la lista
  const total =
    stats?.total_species !== undefined && stats?.total_species !== null
      ? stats.total_species
      : stats?.totalSpecies !== undefined && stats?.totalSpecies !== null
      ? stats.totalSpecies
      : listTotal;

  const active =
    stats?.active_species !== undefined && stats?.active_species !== null
      ? stats.active_species
      : stats?.activeSpecies !== undefined && stats?.activeSpecies !== null
      ? stats.activeSpecies
      : listActive;

  const inactive =
    stats?.inactive_species !== undefined && stats?.inactive_species !== null
      ? stats.inactive_species
      : stats?.inactiveSpecies !== undefined && stats?.inactiveSpecies !== null
      ? stats.inactiveSpecies
      : listTotal > 0
      ? listInactive
      : Math.max(0, Number(total) - Number(active));

  const categories =
    stats?.categories_count !== undefined && stats?.categories_count !== null
      ? stats.categories_count
      : stats?.categoriesCount !== undefined && stats?.categoriesCount !== null
      ? stats.categoriesCount
      : listCategories;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* 1. Total Especies */}
      <Card
        key="stat-card-total-species"
        className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Especies
            </p>
            <h3 className="text-2xl font-black text-[#1E1E1E] dark:text-gray-100 mt-0.5">
              {total}
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Catálogo registrado</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </Card>

      {/* 2. Especies Activas */}
      <Card
        key="stat-card-active-species"
        className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Especies Activas
            </p>
            <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
              {active}
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Disponibles en galpones</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </Card>

      {/* 3. Especies Inactivas */}
      <Card
        key="stat-card-inactive-species"
        className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Inactivas / Pausadas
            </p>
            <h3 className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
              {inactive}
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Fuera de producción</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Power className="w-5 h-5" />
          </div>
        </div>
      </Card>

      {/* 4. Sectores Pecuarios */}
      <Card
        key="stat-card-categories-species"
        className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Sectores Pecuarios
            </p>
            <h3 className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
              {categories}
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Categorías oficiales</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SpeciesStatsCards;
