import { useEffect, useState, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line
} from 'recharts'

// Mock GeoJSON cadastral layer for Green Valley village land plots
const MOCK_CADASTRAL_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "plot-404",
      properties: {
        survey_number: "404-B / Part 2",
        owner_name: "Johnathan Smith",
        area: "5.75 Acres",
        status: "approved",
        document_id: "DOC_8F8D2K9"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.5910, 12.9710],
          [77.5930, 12.9710],
          [77.5930, 12.9730],
          [77.5910, 12.9730],
          [77.5910, 12.9710]
        ]]
      }
    },
    {
      type: "Feature",
      id: "plot-102",
      properties: {
        survey_number: "1024/2",
        owner_name: "Alice Margret",
        area: "2.50 Acres",
        status: "approved",
        document_id: "DOC_Hill102"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.5950, 12.9720],
          [77.5970, 12.9720],
          [77.5970, 12.9740],
          [77.5950, 12.9740],
          [77.5950, 12.9720]
        ]]
      }
    },
    {
      type: "Feature",
      id: "plot-202",
      properties: {
        survey_number: "202-A / Part 1",
        owner_name: "Rajesh Kumar",
        area: "3.50 Hectares",
        status: "approved",
        document_id: "DOC_Ramp202"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.5920, 12.9750],
          [77.5940, 12.9750],
          [77.5940, 12.9770],
          [77.5920, 12.9770],
          [77.5920, 12.9750]
        ]]
      }
    }
  ]
}

// Mock database metrics for overview cards
const OVERVIEW_METRICS = {
  totalProcessed: 1450,
  fieldAccuracy: 94.2, // validation pass rate
  autoApprovedPercent: 78.5,
  pendingReviewSize: 12
}

// Progress over time (district-wise) data
const PROGRESS_DATA = [
  { batch: 'Batch A', "Green Valley": 210, "Sunny Hill": 140, "River Dale": 90 },
  { batch: 'Batch B', "Green Valley": 340, "Sunny Hill": 280, "River Dale": 190 },
  { batch: 'Batch C', "Green Valley": 510, "Sunny Hill": 440, "River Dale": 310 },
  { batch: 'Batch D', "Green Valley": 680, "Sunny Hill": 590, "River Dale": 430 }
]

// Learning loop accuracy trend (before vs after human corrections)
const LEARNING_DATA = [
  { date: 'Aug 10', Before: 72.5, After: 98.4 },
  { date: 'Aug 15', Before: 75.2, After: 98.8 },
  { date: 'Aug 20', Before: 79.1, After: 99.2 },
  { date: 'Aug 25', Before: 84.6, After: 99.5 },
  { date: 'Aug 29', Before: 88.2, After: 99.8 }
]

