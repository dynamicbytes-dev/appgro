import React from 'react';
import { renderSafe, safeText } from '../../utils/safeText';
import { SkeletonLoader } from './SkeletonLoader';

export interface Column<T> {
  /** Identificador único de la columna. */
  key: string;
  /** Encabezado. */
  header: React.ReactNode;
  /** Render personalizado de la celda. Si se omite, se lee `row[key]`. */
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string | number;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

const ALIGN = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

/**
 * Tabla de datos genérica y estandarizada: cabecera, estados de carga/vacío y
 * filas clicables. Unifica el look de los listados del sistema.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  emptyMessage = 'No hay registros para mostrar.',
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  if (isLoading) {
    return <SkeletonLoader type="table" rows={5} />;
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-gray-200/80 bg-surface dark:border-line-dark dark:bg-surface-dark ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-[#1f2b27]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}
                >
                  {renderSafe(col.header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-line-dark">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {renderSafe(emptyMessage)}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-line-dark/40' : ''
                  }`}
                >
                  {columns.map((col) => {
                    const content = col.render
                      ? col.render(row, index)
                      : safeText((row as Record<string, unknown>)[col.key]);

                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-gray-700 dark:text-gray-200 ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}
                      >
                        {renderSafe(content)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
