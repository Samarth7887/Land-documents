import { useState, useEffect } from 'react'
import Dashboard from './pages/dashboard/Dashboard'
import Documents from './pages/documents/Documents'
import DocumentUpload from './pages/pipeline/DocumentUpload'
import ReviewQueue from './pages/review-queue/ReviewQueue'
import Verification from './pages/verification/Verification'
import Administration from './pages/admin/Administration'
import PublicVerify from './pages/public-verify/PublicVerify';
import Layout from './components/Layout';

function App() {
  const [role, setRole] = useState('clerk'); // 'clerk', 'supervisor', 'admin'
  const [activeView, setActiveView] = useState('dashboard'); // default view

  // Check if the user is navigating to the public verification page
  const isPublicVerifyPage =
    window.location.hash.startsWith('#/public-verify') ||
    new URLSearchParams(window.location.search).get('view') === 'public-verify';

  // If this is the public page, render it bare (no app shell)
  if (isPublicVerifyPage) {
    return <PublicVerify />;
  }

  // Define navigation tabs configuration
  const tabsConfig = [
    { id: 'dashboard', name: 'Dashboard', roles: ['clerk', 'supervisor', 'admin'] },
    { id: 'documents', name: 'Documents', roles: ['clerk', 'supervisor', 'admin'] },
    { id: 'review_queue', name: 'Review Queue', roles: ['clerk', 'supervisor', 'admin'] },
    { id: 'verification', name: 'Verification', roles: ['supervisor', 'admin'] },
    { id: 'administration', name: 'Administration', roles: ['admin'] },
  ];

  // Filter tabs based on active role
  const visibleTabs = tabsConfig.filter(tab => tab.roles.includes(role));

  // Reset activeView if the new role doesn't have permission for it
  useEffect(() => {
    const isAllowed = visibleTabs.some(tab => tab.id === activeView) || activeView === 'upload';
    if (!isAllowed) {
      setActiveView('dashboard');
    }
  }, [role, activeView, visibleTabs]);

  const handleViewChange = (view) => {
    if (view === 'review') {
      setActiveView('review_queue');
    } else if (view === 'verify') {
      setActiveView('verification');
    } else {
      setActiveView(view);
    }
  };

  return (
    <Layout
      isPublicView={false}
      role={role}
      setRole={setRole}
      activeView={activeView}
      setActiveView={setActiveView}
    >
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'documents' && <Documents onViewChange={handleViewChange} />}
        {activeView === 'upload' && <DocumentUpload role={role} onViewChange={handleViewChange} />}
        {activeView === 'review_queue' && <ReviewQueue />}
        {activeView === 'verification' && <Verification />}
        {activeView === 'administration' && <Administration />}
      </main>
      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/20 py-4 px-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Terravision Digitization Platform. All rights reserved.
      </footer>
    </Layout>
  );
}

export default App
