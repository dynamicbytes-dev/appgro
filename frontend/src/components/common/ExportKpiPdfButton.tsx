import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  generateExecutiveKpiPdf,
  type KpiCardItem,
} from '../../utils/zootikaKpiPdfGenerator';

export interface ExportKpiPdfButtonProps {
  /** Nombre formal del módulo para el encabezado del PDF, ej: "Módulo de Especies" */
  moduleTitle: string;
  /** Slug identificador para nombrar el archivo PDF, ej: "especies" (opcional) */
  moduleSlug?: string;
  /** Cuatro indicadores clave de rendimiento (KPIs) */
  kpis: KpiCardItem[];
  /** Texto del diagnóstico ejecutivo u operacional */
  diagnosis?: string;
  /** Encabezados de la tabla de registros */
  columns: string[];
  /** Filas de la tabla de registros */
  rows: (string | number)[][];
  /** Nombre alternativo de la granja (si no se proporciona, se toma de useAuth) */
  farmName?: string;
  /** Código de la granja */
  farmCode?: string;
  /** Función opcional para cargar datos frescos antes de exportar */
  fetchData?: () => Promise<{
    kpis?: KpiCardItem[];
    columns?: string[];
    rows?: (string | number)[][];
    diagnosis?: string;
  }>;
  /** Clases CSS adicionales */
  className?: string;
  /** Deshabilitar el botón */
  disabled?: boolean;
}

export const ExportKpiPdfButton: React.FC<ExportKpiPdfButtonProps> = ({
  moduleTitle,
  moduleSlug,
  kpis,
  diagnosis = 'Control operacional y seguimiento periódico dentro de los parámetros zootécnicos establecidos.',
  columns,
  rows,
  farmName,
  farmCode,
  fetchData,
  className = '',
  disabled = false,
}) => {
  const { user, activeFarm } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = async () => {
    if (isGenerating || disabled) return;
    setIsGenerating(true);

    try {
      let finalKpis = kpis;
      let finalColumns = columns;
      let finalRows = rows;
      let finalDiagnosis = diagnosis;

      if (fetchData) {
        const fresh = await fetchData();
        if (fresh.kpis) finalKpis = fresh.kpis;
        if (fresh.columns) finalColumns = fresh.columns;
        if (fresh.rows) finalRows = fresh.rows;
        if (fresh.diagnosis) finalDiagnosis = fresh.diagnosis;
      }

      const resolvedFarmName =
        farmName ||
        activeFarm?.name ||
        user?.farm?.name ||
        'Granja Zootika';

      const resolvedFarmCode =
        farmCode ||
        activeFarm?.code ||
        user?.farm?.code ||
        '';

      const resolvedUserName =
        user?.name ||
        user?.email ||
        'Administrador de Granja';

      const resolvedUserRole =
        user?.role ? user.role.toUpperCase() : 'ADMIN';

      await generateExecutiveKpiPdf({
        moduleTitle,
        moduleSlug:
          moduleSlug ||
          moduleTitle
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, ''),
        farmName: resolvedFarmName,
        farmCode: resolvedFarmCode,
        userName: resolvedUserName,
        userRole: resolvedUserRole,
        kpis: finalKpis,
        diagnosis: finalDiagnosis,
        columns: finalColumns,
        rows: finalRows,
      });

      toastSuccess(
        'PDF Generado',
        `El reporte ejecutivo de KPIs para ${moduleTitle} se descargó correctamente.`
      );
    } catch (err: any) {
      console.error('Error al generar PDF de KPIs:', err);
      toastError(
        'Error al exportar',
        'No se pudo generar el documento PDF. Por favor intenta de nuevo.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      translate="no"
      onClick={handleExport}
      disabled={isGenerating || disabled}
      className={`bg-emerald-900 hover:bg-emerald-800 text-white font-medium px-4 py-2 rounded-lg border border-emerald-500/30 flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm ${className}`}
      title="Exportar Reporte Ejecutivo de KPIs en formato PDF institucional"
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
          <span>Generando PDF...</span>
        </>
      ) : (
        <>
          <FileDown className="w-4 h-4 text-emerald-300" />
          <span>Exportar KPIs (PDF)</span>
        </>
      )}
    </button>
  );
};

export default ExportKpiPdfButton;
