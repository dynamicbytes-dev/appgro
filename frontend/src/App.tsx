import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { RoleRoute } from './components/common/RoleRoute';
import { ModuleGuard } from './components/common/ModuleGuard';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardRouter } from './pages/DashboardRouter';
import { RootFarmsView } from './pages/root/RootFarmsView';
import { RootAdminsView } from './pages/root/RootAdminsView';
import { AdminSubordinatesView } from './pages/admin/AdminSubordinatesView';
import { HistoryView } from './pages/HistoryView';
import { SpeciesView } from './pages/SpeciesView';
import { GalponesView } from './pages/GalponesView';
import { LotesView } from './pages/LotesView';
import { ModulePage } from './pages/ModulePage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes - All Share Unified DashboardLayout & Single Sidebar */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardRouter />} />

                  {/* Dedicated Root Console Routes */}
                  <Route element={<RoleRoute allowedRoles={['ROOT']} />}>
                    <Route path="/root" element={<Navigate to="/root/farms" replace />} />
                    <Route path="/root/farms" element={<RootFarmsView />} />
                    <Route path="/root/admins" element={<RootAdminsView />} />
                    <Route path="/root/modules" element={<RootFarmsView />} />
                  </Route>

                  {/* Admin Only Route */}
                  <Route element={<RoleRoute allowedRoles={['ADMIN']} />}>
                    <Route path="/admin/subordinates" element={<AdminSubordinatesView />} />
                  </Route>

                  {/* Historial and Audit Routes */}
                  <Route path="/history" element={<HistoryView />} />
                  <Route path="/admin/history" element={<HistoryView />} />
                  <Route path="/modules/historial" element={<HistoryView />} />

                  {/* Species / Especies Module Dedicated Routes */}
                  <Route path="/species" element={<SpeciesView />} />
                  <Route
                    path="/modules/especies"
                    element={
                      <ModuleGuard moduleCode="especies">
                        <SpeciesView />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/modules/species"
                    element={
                      <ModuleGuard moduleCode="especies">
                        <SpeciesView />
                      </ModuleGuard>
                    }
                  />

                  {/* Barns / Galpones Module Dedicated Routes */}
                  <Route path="/galpones" element={<GalponesView />} />
                  <Route path="/barns" element={<GalponesView />} />
                  <Route
                    path="/modules/galpones"
                    element={
                      <ModuleGuard moduleCode="galpones">
                        <GalponesView />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/modules/barns"
                    element={
                      <ModuleGuard moduleCode="galpones">
                        <GalponesView />
                      </ModuleGuard>
                    }
                  />

                  {/* Lotes Module Dedicated Routes */}
                  <Route path="/lotes" element={<LotesView />} />
                  <Route path="/lots" element={<LotesView />} />
                  <Route
                    path="/modules/lotes"
                    element={
                      <ModuleGuard moduleCode="lotes">
                        <LotesView />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/modules/lots"
                    element={
                      <ModuleGuard>
                        <LotesView />
                      </ModuleGuard>
                    }
                  />

                  {/* Module Guard Routes */}
                  <Route
                    path="/modules/:moduleId"
                    element={
                      <ModuleGuard>
                        <ModulePage />
                      </ModuleGuard>
                    }
                  />

                  <Route path="/forbidden" element={<ForbiddenPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
