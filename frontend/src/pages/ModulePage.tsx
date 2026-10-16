import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SYSTEM_MODULES } from '../config/modules';
import type { ModuleId } from '../types/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import {
  Boxes,
  PiggyBank,
  Egg,
  Beef,
  Home,
  PackageCheck,
  TrendingUp,
  Truck,
  BarChart3,
  Users,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Calendar,
  FileText,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PiggyBank,
  Egg,
  Beef,
  Boxes,
  Home,
  PackageCheck,
  TrendingUp,
  Truck,
  BarChart3,
  Users,
};

import { SpeciesView } from './SpeciesView';
import { GalponesView } from './GalponesView';
import { LotesView } from './LotesView';
import { AdminActivitiesView } from './admin/AdminActivitiesView';
import { InventoryView } from './inventory/InventoryView';
import { AnalyticsView } from './analytics/AnalyticsView';

interface ModuleRecord {
  id: string;
  desc: string;
  date: string;
  user: string;
  status: 'Verificado' | 'En Proceso';
}

const INITIAL_LOTS_RECORDS: ModuleRecord[] = [
  {
    id: 'LOT-2026-001',
    desc: 'Lote Reproductoras 01 - Control de peso y balanceado diario',
    date: '2026-10-10 09:30 AM',
    user: 'José Rodríguez (Encargado)',
    status: 'Verificado',
  },
  {
    id: 'LOT-2026-002',
    desc: 'Lote Engorde Porcino B - Vacunación profiláctica y registro',
    date: '2026-10-09 04:15 PM',
    user: 'Carlos Mendoza (Admin)',
    status: 'Verificado',
  },
  {
    id: 'LOT-2026-003',
    desc: 'Lote Bovino Lechero 03 - Pesaje periódico e inspección sanitaria',
    date: '2026-10-08 11:00 AM',
    user: 'Andrés Gómez (Encargado)',
    status: 'En Proceso',
  },
];

const INITIAL_ACTIVITIES_RECORDS: ModuleRecord[] = [
  {
    id: 'ACT-2026-001',
    desc: 'Limpieza y desinfección preventiva de comederos y bebederos',
    date: '2026-10-11 08:00 AM',
    user: 'José Rodríguez (Encargado)',
    status: 'Verificado',
  },
  {
    id: 'ACT-2026-002',
    desc: 'Distribución de ración balanceada y suplementos vitamínicos',
    date: '2026-10-10 02:30 PM',
    user: 'Carlos Mendoza (Admin)',
    status: 'Verificado',
  },
  {
    id: 'ACT-2026-003',
    desc: 'Monitoreo de ventilación y control de temperatura ambiental',
    date: '2026-10-09 10:15 AM',
    user: 'Andrés Gómez (Encargado)',
    status: 'En Proceso',
  },
];

