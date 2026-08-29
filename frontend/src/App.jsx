import { useState } from 'react'
import VerificationConsole from './pages/verification-console/VerificationConsole'
import Dashboard from './pages/dashboard/Dashboard'

function App() {
  const [activeView, setActiveView] = useState('verification') // default to verification console
  const [activeTab, setActiveTab] = useState('preprocessing')

  const services = [
    { id: 'preprocessing', name: 'Preprocessing', desc: 'Noise reduction, deskewing, and resizing.', endpoint: '/api/preprocessing/process' },
    { id: 'extraction', name: 'Extraction', desc: 'OCR & Key-Value structured data extraction.', endpoint: '/api/extraction/extract' },
    { id: 'validation', name: 'Validation', desc: 'Business logic & field validation checks.', endpoint: '/api/validation/validate' },
    { id: 'verification', name: 'Verification', desc: 'Cross-matching with external databases.', endpoint: '/api/verification/verify' },
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex items-center justify-between shadow-md">
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

        {/* Global Navigation View Selector */}
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex space-x-1">
          <button
            onClick={() => setActiveView('verification')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'verification'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Clerk Verification Console
          </button>
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Oversight Dashboard
          </button>
          <button
            onClick={() => setActiveView('developer')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'developer'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Developer Platform
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
            Local Dev Mode
          </span>
        </div>
      </header>

      {/* Main Content Area depending on Active View */}
      {activeView === 'verification' && <VerificationConsole />}
      {activeView === 'dashboard' && <Dashboard />}
      {activeView === 'developer' && (
        <div className="flex-1 flex flex-col">
          {/* Main Grid Layout for Developer Services */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Navigation / Service Tabs */}
            <section className="md:col-span-1 space-y-2">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">
                Digitization Services
              </h2>
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setActiveTab(service.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border ${
                    activeTab === service.id
                      ? 'bg-blue-600/10 border-blue-500/40 text-blue-400 shadow-md shadow-blue-500/5'
                      : 'bg-slate-950/20 border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold text-sm">{service.name}</div>
                  <div className="text-xs mt-0.5 opacity-80 line-clamp-1">{service.desc}</div>
                </button>
              ))}
            </section>

            {/* Console / Interaction Area */}
            <section className="md:col-span-3 bg-slate-950/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-sm">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-100">
                    {services.find(s => s.id === activeTab)?.name} Service
                  </h3>
                  <code className="text-xs bg-slate-900 px-3 py-1.5 rounded-md text-indigo-400 border border-slate-800">
                    POST {services.find(s => s.id === activeTab)?.endpoint}
                  </code>
                </div>
                
                <p className="text-slate-400 text-sm mb-6">
                  {services.find(s => s.id === activeTab)?.desc} Setup and configure this module to convert physical land registries into queryable database entries.
                </p>

                <div className="border border-slate-800 bg-slate-950 rounded-xl p-4 min-h-[160px] flex items-center justify-center text-slate-500 text-sm font-mono border-dashed">
                  [ Interactive Console: Awaiting Service Integration ]
                </div>
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                <button className="px-4 py-2 text-sm rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-900 transition-colors">
                  Docs
                </button>
                <button className="px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-600/20 transition-all">
                  Test Pipeline
                </button>
              </div>
            </section>
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/60 bg-slate-950/20 py-4 px-6 text-center text-xs text-slate-500 mt-auto">
            &copy; {new Date().getFullYear()} Terravision Digitization Platform. All rights reserved.
          </footer>
        </div>
      )}
    </div>
  )
}

export default App
