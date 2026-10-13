import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { historyService, type ActivityLog, type HistoryPaginationMeta, type HistoryStats } from '../services/historyService';
import { farmService } from '../services/farmService';
import type { Farm } from '../types/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { safeText } from '../utils/safeText';
import {
  History,
  Search,
  RotateCcw,
  RefreshCw,
  Clock,
  Layers,
  Warehouse,
  Boxes,
  ClipboardList,
  BarChart3,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Eye,
  Activity,
  PlusCircle,
  FileEdit,
  Trash2,
  AlertCircle,
} from 'lucide-react';

export const HistoryView: React.FC = () => {
  const { user, activeFarm, farms } = useAuth();
  const { toastError } = useToast();

  const roleUpper = (user?.role || '').toUpperCase();
  const isRoot = roleUpper === 'ROOT';

  // Specific Farm scope determination for Admin / Subordinate
  const userFarmId =
    activeFarm?.id ??
    user?.farm?.id ??
    user?.farm_id ??
    user?.farmId ??
    null;

  const userFarmName =
    activeFarm?.name ??
    user?.farm?.name ??
    user?.farm_name ??
    user?.farmName ??
    'Mi Granja';

  // Root-only farm selector states
  const [availableFarms, setAvailableFarms] = useState<Farm[]>([]);
  const [rootFarmFilter, setRootFarmFilter] = useState<string>('all');

  // Load farms list for Root users if needed
  useEffect(() => {
    if (isRoot) {
      if (Array.isArray(farms) && farms.length > 0) {
        setAvailableFarms(farms);
      } else {
        farmService
          .getFarmsSelect()
          .then((list) => {
            if (Array.isArray(list) && list.length > 0) {
              setAvailableFarms(list);
            }
          })
          .catch((err) => {
            console.warn('Could not fetch farms for Root history filter:', err);
          });
      }
    }
  }, [isRoot, farms]);

  // Data states
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<HistoryPaginationMeta>({
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  });
  const [stats, setStats] = useState<HistoryStats>({
    total_records: 0,
    creations: 0,
    modificaciones: 0,
    creaciones: 0,
    eliminaciones: 0,
    modifications: 0,
    deletions: 0,
    total: 0,
    creates: 0,
    updates: 0,
    deletes: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch logs and stats from backend
  const fetchLogs = useCallback(
    async (pageToLoad: number = 1, showRefreshSpinner: boolean = false) => {
      if (showRefreshSpinner) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const farmIdToQuery = isRoot
          ? (rootFarmFilter !== 'all' ? rootFarmFilter : undefined)
          : (userFarmId ?? undefined);

        // 1. Petición concurrente a logs y al endpoint de estadísticas (/history/stats)
        const [response, dedicatedStats] = await Promise.all([
          historyService.getLogs({
            page: pageToLoad,
            per_page: 15,
            search: searchTerm.trim() || undefined,
            module: moduleFilter !== 'all' ? moduleFilter : undefined,
            action: actionFilter !== 'all' ? actionFilter : undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            farm_id: farmIdToQuery,
          }),
          historyService.getStats({ farm_id: farmIdToQuery }).catch((err) => {
            console.warn('Endpoint /history/stats no respondió, usando datos de respaldo:', err);
            return null;
          }),
        ]);

        // Defensive protection against undefined/null arrays
        const safeLogs = Array.isArray(response?.logs) ? response.logs : [];
        setLogs(safeLogs);

        if (response?.meta) {
          setPagination(response.meta);
        }

        // 2. Mapeo prioritario de estadísticas del endpoint dedicado o metadatos de respuesta
        if (dedicatedStats) {
          setStats(dedicatedStats);
        } else if (response?.stats) {
          setStats({
            ...response.stats,
            creaciones: response.stats.creaciones ?? response.stats.creations,
            modificaciones: response.stats.modificaciones ?? response.stats.modifications,
            eliminaciones: response.stats.eliminaciones ?? response.stats.deletions,
          });
        } else {
          // Compute fallback stats from returned logs and pagination
          let c = 0;
          let u = 0;
          let d = 0;
          safeLogs.forEach((l) => {
            const act = String(l?.action || '').toUpperCase();
            if (act.includes('CREA') || act.includes('REGIST')) c++;
            else if (act.includes('ACTUALIZ') || act.includes('MODIF')) u++;
            else if (act.includes('ELIMIN') || act.includes('BAJA') || act.includes('INHABILIT')) d++;
          });
          const totalVal = response?.meta?.total ?? safeLogs.length;
          setStats({
            total_records: totalVal,
            creations: c,
            creaciones: c,
            modifications: u,
            modificaciones: u,
            deletions: d,
            eliminaciones: d,
            total: totalVal,
            creates: c,
            updates: u,
            deletes: d,
          });
        }
      } catch (err: any) {
        console.error('Error al cargar historial de actividades:', err);
        const msg =
          err?.response?.data?.message ||
          'No se pudo cargar el historial de actividades. Por favor, reintente.';
        setErrorMessage(msg);
        toastError('Error al Cargar Historial', msg);
        setLogs([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [searchTerm, moduleFilter, actionFilter, dateFrom, dateTo, isRoot, rootFarmFilter, userFarmId, toastError]
  );

  // Initial and reactive fetch on page / filter changes
  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage, moduleFilter, actionFilter, dateFrom, dateTo, rootFarmFilter, fetchLogs]);

  // Handle Search submit / enter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLogs(1);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setModuleFilter('all');
    setActionFilter('all');
    setDateFrom('');
    setDateTo('');
    if (isRoot) {
      setRootFarmFilter('all');
    }
    setCurrentPage(1);
  };

  // Format date helper
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Get action Badge styling
  const renderActionBadge = (actionName?: string) => {
    const act = String(actionName || '').toUpperCase();

    if (act.includes('CREAR') || act.includes('REGISTR') || act.includes('INSERT')) {
      return (
        <Badge
          variant="success"
          icon={<PlusCircle className="w-3 h-3 text-[#4E9F3D]" />}
          className="font-bold tracking-wide"
        >
          {safeText(act, 'CREAR')}
        </Badge>
      );
    }
    if (act.includes('ACTUALIZ') || act.includes('MODIF') || act.includes('EDIT')) {
      return (
        <Badge
          variant="info"
          icon={<FileEdit className="w-3 h-3 text-blue-600" />}
          className="font-bold tracking-wide"
        >
          {safeText(act, 'ACTUALIZAR')}
        </Badge>
      );
    }
    if (act.includes('ELIMIN') || act.includes('DELETE') || act.includes('BAJA') || act.includes('INHABILIT')) {
      return (
        <Badge
          variant="danger"
          icon={<Trash2 className="w-3 h-3 text-red-600" />}
          className="font-bold tracking-wide"
        >
          {safeText(act, 'ELIMINAR')}
        </Badge>
      );
    }

    return (
      <Badge
        variant="primary"
        icon={<Activity className="w-3 h-3 text-[#1B4D3E]" />}
        className="font-bold tracking-wide"
      >
        {safeText(act, 'ACCIÓN')}
      </Badge>
    );
  };

  // Get module icon
  const getModuleIcon = (modName?: string) => {
    const m = String(modName || '').toLowerCase();
    if (m.includes('especie')) return <Layers className="w-3.5 h-3.5 text-[#4E9F3D]" />;
    if (m.includes('galpon')) return <Warehouse className="w-3.5 h-3.5 text-[#4E9F3D]" />;
    if (m.includes('lote')) return <Boxes className="w-3.5 h-3.5 text-[#4E9F3D]" />;
    if (m.includes('activid')) return <ClipboardList className="w-3.5 h-3.5 text-[#4E9F3D]" />;
    if (m.includes('analit')) return <BarChart3 className="w-3.5 h-3.5 text-[#4E9F3D]" />;
    if (m.includes('usuari') || m.includes('admin') || m.includes('encargad'))
      return <Users className="w-3.5 h-3.5 text-blue-500" />;
    if (m.includes('granj') || m.includes('farm'))
      return <Building2 className="w-3.5 h-3.5 text-amber-500" />;
    return <History className="w-3.5 h-3.5 text-[#1B4D3E] dark:text-[#4E9F3D]" />;
  };

  // Get Role badge
  const renderRoleBadge = (roleName?: string) => {
    const r = String(roleName || '').toUpperCase();
    if (r === 'ROOT') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
          ROOT GLOBAL
        </span>
      );
    }
    if (r === 'ADMIN') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B4D3E]/10 text-[#1B4D3E] dark:text-[#4E9F3D] border border-[#1B4D3E]/30">
          ADMIN GRANJA
        </span>
      );
    }
    if (r === 'SUBORDINATE' || r === 'ENCARGADO') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30">
          ENCARGADO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-[#263632] dark:text-gray-300">
        {safeText(roleName, 'SISTEMA')}
      </span>
    );
  };

  const headerBadgeText = isRoot
    ? 'Consola Global del Sistema'
    : `Auditoría de Granja: ${userFarmName}`;

  const headerTitle = isRoot
    ? 'Historial de Actividades y Auditoría Global'
    : `Historial de Actividades - ${userFarmName}`;

  const headerSubtitle = isRoot
    ? 'Supervisión centralizada, auditoría y trazabilidad cronológica de cambios en todas las granjas del sistema.'
    : `Registro cronológico y trazabilidad de eventos y operaciones realizadas exclusivamente en tu granja (${userFarmName}).`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Descriptive Header Bar with Role Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#18221F] p-6 rounded-2xl border border-gray-200 dark:border-[#263632] shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                isRoot
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  : 'bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] border-[#1B4D3E]/20 dark:border-[#4E9F3D]/30'
              }`}
            >
              {isRoot ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <Building2 className="w-3.5 h-3.5" />
              )}
              <span>{safeText(headerBadgeText)}</span>
            </span>

            {!isRoot && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-[#263632] text-gray-600 dark:text-gray-300 text-[10px] font-semibold border border-gray-200 dark:border-gray-700">
                Ámbito: Granja Propia
              </span>
            )}
          </div>

          <h1 className="text-xl font-black text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2">
            <History className="w-6 h-6 text-[#1B4D3E] dark:text-[#4E9F3D]" />
            {safeText(headerTitle)}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {safeText(headerSubtitle)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(currentPage, true)}
            disabled={isRefreshing || isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Actualizar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Limpiar Filtros
          </Button>
        </div>
      </div>

      {/* 2. Quick Summary Stats Cards (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Records */}
        <Card key="history-stat-total" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total Registros
              </p>
              <h3 className="text-2xl font-black text-[#1E1E1E] dark:text-gray-100 mt-0.5">
                {stats?.total_records || 0}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Eventos auditados</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Creaciones */}
        <Card key="history-stat-creations" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Creaciones
              </p>
              <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                {stats?.creations || 0}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Registros nuevos</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Actualizaciones / Modificaciones */}
        <Card key="history-stat-modifications" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Modificaciones
              </p>
              <h3 className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                {stats?.modifications || 0}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Cambios de estado/datos</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileEdit className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Eliminaciones */}
        <Card key="history-stat-deletions" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Eliminaciones
              </p>
              <h3 className="text-2xl font-black text-red-700 dark:text-red-300 mt-0.5">
                {stats?.deletions || 0}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Bajas y deshabilitaciones</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{safeText(errorMessage)}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-xs text-red-600">
            ✕
          </button>
        </div>
      )}

      {/* 3. Top Filters Bar */}
      <Card className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className={`relative col-span-12 ${isRoot ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por descripción, módulo o usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>

            {/* Farm Selector (Root Only: Hidden for Admin / Encargado) */}
            {isRoot && (
              <div className="col-span-12 sm:col-span-6 lg:col-span-2">
                <select
                  value={rootFarmFilter}
                  onChange={(e) => {
                    setRootFarmFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E] font-medium"
                >
                  <option value="all">Todas las Granjas</option>
                  {availableFarms.map((farm) => (
                    <option key={`farm-opt-${farm.id}`} value={farm.id}>
                      {farm.name} {farm.code ? `(${farm.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Module Filter (Adapted by Role) */}
            <div className={`col-span-12 sm:col-span-6 ${isRoot ? 'lg:col-span-2' : 'lg:col-span-2'}`}>
              <select
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              >
                <option value="all">Todos los Módulos</option>
                <option value="Especies">Especies</option>
                <option value="Galpones">Galpones</option>
                <option value="Lotes">Lotes</option>
                <option value="Actividades">Actividades</option>
                <option value="Analitica">Analítica</option>
                {isRoot ? (
                  <option value="Usuarios">Usuarios / Administradores</option>
                ) : (
                  <option value="Usuarios">Personal / Encargados</option>
                )}
                {/* Global module 'Granjas' hidden for Admin / Encargado */}
                {isRoot && <option value="Granjas">Granjas</option>}
                <option value="Historial">Historial</option>
              </select>
            </div>

            {/* Action Filter */}
            <div className={`col-span-12 sm:col-span-6 ${isRoot ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              >
                <option value="all">Acciones</option>
                <option value="CREAR">CREAR</option>
                <option value="ACTUALIZAR">ACTUALIZAR</option>
                <option value="ELIMINAR">ELIMINAR</option>
                <option value="INHABILITAR">INHABILITAR</option>
                <option value="LOGIN">LOGIN</option>
              </select>
            </div>

            {/* Date From */}
            <div className="col-span-12 sm:col-span-6 lg:col-span-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 shrink-0 font-medium">Desde:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
                />
              </div>
            </div>

            {/* Date To */}
            <div className="col-span-12 sm:col-span-6 lg:col-span-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 shrink-0 font-medium">Hasta:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
                />
              </div>
            </div>
          </div>
        </form>
      </Card>

      {/* 4. Activity Logs Clean Data Table */}
      <Card className="overflow-hidden bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
        {isLoading ? (
          <div key="history-loading-skeleton" className="p-16 text-center text-xs text-gray-500">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#1B4D3E] dark:text-[#4E9F3D] mb-3" />
            <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
              Consultando registro de auditoría...
            </p>
            <p className="text-xs text-gray-400 mt-1">Obteniendo traza de eventos de la base de datos.</p>
          </div>
        ) : (
          <div key="history-table-wrapper" className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] dark:bg-[#121816] border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase text-[#1E1E1E] dark:text-gray-400 tracking-wider">
                  <th className="py-3.5 px-4">Usuario</th>
                  <th className="py-3.5 px-4 text-center">Rol</th>
                  <th className="py-3.5 px-4">Módulo Afectado</th>
                  <th className="py-3.5 px-4 text-center">Acción</th>
                  <th className="py-3.5 px-4">Descripción del Cambio</th>
                  <th className="py-3.5 px-4 text-right">Fecha / Hora</th>
                  <th className="py-3.5 px-4 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
                {(!logs || logs.length === 0) ? (
                  <tr key="history-empty-row">
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <div className="max-w-sm mx-auto text-center space-y-2">
                        <History className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
                          No se encontraron registros de auditoría
                        </p>
                        <p className="text-xs text-gray-400">
                          No hay eventos que coincidan con los filtros seleccionados o el historial está limpio.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="mt-2"
                        >
                          Restablecer Filtros
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (logs?.map((log) => {
                    const userName = log?.user?.name
                      ? `${log.user.name} ${log.user.lastname || ''}`.trim()
                      : 'Sistema / Administrador';
                    const userInitial = (userName.charAt(0) || 'S').toUpperCase();
                    const userEmail = log?.user?.email || 'Operación automatizada';
                    const userRole = log?.user?.role || (log?.user_id ? 'Usuario' : 'Sistema');

                    const moduleName = log?.module || 'General';
                    const actionName = log?.action || 'REGISTRO';
                    const descriptionText = log?.description || 'Sin descripción detallada';
                    const dateFormatted = formatDateTime(log?.created_at);

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50/60 dark:hover:bg-[#18221F]/60 transition-colors"
                      >
                        {/* 1. Usuario */}
                        <td className="py-3.5 px-4 font-bold text-[#1E1E1E] dark:text-gray-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center font-black text-xs shrink-0">
                              {userInitial}
                            </div>
                            <div className="truncate max-w-[160px]">
                              <span className="block font-bold text-xs text-[#1E1E1E] dark:text-gray-100 truncate">
                                {safeText(userName)}
                              </span>
                              <span className="block text-[10px] text-gray-400 font-normal truncate">
                                {safeText(userEmail)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Rol */}
                        <td className="py-3.5 px-4 text-center">
                          {renderRoleBadge(userRole)}
                        </td>

                        {/* 3. Módulo Afectado */}
                        <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-1.5">
                            {getModuleIcon(moduleName)}
                            <span className="font-semibold text-xs text-[#1E1E1E] dark:text-gray-200">
                              {safeText(moduleName)}
                            </span>
                          </div>
                        </td>

                        {/* 4. Acción */}
                        <td className="py-3.5 px-4 text-center">
                          {renderActionBadge(actionName)}
                        </td>

                        {/* 5. Descripción del Cambio */}
                        <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300 max-w-xs md:max-w-md">
                          <p className="line-clamp-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-normal">
                            {safeText(descriptionText)}
                          </p>
                        </td>

                        {/* 6. Fecha / Hora */}
                        <td className="py-3.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono text-[11px] whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1 text-gray-600 dark:text-gray-300">
                            <Clock className="w-3 h-3 text-[#4E9F3D]" />
                            <span>{safeText(dateFormatted)}</span>
                          </div>
                        </td>

                        {/* 7. Detalle */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLog(log);
                              setIsModalOpen(true);
                            }}
                            title="Ver detalle del registro"
                            className="p-1.5 text-gray-400 hover:text-[#1B4D3E] dark:hover:text-[#4E9F3D] hover:bg-gray-100 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  }) || [])
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Footer */}
        <div className="p-4 bg-[#F9F9F9] dark:bg-[#121816] border-t border-gray-200 dark:border-[#263632] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Mostrando{' '}
            <span className="font-bold text-[#1E1E1E] dark:text-gray-200">
              {logs?.length || 0}
            </span>{' '}
            de{' '}
            <span className="font-bold text-[#1E1E1E] dark:text-gray-200">
              {pagination.total || logs?.length || 0}
            </span>{' '}
            registros de auditoría
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Anterior
            </Button>

            <span className="px-3 py-1 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-xl font-bold text-xs text-[#1E1E1E] dark:text-gray-200">
              {currentPage} / {Math.max(1, pagination.last_page || 1)}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= (pagination.last_page || 1) || isLoading}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Siguiente
              <ChevronRight className="w-3.5 h-3.5 ml-1 inline" />
            </Button>
          </div>
        </div>
      </Card>

      {/* 6. Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedLog(null);
        }}
        title="Detalle del Evento de Auditoría"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            {/* Top metadata strip */}
            <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">ID Registro:</span>
                <span className="font-mono font-bold text-[#1E1E1E] dark:text-gray-100">
                  #{safeText(selectedLog.id)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#4E9F3D]" />
                <span className="font-mono text-gray-600 dark:text-gray-300">
                  {safeText(formatDateTime(selectedLog.created_at))}
                </span>
              </div>
            </div>

            {/* Structured details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white dark:bg-[#18221F] rounded-xl border border-gray-200 dark:border-[#263632]">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Usuario Responsable
                </span>
                <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-100">
                  {safeText(
                    selectedLog.user?.name
                      ? `${selectedLog.user.name} ${selectedLog.user.lastname || ''}`.trim()
                      : 'Sistema / Administrador'
                  )}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {safeText(selectedLog.user?.email, 'Sin correo')}
                </p>
                <div className="mt-2">
                  {renderRoleBadge(selectedLog.user?.role || 'SISTEMA')}
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-[#18221F] rounded-xl border border-gray-200 dark:border-[#263632]">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Módulo y Acción
                </span>
                <div className="flex items-center gap-2 mb-2">
                  {getModuleIcon(selectedLog.module)}
                  <span className="font-bold text-sm text-[#1E1E1E] dark:text-gray-100">
                    {safeText(selectedLog.module, 'General')}
                  </span>
                </div>
                <div>{renderActionBadge(selectedLog.action)}</div>
              </div>
            </div>

            {/* Farm context if present */}
            {selectedLog.farm && (
              <div className="p-3 bg-white dark:bg-[#18221F] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#4E9F3D]" />
                  <span className="font-medium text-gray-500">Granja Afectada:</span>
                  <span className="font-bold text-[#1E1E1E] dark:text-gray-100">
                    {safeText(selectedLog.farm.name)}
                  </span>
                </div>
                {selectedLog.farm.code && (
                  <span className="font-mono text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-[#263632] rounded-md text-gray-600 dark:text-gray-300 font-bold">
                    {safeText(selectedLog.farm.code)}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            <div className="p-4 bg-white dark:bg-[#18221F] rounded-xl border border-gray-200 dark:border-[#263632] space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                Descripción Completa del Cambio
              </span>
              <p className="text-xs text-[#1E1E1E] dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {safeText(selectedLog.description, 'No se proporcionaron detalles adicionales.')}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedLog(null);
                }}
              >
                Cerrar Detalle
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HistoryView;
