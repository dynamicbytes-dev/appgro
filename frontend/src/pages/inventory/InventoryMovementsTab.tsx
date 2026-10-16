import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { inventoryService } from '../../services/inventoryService';
import { safeText } from '../../utils/safeText';
import {
  INVENTORY_MOVEMENT_LABELS,
  INVENTORY_MOVEMENT_TYPES,
  type InventoryItem,
  type InventoryMovement,
  type InventoryMovementType,
} from '../../types/inventory';
import {
  MOVEMENT_BADGE_VARIANT,
  formatDateTime,
  formatQty,
  formatQtyWithUnit,
  inputClasses,
  toNumber,
  unitShortOf,
} from './inventoryShared';
import { InventoryMovementModal } from './InventoryMovementModal';

interface InventoryMovementsTabProps {
  isAdmin: boolean;
}

const TYPE_ICON: Record<InventoryMovementType, React.ReactNode> = {
  entrada: <ArrowDownCircle className="w-4 h-4 text-[#4E9F3D]" />,
  salida: <ArrowUpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
  ajuste: <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
};

const signedQty = (movement: InventoryMovement): string => {
  const unit = unitShortOf(movement.unit ?? movement.item?.unit ?? null);
  const suffix = unit ? ` ${unit}` : '';

  if (typeof movement.stock_effect === 'number') {
    const effect = movement.stock_effect;
    return `${effect > 0 ? '+' : ''}${formatQty(effect)}${suffix}`;
  }
  if (movement.type === 'entrada') return `+${formatQty(movement.quantity)}${suffix}`;
  if (movement.type === 'salida') return `-${formatQty(movement.quantity)}${suffix}`;
  const n = toNumber(movement.quantity);
  return `${n > 0 ? '+' : ''}${formatQty(n)}${suffix}`;
};

export const InventoryMovementsTab: React.FC<InventoryMovementsTabProps> = ({ isAdmin }) => {
  const { user, activeFarm } = useAuth();

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');

  const farmId = (activeFarm?.id as number) || (user?.farm_id as number) || undefined;

  const loadItems = useCallback(async () => {
    try {
      const result = isAdmin ? await inventoryService.getAll({ farm_id: farmId }) : await inventoryService.getMy();
      setItems(Array.isArray(result.data) ? result.data : []);
    } catch {
      setItems([]);
    }
  }, [isAdmin, farmId]);

  const loadMovements = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await inventoryService.getMovements({
        type: typeFilter || undefined,
        inventory_item_id: itemFilter || undefined,
        farm_id: farmId,
      });
      setMovements(Array.isArray(result) ? result : []);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudo cargar el historial de movimientos.');
      setMovements([]);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, itemFilter, farmId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadMovements();
  }, [loadMovements]);

  const summary = useMemo(() => {
    const list = Array.isArray(movements) ? movements : [];
    return {
      total: list.length,
      entradas: list.filter((m) => m?.type === 'entrada').length,
      salidas: list.filter((m) => m?.type === 'salida').length,
      ajustes: list.filter((m) => m?.type === 'ajuste').length,
    };
  }, [movements]);

  const handleSaved = () => {
    void loadMovements();
    void loadItems();
  };

  return (
    <div className="space-y-6">
      {/* Encabezado + acción */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <Badge variant="success" className="text-[10px]!">
                  {summary.entradas} entradas
                </Badge>
              </span>
              <Badge variant="info" className="text-[10px]!">
                {summary.salidas} salidas
              </Badge>
              <Badge variant="warning" className="text-[10px]!">
                {summary.ajustes} ajustes
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadMovements()}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Actualizar
              </Button>
              <Button
                variant="accent"
                onClick={() => setIsMovementModalOpen(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                Registrar movimiento
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inputClasses}>
              <option value="">Todos los tipos</option>
              {(INVENTORY_MOVEMENT_TYPES || []).map((option) => (
                <option key={`type-opt-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className={inputClasses}>
              <option value="">Todos los insumos</option>
              {(items || []).map((item) => (
                <option key={`item-opt-${item.id}`} value={item.id}>
                  {safeText(item.code, '')} · {safeText(item.name, `Insumo #${item.id}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden p-0!">
        {errorMessage ? (
          <div className="m-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : (movements || []).length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500">
            <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">No hay movimientos registrados.</p>
            <p className="text-xs mt-1">Registra la primera entrada, salida o ajuste.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#263632] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-3 font-bold">Fecha & hora</th>
                  <th className="px-4 py-3 font-bold">Insumo</th>
                  <th className="px-4 py-3 font-bold">Tipo</th>
                  <th className="px-4 py-3 font-bold">Cantidad</th>
                  <th className="px-4 py-3 font-bold">Stock resultante</th>
                  <th className="px-4 py-3 font-bold">Lote / Destino</th>
                  <th className="px-4 py-3 font-bold">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632]">
                {(movements || []).map((movement) => {
                  const movementId = movement.id ? String(movement.id) : `mov-${Math.random()}`;

                  return (
                    <tr key={`movement-${movementId}`} className="hover:bg-gray-50 dark:hover:bg-[#263632]/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {formatDateTime(movement.movement_date ?? movement.created_at)}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="font-mono text-[11px] font-bold text-[#1B4D3E] dark:text-[#6DBF5C]">
                          {safeText(movement.item_code ?? movement.item?.code ?? '', '')}
                        </span>
                        <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                          {safeText(movement.item_name ?? movement.item?.name ?? '', '—')}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {TYPE_ICON[movement.type]}
                          <Badge variant={MOVEMENT_BADGE_VARIANT[movement.type] ?? 'primary'} className="text-[10px]!">
                            {safeText(movement.type_label ?? INVENTORY_MOVEMENT_LABELS[movement.type], movement.type)}
                          </Badge>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-bold ${
                            movement.type === 'entrada'
                              ? 'text-[#4E9F3D]'
                              : movement.type === 'salida'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {signedQty(movement)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#1E1E1E] dark:text-gray-100">
                        {formatQtyWithUnit(movement.resulting_stock, movement.unit ?? movement.item?.unit)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                        {safeText(
                          movement.inventory_lot_code ??
                            movement.inventory_lot?.code ??
                            movement.lot_code ??
                            movement.lot?.code ??
                            '',
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                        {safeText(movement.responsible_name ?? movement.user?.name ?? '', '—')}
                        {movement.notes ? (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[160px]" title={movement.notes}>
                            {safeText(movement.notes, '')}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <InventoryMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        items={items}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default InventoryMovementsTab;
