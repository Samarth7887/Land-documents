import React, { useState } from 'react';
import Sidebar from './Sidebar';
import './ui/ui.css';

/**
 * Layout component providing a responsive navigation layout.
 * - On screens >= 768px the sidebar is permanently visible.
 * - On smaller screens a hamburger button toggles a drawer.
 * Uses only the vanilla CSS utilities defined in ui.css.
 */
export default function Layout({ isPublicView, role, setRole, activeView, setActiveView, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Public pages should not render the app shell.
  if (isPublicView) return <>{children}</>;

  return (
    <div className="app-container bg-bg-page min-h-screen flex">
      {/* Mobile hamburger button */}
      <button
        className="hamburger-btn md:hidden p-4"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation menu"
      >
        &#9776;
      </button>

      {/* Sidebar component */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        setRole={setRole}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main content area */}
      <main className="main-content flex-1">{children}</main>
    </div>
  );
}
