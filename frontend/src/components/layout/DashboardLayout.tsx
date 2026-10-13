import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '../common/Navbar';
import { Sidebar } from '../common/Sidebar';
import { ErrorBoundary } from '../common/ErrorBoundary';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <div className="min-h-screen bg-[#F9F9F9] dark:bg-[#0F1715] text-[#1E1E1E] dark:text-gray-100 flex flex-col transition-colors">
        {/* Top Navbar Header */}
        <Navbar />

        {/* Main Layout Container with Single Standardized Sidebar */}
        <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
          <ErrorBoundary resetKey={`sidebar-${location.pathname}`}>
            <Sidebar />
          </ErrorBoundary>

          {/* Content Area wrapped in ErrorBoundary with location reset key */}
          <main className="flex-1 min-w-0">
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default DashboardLayout;
