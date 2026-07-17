import { useState, useEffect } from 'react';
import { PhoneCall, CheckSquare, ShieldCheck, MapPin, RefreshCw, AlertTriangle } from 'lucide-react';

interface Contact {
  name: string;
  number: string;
  hours: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  category: 'flood' | 'hurricane' | 'winter';
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  // Flood
  { id: 'fl-1', text: 'Store at least 1 gallon of water per person per day (for at least 3 days)', category: 'flood' },
  { id: 'fl-2', text: 'Collect and seal vital credentials, ID cards, and deeds in waterproof bags', category: 'flood' },
  { id: 'fl-3', text: 'Gather a 3-day supply of non-perishable, shelf-stable canned items', category: 'flood' },
  { id: 'fl-4', text: 'Charge all portable power banks and backup communication batteries', category: 'flood' },
  { id: 'fl-5', text: 'Identify local evacuation routes and verify nearby shelter locations', category: 'flood' },
  
  // Hurricane
  { id: 'hu-1', text: 'Board up windows using plywood panels or close hurricane shutters', category: 'hurricane' },
  { id: 'hu-2', text: 'Bring loose outdoor patio objects, trash cans, and bikes indoors', category: 'hurricane' },
  { id: 'hu-3', text: 'Fill vehicle gas tanks and verify portable generator fuel levels', category: 'hurricane' },
  { id: 'hu-4', text: 'Set refrigerator and freezer to the coldest setting to prevent food spoilage', category: 'hurricane' },
  { id: 'hu-5', text: 'Pack a dedicated first-aid kit with 7 days of prescription medications', category: 'hurricane' },

  // Winter
  { id: 'wi-1', text: 'Drip indoor faucets to prevent pipes from freezing and bursting', category: 'winter' },
  { id: 'wi-2', text: 'Layer heavy clothing, thermal underwear, blankets, and sleeping bags', category: 'winter' },
  { id: 'wi-3', text: 'Verify smoke detectors and carbon monoxide sensors are operational', category: 'winter' },
  { id: 'wi-4', text: 'Keep alternative heating units (e.g. wood stove) vented and supplied', category: 'winter' },
  { id: 'wi-5', text: 'Insulate windows with plastic wrapping or heavy curtains', category: 'winter' }
];

interface ChecklistPanelProps {
  API_BASE: string;
  isDarkMode: boolean;
}

