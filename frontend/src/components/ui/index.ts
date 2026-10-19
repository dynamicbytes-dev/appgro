/**
 * Punto de entrada de los componentes de UI reutilizables.
 *
 * Uso preferido en código nuevo:
 *   import { Button, Field, Input, Select, Alert, StatCard, DataTable } from '../../components/ui';
 */
export { Badge } from './Badge';
export { Button } from './Button';
export { Card } from './Card';
export { Modal } from './Modal';
export { NumberInput } from './NumberInput';
export { PageHeader } from './PageHeader';
export { PhoneInput } from './PhoneInput';
export { Skeleton, SkeletonLoader } from './SkeletonLoader';
export { StatusBadge, normalizeIsActive } from './StatusBadge';

// Componentes estandarizados añadidos en P2.
export { Field } from './Field';
export { Input } from './Input';
export { Select } from './Select';
export { Textarea } from './Textarea';
export { Alert } from './Alert';
export { IconButton } from './IconButton';
export { StatCard, KpiCard } from './StatCard';
export { FormFooter } from './FormFooter';
export { DataTable } from './DataTable';

export type { Column, DataTableProps } from './DataTable';
export type { StatTone, StatCardProps } from './StatCard';
export type { AlertVariant, AlertProps } from './Alert';
export type { FieldProps } from './Field';
export type { InputProps } from './Input';
export type { SelectProps } from './Select';
export type { TextareaProps } from './Textarea';
export type { IconButtonProps } from './IconButton';
export type { FormFooterProps } from './FormFooter';
