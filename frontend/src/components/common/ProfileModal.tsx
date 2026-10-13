import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { User, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { safeText } from '../../utils/safeText';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
    setPassword('');
    setConfirmPassword('');
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('El nombre no puede estar vacío.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('El correo electrónico no puede estar vacío.');
      return;
    }
    if (password && password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password && password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      const updateData: { name: string; email: string; password?: string } = {
        name: name.trim(),
        email: email.trim(),
      };
      if (password) {
        updateData.password = password;
      }

      await updateProfile(updateData);
      setSuccessMessage('Perfil actualizado correctamente.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al actualizar el perfil.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mi Perfil de Cuenta"
      subtitle="Consulta y actualiza tu información personal y credenciales de acceso"
      destroyOnClose={true}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{safeText(successMessage)}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-xl border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{safeText(errorMessage)}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Rol de Cuenta
          </label>
          <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-[#263632] rounded-xl text-xs font-bold text-[#1B4D3E] dark:text-[#6DBF5C] uppercase tracking-wider">
            {user?.role === 'root' || user?.role === 'ROOT' ? '👑 Usuario Root (Administrador Global)' : safeText(user?.role)}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Nombre Completo
          </label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Correo Electrónico
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-[#263632] pt-4">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
            Cambiar Contraseña (Dejar en blanco para mantener la actual)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Nueva Contraseña</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1B4D3E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Confirmar Contraseña</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1B4D3E]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="submit" variant="accent" disabled={isLoading}>
            {isLoading ? 'Guardando...' : 'Actualizar Perfil'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