export default function ChecklistPanel({ API_BASE, isDarkMode }: ChecklistPanelProps) {
  const [activeCategory, setActiveCategory] = useState<'flood' | 'hurricane' | 'winter'>('flood');
  const [regionInput, setRegionInput] = useState('Mumbai');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsRegion, setContactsRegion] = useState('');
  
  // Load checked items from LocalStorage
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('guardian_checklist_items');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('guardian_checklist_items', JSON.stringify(checkedItems));
  }, [checkedItems]);

  useEffect(() => {
    fetchHelplines(regionInput);
  }, []);

  const fetchHelplines = async (region: string) => {
    setLoadingContacts(true);
    try {
      const response = await fetch(`${API_BASE}/helplines?region=${encodeURIComponent(region)}`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
        setContactsRegion(data.region || region);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleToggle = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleClearCategory = () => {
    const itemsToClear = CHECKLIST_ITEMS.filter(item => item.category === activeCategory).map(item => item.id);
    setCheckedItems(prev => {
      const copy = { ...prev };
      itemsToClear.forEach(id => {
        delete copy[id];
      });
      return copy;
    });
  };

  const filteredItems = CHECKLIST_ITEMS.filter(item => item.category === activeCategory);
  const completedCount = filteredItems.filter(item => checkedItems[item.id]).length;
  const progressPercent = Math.round((completedCount / filteredItems.length) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. LEFT PANEL: Interactive Checklists (2 cols) */}
      <div className={`lg:col-span-2 glass-panel p-6 rounded-2xl border shadow-xl flex flex-col justify-between ${
        isDarkMode ? 'border-slate-805 bg-slate-950/20' : 'border-slate-200 bg-white/40'
      }`}>
        <div>
          <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDarkMode ? 'border-slate-900' : 'border-slate-200'}`}>
            <h2 className="text-xl font-bold font-display flex items-center gap-2">
              <CheckSquare size={20} className="text-red-500" /> Emergency Preparedness Checklists
            </h2>
            <button
              onClick={handleClearCategory}
              className={`text-[10px] uppercase font-bold border py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
                isDarkMode 
                  ? 'border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-205' 
                  : 'border-slate-205 hover:bg-slate-100 text-slate-600 hover:text-slate-900 shadow-xs'
              }`}
            >
              Reset List
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2.5 mb-6">
            {(['flood', 'hurricane', 'winter'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg border uppercase tracking-wider transition-all cursor-pointer ${
                  activeCategory === cat
                    ? isDarkMode 
                      ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-sm' 
                      : 'bg-slate-200 border-slate-300 text-slate-800 shadow-sm'
                    : isDarkMode 
                      ? 'bg-slate-950/40 border-slate-900 text-slate-450 hover:text-slate-205 hover:bg-slate-900/30' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {cat} checklist
              </button>
            ))}
          </div>

          {/* Progress Indicator */}
          <div className={`mb-6 p-4 rounded-xl border ${
            isDarkMode ? 'bg-slate-900/30 border-slate-900/60' : 'bg-slate-100/40 border-slate-200 shadow-xs'
          }`}>
            <div className="flex justify-between items-center text-xs font-bold mb-2">
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Survival Preparation Progress:</span>
              <span className="text-red-500 dark:text-red-400">{completedCount} of {filteredItems.length} Secured ({progressPercent}%)</span>
            </div>
            <div className={`w-full rounded-full h-2 border ${isDarkMode ? 'bg-slate-950 border-slate-900' : 'bg-slate-100 border-slate-200/50'}`}>
              <div 
                className="bg-gradient-to-r from-red-500 to-emerald-500 h-1.8 rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>

          {/* List Items Loop */}
          <div className="space-y-3">
            {filteredItems.map(item => {
              const isChecked = checkedItems[item.id] || false;
              return (
                <button
                  key={item.id}
                  onClick={() => handleToggle(item.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 focus:outline-none cursor-pointer ${
                    isChecked
                      ? isDarkMode 
                        ? 'bg-emerald-950/10 border-emerald-900/20 text-slate-400' 
                        : 'bg-emerald-50/20 border-emerald-200/60 text-slate-500 shadow-xs'
                      : isDarkMode 
                        ? 'bg-slate-900/35 border-slate-900 text-slate-200 hover:border-slate-800' 
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-350 hover:shadow-xs'
                  }`}
                >
                  <div className={`mt-0.5 w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                    isChecked 
                      ? 'bg-emerald-500 border-emerald-400 text-white' 
                      : isDarkMode ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'
                  }`}>
                    {isChecked && <ShieldCheck size={12} />}
                  </div>
                  <span className={`text-xs md:text-sm font-semibold leading-relaxed ${isChecked ? 'line-through opacity-60' : ''}`}>
                    {item.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-900/20 text-slate-500 text-[10px] leading-relaxed">
          ⚠️ *Disclaimer: Supply checklists are standard guidelines. Check active advisories for location-specific directives.*
        </div>
      </div>

      {/* 2. RIGHT PANEL: Helpline Lookup Directory (1 col) */}
      <div className={`glass-panel p-5 rounded-2xl border shadow-xl space-y-4 ${
        isDarkMode ? 'border-slate-805 bg-slate-950/20' : 'border-slate-200 bg-white/40'
      }`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <PhoneCall size={15} className="text-red-500" /> Helpline Directory Lookup
        </h3>

        {/* Directory Form Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Seattle or Miami"
            className={`flex-1 px-3 py-2 rounded text-xs focus:outline-none transition-all ${
              isDarkMode 
                ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-slate-700 focus:ring-1 focus:ring-slate-700' 
                : 'bg-slate-50 border-slate-205 text-slate-900 focus:border-slate-350 focus:ring-1 focus:ring-slate-200'
            }`}
            value={regionInput}
            onChange={e => setRegionInput(e.target.value)}
          />
          <button
            onClick={() => fetchHelplines(regionInput)}
            disabled={loadingContacts || !regionInput.trim()}
            className="py-1.5 px-3 bg-red-650 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-red-950/15"
          >
            {loadingContacts ? <RefreshCw size={12} className="animate-spin" /> : 'Find'}
          </button>
        </div>

        {/* Contacts Result View */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
          <div className={`flex items-center gap-1 text-[10px] pb-1.5 border-b mb-2 ${isDarkMode ? 'text-slate-450 border-slate-900' : 'text-slate-550 border-slate-100'}`}>
            <MapPin size={10} className="text-red-505" />
            <span>Region directory: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{contactsRegion || 'Seattle'}</strong></span>
          </div>

          {contacts.length === 0 ? (
            <div className={`p-6 text-center text-xs border rounded-xl ${
              isDarkMode ? 'bg-slate-950/20 border-slate-900 text-slate-500' : 'bg-slate-50 border-slate-150 text-slate-500'
            }`}>
              No contacts loaded for this region.
            </div>
          ) : (
            contacts.map((c, idx) => (
              <div key={idx} className={`p-3 border rounded-xl flex flex-col gap-1.5 transition-all hover:translate-x-0.5 ${
                isDarkMode 
                  ? 'bg-slate-900/60 border-slate-805/50 text-slate-300' 
                  : 'bg-white border-slate-200 text-slate-800 shadow-xs hover:shadow-sm'
              }`}>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-bold">{c.name}</span>
                  <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.2 rounded font-black border ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}>
                    {c.hours}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Contact Number:</span>
                  <a 
                    href={`tel:${c.number}`}
                    className="font-mono font-black text-red-500 dark:text-red-400 hover:underline"
                  >
                    {c.number}
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* General Disaster advisory warning */}
        <div className={`p-3.5 border text-[10px] rounded-lg leading-relaxed flex gap-2.5 ${
          isDarkMode ? 'bg-amber-955/10 border-amber-900/20 text-amber-300' : 'bg-amber-50/40 border-amber-200 text-amber-900 shadow-xs'
        }`}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5 animate-pulse text-amber-500" />
          <span>If you are facing immediate physical harm or a life-threatening incident, dial <strong className="font-extrabold text-red-550">911</strong> immediately instead of contacting regional logistics.</span>
        </div>
      </div>

    </div>
  );
}