export default function Dashboard() {
  const mapRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Dynamically load Leaflet stylesheet and script if not loaded
  useEffect(() => {
    const cssId = 'leaflet-css'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const scriptId = 'leaflet-script'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => setMapLoaded(true)
      document.body.appendChild(script)
    } else {
      setMapLoaded(true)
    }
  }, [])

  // Initialize map when Leaflet loaded
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return

    // Import global L from window
    const L = window.L
    if (!L) return

    // Destroy existing map instance to prevent react duplicate init warnings
    if (mapRef.current._leaflet_map) {
      mapRef.current._leaflet_map.remove()
    }

    // Centered around Green Valley mock coordinate center
    const map = L.map(mapRef.current).setView([12.9735, 77.5935], 15)
    mapRef.current._leaflet_map = map

    // OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)

    // Render mock cadastral GeoJSON features (plots)
    L.geoJSON(MOCK_CADASTRAL_GEOJSON, {
      style: (feature) => ({
        color: '#10b981',
        weight: 2,
        opacity: 0.8,
        fillColor: '#10b981',
        fillOpacity: 0.15
      }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties
        const popupContent = `
          <div style="font-family: sans-serif; color: #1e293b; padding: 4px; min-width: 160px;">
            <div style="font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; font-size: 13px;">
              Survey: ${props.survey_number}
            </div>
            <div style="font-size: 11px; margin-bottom: 2px;"><strong>Owner:</strong> ${props.owner_name}</div>
            <div style="font-size: 11px; margin-bottom: 6px;"><strong>Area:</strong> ${props.area}</div>
            <div style="display: inline-block; background-color: #d1fae5; color: #065f46; font-size: 10px; font-weight: bold; padding: 2px 6px; rounded-radius: 4px; border: 1px solid #a7f3d0;">
              ✓ Human-verified & signed
            </div>
            <div style="margin-top: 6px; font-size: 8px; color: #94a3b8; font-family: monospace;">Doc ID: ${props.document_id}</div>
          </div>
        `
        layer.bindPopup(popupContent)
      }
    }).addTo(map)

    // Fit map bounds to cadastral features
    const geoJsonLayer = L.geoJSON(MOCK_CADASTRAL_GEOJSON)
    map.fitBounds(geoJsonLayer.getBounds())

  }, [mapLoaded])

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-6 space-y-6 overflow-y-auto">
      
      {/* Upper Title bar */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Oversight & Analytics</h2>
          <p className="text-xs text-slate-400 mt-0.5">Read-only monitoring board for digitization metrics, accuracy curves, and GIS map registers.</p>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Last sync: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* 1. Summary Cards row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Records Processed</span>
          <div className="text-3xl font-extrabold text-blue-500 mt-2">{OVERVIEW_METRICS.totalProcessed}</div>
          <span className="text-[10px] text-slate-400 mt-1 block">&uarr; 12% increase from last batch</span>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Field-Level Accuracy</span>
          <div className="text-3xl font-extrabold text-emerald-500 mt-2">{OVERVIEW_METRICS.fieldAccuracy}%</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Based on validation rule pass rate</span>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">% Auto-Approved</span>
          <div className="text-3xl font-extrabold text-indigo-500 mt-2">{OVERVIEW_METRICS.autoApprovedPercent}%</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Unlocks with zero human correction edits</span>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Pending Review Queue</span>
          <div className="text-3xl font-extrabold text-amber-500 mt-2">{OVERVIEW_METRICS.pendingReviewSize}</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Assigned to clerks in active queues</span>
        </div>

      </div>

      {/* 2. Charts & Map Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Progress chart */}
        <div className="lg:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col shadow-lg">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Progress Over Time by District
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PROGRESS_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="batch" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b' }} />
                <Legend wrapperStyle={{ fontSize: 11, pt: 10 }} />
                <Bar dataKey="Green Valley" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sunny Hill" fill="#818cf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="River Dale" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Learning loop accuracy chart */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col shadow-lg">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Learning Loop: AI Accuracy Growth
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={LEARNING_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[60, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b' }} />
                <Legend wrapperStyle={{ fontSize: 11, pt: 10 }} />
                <Line type="monotone" dataKey="Before" stroke="#f59e0b" strokeWidth={2.5} name="Before Corrections" activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="After" stroke="#10b981" strokeWidth={2.5} name="After Corrections" activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GIS Map */}
        <div className="lg:col-span-3 bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Cadastral Survey Map (GIS Register)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Approved land registry plots rendering state boundary parcels from Bhuvan portal.</p>
            </div>
            <div className="flex items-center space-x-2 text-[10px] text-slate-400">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
              <span>Approved Plots</span>
            </div>
          </div>
          
          {/* Map canvas container */}
          <div className="h-80 w-full rounded-xl border border-slate-800 overflow-hidden relative z-0">
            {!mapLoaded && (
              <div className="absolute inset-0 bg-slate-950 flex items-center justify-center text-slate-500 text-xs">
                Initializing GIS Maps...
              </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
          </div>
        </div>

      </div>

    </div>
  )
}
