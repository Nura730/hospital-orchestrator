/**
 * @file AppShell.jsx
 * Master layout shell integrating Sidebar, Topbar, reactive live data hook, and responsive viewport containers.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import MobileBottomNav from './MobileBottomNav.jsx';
import { useLiveData } from '../../hooks/useLiveData.js';

export function AppShell() {
  // Bootstrap real-time socket stream and store initialization
  useLiveData();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-base text-surface-foreground">
      {/* Desktop Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}

export default AppShell;
