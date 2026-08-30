import { useState, useEffect } from 'react'
import Dashboard from './pages/dashboard/Dashboard'
import Documents from './pages/documents/Documents'
import DocumentUpload from './pages/pipeline/DocumentUpload'
import VerificationConsole from './pages/verification-console/VerificationConsole'
import Verification from './pages/verification/Verification'
import Administration from './pages/admin/Administration'

function App() {
  const [role, setRole] = useState('clerk') // 'clerk', 'supervisor', 'admin'
  const [activeView, setActiveView] = useState('dashboard') // default view

  // Define navigation tabs configuration
  const tabsConfig = [
    { id: 'dashboard', name: 'Dashboard', roles: ['clerk', 'supervisor', 'admin'] },
    { id: 'documents', name: 'Documents', roles: ['clerk', 'supervisor', 'admin'] },
    { id: 'review_queue', name: 'Review Queue', roles: ['clerk', 'supervisor', 'admin'] },
    { id: 'verification', name: 'Verification', roles: ['supervisor', 'admin'] },
    { id: 'administration', name: 'Administration', roles: ['admin'] }
  ]

  // Filter tabs based on active role
  const visibleTabs = tabsConfig.filter(tab => tab.roles.includes(role))

  // Reset activeView if the new role doesn't have permission for it
  useEffect(() => {
    const isAllowed = visibleTabs.some(tab => tab.id === activeView) || activeView === 'upload'
    if (!isAllowed) {
      setActiveView('dashboard')
    }
  }, [role, activeView, visibleTabs])

  const handleViewChange = (view) => {
    if (view === 'review') {
      setActiveView('review_queue')
    } else if (view === 'verify') {
      setActiveView('verification')
    } else {
      setActiveView(view)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        
        {/* App Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            LR
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              Terravision
            </h1>
            <p className="text-xs text-slate-400">Land Record Digitization Suite</p>
          </div>
        </div>

        {/* Reorganized Navigation Tabs based on permissions */}
        <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 flex flex-wrap gap-1">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                (activeView === tab.id || (tab.id === 'documents' && activeView === 'upload'))
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* User Role Selector Dropdown */}
        <div className="flex items-center space-x-3 self-end md:self-auto">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Role:</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="clerk">Clerk</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
        </div>

      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'documents' && <Documents onViewChange={handleViewChange} />}
        {activeView === 'upload' && <DocumentUpload role={role} onViewChange={handleViewChange} />}
        {activeView === 'review_queue' && <VerificationConsole />}
        {activeView === 'verification' && <Verification />}
        {activeView === 'administration' && <Administration />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/20 py-4 px-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Terravision Digitization Platform. All rights reserved.
      </footer>

    </div>
  )
}

export default App
