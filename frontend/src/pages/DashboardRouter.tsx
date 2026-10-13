import React from 'react';
import { useAuth } from '../context/AuthContext';
import { RootDashboard } from './RootDashboard';
import { AdminDashboard } from './AdminDashboard';
import { EncargadoDashboard } from './EncargadoDashboard';

export const DashboardRouter: React.FC = () => {
  const { user } = useAuth();

  const role = user?.role ? user.role.toUpperCase() : '';

  if (role === 'ROOT') {
    return <RootDashboard />;
  }

  if (role === 'ADMIN') {
    return <AdminDashboard />;
  }

  return <EncargadoDashboard />;
};
