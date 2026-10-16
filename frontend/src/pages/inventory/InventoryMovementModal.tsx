import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Loader2, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { inventoryService } from '../../services/inventoryService';
import { lotService } from '../../services/lotService';
import { safeText } from '../../utils/safeText';
import {
  INVENTORY_MOVEMENT_TYPES,
  type InventoryItem,
  type InventoryMovementType,
} from '../../types/inventory';
import { formatQtyWithUnit, inputClasses, toNumber, unitShortOf } from './inventoryShared';

interface LotOption {
  id: number;
  code: string;
}

interface InventoryMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  presetItemId?: number | null;
  onSaved: () => void;
}

const TYPE_ICON: Record<InventoryMovementType, React.ReactNode> = {
  entrada: <ArrowDownCircle className="w-4 h-4" />,
  salida: <ArrowUpCircle className="w-4 h-4" />,
  ajuste: <SlidersHorizontal className="w-4 h-4" />,
};

/**
 * Formulario reutilizable para registrar un movimiento de inventario
 * (entrada / salida / ajuste). Lo usan tanto la pestaña de Insumos
 * (acción rápida por fila) como la pestaña de Movimientos.
 */
export const InventoryMovementModal: React.FC<InventoryMovementModalProps> = ({
  isOpen,
  onClose,
  items,
  presetItemId,
  onSaved,
}) => {
  const { toastSuccess, toastError } = useToast();

  const [type, setType] = useState<InventoryMovementType>('entrada');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [destinationLotId, setDestinationLotId] = useState('');
  const [notes, setNotes] = useState('');
  const [lots, setLots] = useState<LotOption[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset al abrir
  useEffect(() => {
    if (!isOpen) return;
    setType('entrada');
    setItemId(presetItemId ? String(presetItemId) : '');
    setQuantity('');
    setDestinationLotId('');
    setNotes('');
    setErrors({});
  }, [isOpen, presetItemId]);

  // Cargar lotes de destino (opcional: si el módulo Lotes no está activo,
  // el selector queda vacío y el campo se deshabilita).
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoadingLots(true);

    lotService
      .getAll()
      .then((response) => {
        if (!active) return;
        const list = (response?.data ?? [])
          .map((lot: any) => ({ id: Number(lot.id), code: String(lot.code ?? `Lote #${lot.id}`) }))
          .filter((lot: LotOption) => !Number.isNaN(lot.id));
        setLots(list);
      })
      .catch(() => {
        if (active) setLots([]);
      })
      .finally(() => {
        if (active) setIsLoadingLots(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const selectedItem = useMemo(
    () => items.find((item) => String(item.id) === itemId) ?? null,
    [items, itemId]
  );

  const quantityNumber = toNumber(quantity);

  const projectedStock = useMemo(() => {
    if (!selectedItem) return null;
    const current = toNumber(selectedItem.current_stock);
    if (type === 'entrada') return current + Math.abs(quantityNumber);
    if (type === 'salida') return current - Math.abs(quantityNumber);
    return current + quantityNumber;
  }, [selectedItem, type, quantityNumber]);

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!itemId) nextErrors.inventory_item_id = 'Selecciona el insumo.';
    if (quantity === '' || Number.isNaN(Number(quantity))) {
      nextErrors.quantity = 'Ingresa una cantidad válida.';
    } else if (type === 'entrada' || type === 'salida') {
      if (quantityNumber <= 0) nextErrors.quantity = 'La cantidad debe ser mayor que cero.';
    } else if (type === 'ajuste' && quantityNumber === 0) {
      nextErrors.quantity = 'El ajuste debe ser distinto de cero (puede ser negativo).';
    }

    if (!nextErrors.quantity && projectedStock !== null && projectedStock < 0) {
      nextErrors.quantity = 'Stock insuficiente para este movimiento.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      await inventoryService.createMovement({
        inventory_item_id: Number(itemId),
        type,
        quantity: Number(quantity),
        destination_lot_id: destinationLotId ? Number(destinationLotId) : null,
        notes: notes.trim() || null,
      });

      toastSuccess('Movimiento registrado', 'El stock del insumo fue actualizado.');
      onSaved();
      onClose();
    } catch (error: any) {
      const payload = error?.response?.data;
      const backendErrors = payload?.errors;

      if (backendErrors && typeof backendErrors === 'object') {
        const mapped: Record<string, string> = {};
        Object.entries(backendErrors).forEach(([field, messages]) => {
          mapped[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        });
        setErrors(mapped);
      }

      toastError('Error', payload?.message || 'No se pudo registrar el movimiento.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar movimiento"
      subtitle="Entradas, salidas y ajustes de stock"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tipo */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Tipo de movimiento *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {INVENTORY_MOVEMENT_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                title={option.hint}
                className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  type === option.value
                    ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                    : 'bg-white dark:bg-[#18221F] text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#263632] hover:bg-gray-50 dark:hover:bg-[#263632]'
                }`}
              >
                {TYPE_ICON[option.value]}
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            {INVENTORY_MOVEMENT_TYPES.find((o) => o.value === type)?.hint}
          </p>
        </div>

        {/* Insumo */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Insumo *
          </label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputClasses}>
            <option value="">Seleccionar insumo...</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {safeText(item.code, '')} · {safeText(item.name, `Insumo #${item.id}`)} (stock:{' '}
                {formatQtyWithUnit(item.current_stock, item.unit)})
              </option>
            ))}
          </select>
          {errors.inventory_item_id && <p className="text-xs text-red-600 mt-1">{errors.inventory_item_id}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cantidad */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Cantidad {type === 'ajuste' ? '(con signo)' : 'movilizada'}
              {selectedItem ? ` (${unitShortOf(selectedItem.unit)})` : ''} *
            </label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === 'ajuste' ? 'Ej: -5 o 3' : 'Ej: 25'}
              className={inputClasses}
            />
            {errors.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>}
          </div>

          {/* Lote destino (solo salida) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Lote de destino {type === 'salida' ? '' : '(opcional)'}
            </label>
            <select
              value={destinationLotId}
              onChange={(e) => setDestinationLotId(e.target.value)}
              disabled={isLoadingLots || lots.length === 0}
              className={`${inputClasses} disabled:opacity-60`}
            >
              <option value="">
                {isLoadingLots ? 'Cargando lotes...' : lots.length === 0 ? 'Sin lotes disponibles' : 'Sin lote específico'}
              </option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {safeText(lot.code, `Lote #${lot.id}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Observaciones
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Motivo, proveedor, consumo por lote..."
            className={`${inputClasses} resize-none`}
          />
        </div>

        {/* Vista previa del stock */}
        {selectedItem && (
          <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] px-3 py-2.5 text-xs">
            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Stock resultante estimado
            </span>
            <span
              className={`font-bold ${
                projectedStock !== null && projectedStock < 0 ? 'text-red-600' : 'text-[#1B4D3E] dark:text-[#6DBF5C]'
              }`}
            >
              {projectedStock !== null ? formatQtyWithUnit(projectedStock, selectedItem.unit) : '—'}
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#263632]">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" disabled={isSaving} icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}>
            {isSaving ? 'Guardando...' : 'Registrar movimiento'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default InventoryMovementModal;
