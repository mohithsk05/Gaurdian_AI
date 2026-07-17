import React, { useState } from 'react';
import { AlertTriangle, MapPin, Clock, Plus, ShieldAlert, X } from 'lucide-react';
import type { Alert, User } from '../App';

interface AlertCardsProps {
  alerts: Alert[];
  user: User | null;
  onNewAlertAdded: () => void;
  token: string;
  API_BASE: string;
  isDarkMode: boolean;
}

export default function AlertCards({ alerts, user, onNewAlertAdded, token, API_BASE, isDarkMode }: AlertCardsProps) {
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    // Client-side validations
    if (title.trim().length < 3) {
      setErrorMsg('Title must be at least 3 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setErrorMsg('Description must be at least 10 characters.');
      return;
    }
    if (location.trim().length < 2) {
      setErrorMsg('Location must be at least 2 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title, description, location, severity })
      });
      const data = await response.json();
      if (response.ok) {
        setTitle('');
        setDescription('');
        setLocation('');
        setSeverity('MEDIUM');
        setShowDispatchForm(false);
        onNewAlertAdded();
      } else {
        setErrorMsg(data.detail || 'Failed to publish alert.');
      }
    } catch (err) {
      setErrorMsg('Could not connect to service endpoint.');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return isDarkMode 
          ? 'bg-red-955/20 border-red-500/30 text-red-200 hover:border-red-500/50 shadow-lg shadow-red-950/20 glow-critical' 
          : 'bg-red-50/50 border-red-200 text-red-900 hover:border-red-450 shadow-md shadow-red-100 glow-critical';
      case 'HIGH':
        return isDarkMode 
          ? 'bg-amber-955/15 border-amber-600/35 text-amber-205 hover:border-amber-600/55 glow-high' 
          : 'bg-amber-50/40 border-amber-205 text-amber-900 hover:border-amber-400 shadow-sm glow-high';
      case 'MEDIUM':
        return isDarkMode 
          ? 'bg-slate-900/60 border-yellow-600/20 text-yellow-105 hover:border-yellow-600/40 glow-medium' 
          : 'bg-yellow-50/30 border-yellow-200 text-yellow-905 hover:border-yellow-350 shadow-sm glow-medium';
      default:
        return isDarkMode 
          ? 'bg-slate-900/40 border-slate-800 text-slate-300 hover:border-slate-700 glow-low' 
          : 'bg-slate-50 border-slate-205 text-slate-700 hover:border-slate-300 shadow-sm glow-low';
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return isDarkMode 
          ? 'bg-red-500/20 text-red-450 border border-red-500/30 font-extrabold animate-pulse' 
          : 'bg-red-100 text-red-750 border border-red-200 font-extrabold animate-pulse';
      case 'HIGH':
        return isDarkMode 
          ? 'bg-amber-500/20 text-amber-450 border border-amber-500/30 font-bold' 
          : 'bg-amber-100 text-amber-750 border border-amber-200 font-bold';
      case 'MEDIUM':
        return isDarkMode 
          ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' 
          : 'bg-yellow-105 text-yellow-800 border border-yellow-200';
      default:
        return isDarkMode 
          ? 'bg-slate-850 text-slate-450 border border-slate-705' 
          : 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Responder Publication Box Trigger */}
      {user?.role === 'RESPONDER' && (
        <div className={`border p-4 rounded-xl flex items-center justify-between gap-4 transition-all ${
          isDarkMode ? 'bg-slate-900/60 border-red-950 text-red-250' : 'bg-red-50/40 border-red-200 text-red-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-500 border border-red-500/20">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="text-sm font-bold">Responder Operations Mode Active</p>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>You are authorized to broadcast emergency disaster warnings.</p>
            </div>
          </div>
          <button
            onClick={() => setShowDispatchForm(!showDispatchForm)}
            className="py-1.5 px-3 bg-red-605 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-md shadow-red-900/10"
          >
            {showDispatchForm ? <X size={14} /> : <Plus size={14} />} 
            {showDispatchForm ? 'Close Dispatch' : 'Publish Alert'}
          </button>
        </div>
      )}

      {/* 2. Emergency Alert Publication Form */}
      {showDispatchForm && (
        <form onSubmit={handleDispatch} className={`glass-card p-5 rounded-xl border space-y-4 animate-fade-in ${
          isDarkMode ? 'border-red-900/20' : 'border-red-200 shadow-md bg-white'
        }`}>
          <h4 className="text-sm font-bold text-red-505 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle size={14} /> Publish Urgent Safety Alert
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Alert Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Severe Flash Flood Warning"
                className={`w-full px-3 py-2 rounded focus:outline-none text-xs transition-all ${
                  isDarkMode 
                    ? 'bg-slate-950 border-slate-800 text-slate-205 focus:border-slate-700' 
                    : 'bg-slate-50 border-slate-205 text-slate-900 focus:border-slate-350'
                }`}
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Target Location</label>
              <input
                type="text"
                required
                placeholder="e.g. Seattle or Miami"
                className={`w-full px-3 py-2 rounded focus:outline-none text-xs transition-all ${
                  isDarkMode 
                    ? 'bg-slate-950 border-slate-800 text-slate-205 focus:border-slate-700' 
                    : 'bg-slate-50 border-slate-205 text-slate-900 focus:border-slate-350'
                }`}
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Emergency Level / Severity</label>
            <div className="grid grid-cols-4 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(level => (
                <button
                  type="button"
                  key={level}
                  onClick={() => setSeverity(level)}
                  className={`py-1.5 px-2 rounded text-[10px] font-extrabold border transition-all cursor-pointer ${
                    severity === level
                      ? level === 'CRITICAL' ? 'bg-red-650 border-red-500 text-white shadow-md' :
                        level === 'HIGH' ? 'bg-amber-600 border-amber-500 text-white shadow-md' :
                        level === 'MEDIUM' ? 'bg-yellow-600 border-yellow-500 text-white shadow-md' :
                        'bg-slate-700 border-slate-600 text-white shadow-md'
                      : isDarkMode 
                        ? 'bg-slate-950 border-slate-850 text-slate-400' 
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Notice Description</label>
            <textarea
              required
              rows={3}
              placeholder="Provide explicit details and immediate evacuation instructions..."
              className={`w-full px-3 py-2 rounded focus:outline-none text-xs transition-all ${
                isDarkMode 
                  ? 'bg-slate-950 border-slate-800 text-slate-205 focus:border-slate-700' 
                  : 'bg-slate-50 border-slate-205 text-slate-900 focus:border-slate-350'
              }`}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {errorMsg && (
            <p className="text-red-500 text-xs font-bold animate-pulse">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-md active:scale-98 cursor-pointer"
          >
            {submitting ? 'Broadcasting Alert...' : 'Broadcast Immediate Warning'}
          </button>
        </form>
      )}

      {/* 3. Alerts Loop */}
      {alerts.length === 0 ? (
        <div className={`p-8 text-center border rounded-xl ${
          isDarkMode ? 'bg-slate-900/20 border-slate-800/60 text-slate-450' : 'bg-slate-50 border-slate-200 text-slate-505'
        }`}>
          <p className="text-sm font-medium">No active threat advisories found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map(a => (
            <div
              key={a.id}
              className={`p-5 rounded-xl border transition-all duration-300 flex flex-col justify-between ${getSeverityStyle(a.severity)}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-black ${getSeverityBadge(a.severity)}`}>
                    {a.severity}
                  </span>
                  <div className={`flex items-center gap-1 text-[10px] font-medium ${isDarkMode ? 'text-slate-450' : 'text-slate-500'}`}>
                    <Clock size={11} className="text-red-400" />
                    <span>{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <h4 className={`font-black font-display text-sm tracking-tight mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{a.title}</h4>
                <p className={`text-xs leading-relaxed mb-4 font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-655'}`}>{a.description}</p>
              </div>

              <div className={`flex items-center gap-1.5 border-t pt-3 text-[11px] font-bold ${
                isDarkMode ? 'border-slate-800/40 text-slate-400' : 'border-slate-200/80 text-slate-600'
              }`}>
                <MapPin size={12} className="text-red-500" />
                <span>Sector: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{a.location}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
