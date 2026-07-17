import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import type { Alert } from '../App';

// Define custom DIV icon colors to look premium and avoid broken Leaflet PNG paths
const createDynamicIcon = (symbol: string, color: 'emerald' | 'blue' | 'red') => {
  const colorMap = {
    emerald: 'bg-emerald-500 border-emerald-300 ring-emerald-400',
    blue: 'bg-blue-500 border-blue-300 ring-blue-400',
    red: 'bg-red-500 border-red-300 ring-red-400'
  };
  
  return L.divIcon({
    html: `
      <div class="relative flex h-6 w-6">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color === 'red' ? 'bg-red-400' : color === 'blue' ? 'bg-blue-400' : 'bg-emerald-400'}"></span>
        <span class="relative inline-flex rounded-full h-6 w-6 border-2 shadow-lg items-center justify-center text-xs font-semibold text-white ${colorMap[color]}">
          ${symbol}
        </span>
      </div>
    `,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

interface InteractiveMapProps {
  alerts: Alert[];
  isDarkMode?: boolean;
}

interface MapMarker {
  id: string;
  name: string;
  type: 'shelter' | 'hospital';
  lat: number;
  lng: number;
  details: string;
  occupancy?: string;
  waitTime?: string;
}

const MOCK_MAP_MARKERS: MapMarker[] = [
  // Mumbai
  {
    id: 'mum-sh-1',
    name: 'Dharavi Community Center Shelter',
    type: 'shelter',
    lat: 19.0380,
    lng: 72.8538,
    details: 'Cots, clean water, blankets, hot meals. Accepts pets.',
    occupancy: '85/150 cots occupied'
  },
  {
    id: 'mum-sh-2',
    name: 'Bandra Municipal School Relief Zone',
    type: 'shelter',
    lat: 19.0596,
    lng: 72.8295,
    details: 'First-aid medical unit. Service animals only.',
    occupancy: '42/100 cots occupied'
  },
  {
    id: 'mum-hosp-1',
    name: 'KEM Hospital & Medical College',
    type: 'hospital',
    lat: 19.0028,
    lng: 72.8420,
    details: 'Trauma Care, Emergency Surgery, Tropical Disease Unit.',
    waitTime: '12 min ER wait'
  },
  {
    id: 'mum-hosp-2',
    name: 'Lilavati Hospital & Research Centre',
    type: 'hospital',
    lat: 19.0514,
    lng: 72.8267,
    details: 'General emergency admissions, Cardiology unit.',
    waitTime: '45 min ER wait'
  },

  // Bengaluru
  {
    id: 'blr-sh-1',
    name: 'Koramangala Community cot Haven',
    type: 'shelter',
    lat: 12.9352,
    lng: 77.6244,
    details: 'Backup generator active. Accepts pets.',
    occupancy: '180/300 occupied'
  },
  {
    id: 'blr-sh-2',
    name: 'Whitefield Relief Camp',
    type: 'shelter',
    lat: 12.9698,
    lng: 77.7500,
    details: 'At maximum capacity. Diverting newcomers to Koramangala.',
    occupancy: '250/250 (FULL)'
  },
  {
    id: 'blr-hosp-1',
    name: 'Manipal Hospital Old Airport Road',
    type: 'hospital',
    lat: 12.9592,
    lng: 77.6450,
    details: 'Trauma Level 1, ICU emergency operations.',
    waitTime: '8 min ER wait'
  },
  {
    id: 'blr-hosp-2',
    name: 'Narayana Health City',
    type: 'hospital',
    lat: 12.8090,
    lng: 77.6950,
    details: 'General emergency triage care, Pediatrics.',
    waitTime: '25 min ER wait'
  }
];

export default function InteractiveMap({ alerts, isDarkMode = true }: InteractiveMapProps) {
  // Determine map view center based on alerts
  // If the last alert is for Bengaluru, center on Bengaluru, otherwise default to Mumbai
  const hasBengaluruAlert = alerts.some(a => a.location.toLowerCase().includes('bengaluru'));
  const centerPosition: [number, number] = hasBengaluruAlert ? [12.9716, 77.5946] : [19.0760, 72.8777];
  const zoomLevel = 13;

  // Filter markers matching the current active center city
  const activeMarkers = MOCK_MAP_MARKERS.filter(m => {
    if (hasBengaluruAlert) {
      return m.lat < 15.0; // South India / Bengaluru bounds
    }
    return m.lat > 15.0; // West India / Mumbai bounds
  });

  return (
    <MapContainer 
      center={centerPosition} 
      zoom={zoomLevel} 
      scrollWheelZoom={true}
      className="w-full h-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={isDarkMode ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"}
      />

      {/* Renders active threat zone circle markers based on Alerts */}
      {alerts.map(a => {
        const isMiami = a.location.toLowerCase().includes('miami');
        const circlePos: [number, number] = isMiami ? [25.7617, -80.1918] : [47.6062, -122.3321];
        
        return (
          <Circle
            key={a.id}
            center={circlePos}
            pathOptions={{
              color: a.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
              fillColor: a.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
              fillOpacity: 0.15,
              weight: 2
            }}
            radius={a.severity === 'CRITICAL' ? 1800 : 1000}
          />
        );
      })}

      {/* Loop over active shelter and hospital markers */}
      {activeMarkers.map(m => {
        const isShelter = m.type === 'shelter';
        const symbol = isShelter ? '🏠' : '🏥';
        const color = isShelter ? 'emerald' : 'blue';
        const markerIcon = createDynamicIcon(symbol, color);

        return (
          <Marker 
            key={m.id} 
            position={[m.lat, m.lng]} 
            icon={markerIcon}
          >
            <Popup className="leaflet-popup-dark">
              <div className={`p-2.5 rounded-lg text-xs leading-relaxed max-w-xs ${
                isDarkMode ? 'text-slate-100 bg-slate-900 border border-slate-800' : 'text-slate-900 bg-white border border-slate-200 shadow-sm'
              }`}>
                <div className={`flex items-center gap-1.5 font-extrabold text-sm mb-1.5 border-b pb-1 ${
                  isDarkMode ? 'border-slate-800 text-slate-200' : 'border-slate-100 text-slate-800'
                }`}>
                  <span>{symbol}</span>
                  <span>{m.name}</span>
                </div>
                <p className={`text-[11px] font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-655'}`}>{m.details}</p>
                {isShelter ? (
                  <div className={`flex items-center justify-between text-[10px] py-1 px-2 rounded ${
                    isDarkMode ? 'bg-emerald-950/30 border border-emerald-900/30 text-emerald-450' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  }`}>
                    <span>Capacity:</span>
                    <strong className="font-extrabold">{m.occupancy}</strong>
                  </div>
                ) : (
                  <div className={`flex items-center justify-between text-[10px] py-1 px-2 rounded ${
                    isDarkMode ? 'bg-blue-955/30 border border-blue-900/30 text-blue-450' : 'bg-blue-50 border border-blue-200 text-blue-800'
                  }`}>
                    <span>ER Wait:</span>
                    <strong className="font-extrabold">{m.waitTime}</strong>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