export const ModulePage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: ModuleId }>();
  const { toastSuccess } = useToast();

  const isLots = (moduleId as string) === 'lotes' || (moduleId as string) === 'lots';
  const isActivities =
    (moduleId as string) === 'actividades' || (moduleId as string) === 'activities';
  const isInventory =
    (moduleId as string) === 'inventario' || (moduleId as string) === 'inventory';
  const isAnalytics =
    (moduleId as string) === 'analitica' ||
    (moduleId as string) === 'analytics' ||
    (moduleId as string) === 'analytic';

  // Dynamic records state for current module
  // (los hooks deben ejecutarse antes de cualquier early-return)
  const [records, setRecords] = useState<ModuleRecord[]>(() => {
    if (isLots) return INITIAL_LOTS_RECORDS;
    if (isActivities) return INITIAL_ACTIVITIES_RECORDS;
    return INITIAL_LOTS_RECORDS;
  });

  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordNote, setRecordNote] = useState('');
  const [recordStatus, setRecordStatus] = useState<'Verificado' | 'En Proceso'>('Verificado');

  if (moduleId === 'especies' || (moduleId as string) === 'species') {
    return <SpeciesView />;
  }

  if (moduleId === 'galpones' || (moduleId as string) === 'barns') {
    return <GalponesView />;
  }

  if (moduleId === 'lotes' || (moduleId as string) === 'lots') {
    return <LotesView />;
  }

  // El módulo de actividades consume la API real (no el genérico en memoria)
  if (moduleId === 'actividades' || (moduleId as string) === 'activities') {
    return <AdminActivitiesView />;
  }

  // El módulo de inventario consume la API real (no el genérico en memoria)
  if (isInventory) {
    return <InventoryView />;
  }

  // El módulo de analítica consume la API real (no el genérico en memoria)
  if (isAnalytics) {
    return <AnalyticsView />;
  }

  const modConfig = moduleId ? SYSTEM_MODULES[moduleId] : null;

  // Compute live metrics automatically
  const totalCount = records.length;
  const verifiedCount = records.filter((r) => r.status === 'Verificado').length;
  const pendingCount = records.filter((r) => r.status === 'En Proceso').length;
  const efficiencyRate =
    totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 100;

  if (!modConfig) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-600">Módulo no encontrado</h2>
      </div>
    );
  }

  const Icon = ICON_MAP[modConfig.icon] || Boxes;

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const prefix = isLots ? 'LOT' : isActivities ? 'ACT' : 'REG';
    const now = new Date();
    const pad = String(records.length + 1).padStart(3, '0');
    const newId = `${prefix}-${now.getFullYear()}-${pad}`;
    const dateFormatted = `${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const newRecord: ModuleRecord = {
      id: newId,
      desc: recordTitle.trim() || recordNote.trim() || `Operación registrada en ${modConfig.name}`,
      date: dateFormatted,
      user: 'Usuario Actual (Admin)',
      status: recordStatus,
    };

    // Actualización inmediata sin recarga ni tres puntos
    setRecords((prev) => [newRecord, ...prev]);
    setIsActionModalOpen(false);
    setRecordTitle('');
    setRecordNote('');
    setRecordStatus('Verificado');
    toastSuccess('Registro Exitoso', `Se añadió "${newId}" al módulo ${modConfig.name}.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1B4D3E] to-[#143A2F] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-4 rounded-2xl bg-gradient-to-tr from-[#4E9F3D] to-[#6DBF5C] text-white shadow-md border border-white/20">
            <Icon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-[#6DBF5C] bg-[#4E9F3D]/20 px-2.5 py-0.5 rounded-full border border-[#4E9F3D]/30">
                Módulo Agropecuario
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              {modConfig.name}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-0.5">
              {modConfig.description}
            </p>
          </div>
        </div>

        <Button
          variant="accent"
          size="md"
          onClick={() => setIsActionModalOpen(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          Nuevo Registro
        </Button>
      </div>

      {/* Dynamic Module Metrics (Auto-actualizables en tiempo real, sin '...') */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-[#1B4D3E]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {isLots
                  ? 'Lotes Totales Activos'
                  : isActivities
                  ? 'Actividades Registradas'
                  : 'Total Registros'}
              </p>
              <h4 className="text-2xl font-black text-[#1E1E1E] dark:text-white mt-1">
                {totalCount} {isLots ? 'Lotes' : isActivities ? 'Tareas' : 'Registros'}
              </h4>
            </div>
            <Activity className="w-6 h-6 text-[#1B4D3E] dark:text-[#6DBF5C]" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {isLots
              ? 'Capacidad dentro del parámetro óptimo'
              : 'Control y seguimiento en tiempo real'}
          </p>
        </Card>

        <Card className="border-l-4 border-l-[#4E9F3D]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Eficiencia Operativa
              </p>
              <h4 className="text-2xl font-black text-[#4E9F3D] mt-1">{efficiencyRate}%</h4>
            </div>
            <CheckCircle2 className="w-6 h-6 text-[#4E9F3D]" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {verifiedCount} de {totalCount} verificados correctamente
          </p>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Alertas Sanitarias / Pendientes
              </p>
              <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {pendingCount} Pendientes
              </h4>
            </div>
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {pendingCount === 0
              ? 'Sin incidencias graves reportadas'
              : 'Registros en proceso de validación'}
          </p>
        </Card>
      </div>

      {/* Main Module Content & Table */}
      <Card
        title={`Registros Recientes: ${modConfig.name}`}
        subtitle="Bitácora de movimientos, lecturas e insumos procesados en el sistema."
        action={
          <Button size="sm" variant="outline" icon={<FileText className="w-3.5 h-3.5" />}>
            Exportar Reporte
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">
                  {isLots
                    ? 'Código Lote'
                    : isActivities
                    ? 'Identificador Tarea'
                    : 'Identificador'}
                </th>
                <th className="py-3 px-4">Descripción de la Operación</th>
                <th className="py-3 px-4">Fecha & Hora</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
              {records.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50/80 dark:hover:bg-[#263632]/50 transition-colors"
                >
                  <td className="py-4 px-4 font-mono font-bold text-[#1B4D3E] dark:text-[#6DBF5C]">
                    {item.id}
                  </td>
                  <td className="py-4 px-4 text-gray-800 dark:text-gray-200 font-medium">
                    {item.desc}
                  </td>
                  <td className="py-4 px-4 text-gray-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{item.date}</span>
                  </td>
                  <td className="py-4 px-4 text-gray-700 dark:text-gray-300">
                    {item.user}
                  </td>
                  <td className="py-4 px-4">
                    <StatusBadge
                      isActive={item.status === 'Verificado'}
                      activeText="Activo"
                      inactiveText="En Proceso"
                      gender="male"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Action Modal */}
      <Modal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        title={`Añadir Registro: ${modConfig.name}`}
        subtitle="Ingresa la bitácora o novedad detectada en la instalación."
        destroyOnClose={true}
      >
        <form onSubmit={handleCreateRecord} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {isLots
                ? 'Identificación / Nombre del Lote'
                : isActivities
                ? 'Título de la Tarea / Actividad'
                : 'Título del Registro'}
            </label>
            <input
              type="text"
              required
              placeholder={
                isLots
                  ? 'Ej: Lote Porcino Reproductoras 04'
                  : isActivities
                  ? 'Ej: Vacunación profiláctica y desinfección de galpón'
                  : 'Título o identificador...'
              }
              value={recordTitle}
              onChange={(e) => setRecordTitle(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Detalles de la Operación / Bitácora
            </label>
            <textarea
              rows={3}
              placeholder="Escribe aquí las observaciones, kilos consumidos, dosificación o detalles..."
              value={recordNote}
              onChange={(e) => setRecordNote(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Estado Inicial
            </label>
            <select
              value={recordStatus}
              onChange={(e) => setRecordStatus(e.target.value as any)}
              className="w-full p-2.5 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="Verificado">Verificado / Activo</option>
              <option value="En Proceso">En Proceso / Pendiente</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsActionModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent">
              Guardar Registro
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
