import React from 'react';

/**
 * Sidebar navigation component.
 * Uses Tailwind CSS utilities (Tailwind is configured in this project).
 * Visible permanently on medium+ screens, and as a drawer on smaller screens.
 */
export default function Sidebar({ isOpen, onClose, role, setRole, activeView, setActiveView }) {
  const tabsConfig = [
    { id: 'dashboard', name: 'Dashboard', roles: ['clerk', 'supervisor', 'admin'] },
    { id: 'documents', name: 'Documents', roles: ['clerk', 'supervisor', 'admin'] },
    { id: 'review_queue', name: 'Review Queue', roles: ['clerk', 'supervisor', 'admin'] },
    { id: 'verification', name: 'Verification', roles: ['supervisor', 'admin'] },
    { id: 'administration', name: 'Administration', roles: ['admin'] },
  ];
  const visibleTabs = tabsConfig.filter(tab => tab.roles.includes(role));

  const sidebarContent = (
    <aside className="bg-primary text-white w-60 p-4 flex flex-col space-y-2">
      {visibleTabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => { setActiveView(tab.id); onClose && onClose(); }}
          className="w-full text-left px-3 py-2 rounded hover:bg-primary/80"
        >
          {tab.name}
        </button>
      ))}
    </aside>
  );

  // Mobile drawer overlay
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 z-50`}
      >
        {sidebarContent}
      </div>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        {sidebarContent}
      </div>
    </>
  );
}
