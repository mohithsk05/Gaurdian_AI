import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, MessageSquare, Map, PhoneCall, CheckSquare, 
  LogOut, Sun, Moon, AlertTriangle, 
  UserCheck, Plus, RefreshCw, Radio, User, Lock
} from 'lucide-react';
import AlertCards from './components/AlertCards';
import ChatInterface from './components/ChatInterface';
import InteractiveMap from './components/InteractiveMap';
import ChecklistPanel from './components/ChecklistPanel';

const API_BASE = 'http://localhost:8000/api/v1';

export interface User {
  id: number;
  username: string;
  role: 'USER' | 'RESPONDER';
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  location: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>('');
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  
  // Login Form States
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleInput, setRoleInput] = useState<'USER' | 'RESPONDER'>('USER');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Load User details if token exists
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchCurrentUser();
      fetchConversations();
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  // Load alerts and helplines
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 20000); // refresh every 20s
    return () => clearInterval(interval);
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        // Token expired or invalid
        handleLogout();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAlerts = async () => {
    setIsLoadingAlerts(true);
    try {
      const response = await fetch(`${API_BASE}/alerts`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  const fetchConversations = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        if (data.length > 0 && !selectedConvId) {
          setSelectedConvId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      if (isRegistering) {
        const response = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput,
            password: passwordInput,
            role: roleInput
          })
        });
        const data = await response.json();
        if (response.ok) {
          setAuthSuccess('Registration successful! Please login.');
          setIsRegistering(false);
          setPasswordInput('');
        } else {
          setAuthError(data.detail || 'Registration failed.');
        }
      } else {
        // Login requires form urlencoded data
        const formData = new URLSearchParams();
        formData.append('username', usernameInput);
        formData.append('password', passwordInput);

        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        const data = await response.json();
        if (response.ok) {
          setToken(data.access_token);
        } else {
          setAuthError(data.detail || 'Incorrect credentials.');
        }
      }
    } catch (err) {
      setAuthError('Backend connection failed. Is the server running?');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setConversations([]);
    setSelectedConvId('');
    localStorage.removeItem('token');
  };

  const createNewConversation = () => {
    const newId = `session-${Math.random().toString(36).substr(2, 9)}`;
    setSelectedConvId(newId);
    setActiveTab('chat');
  };

  const handlePreFill = (role: 'USER' | 'RESPONDER') => {
    if (role === 'USER') {
      setUsernameInput('citizen_jane');
      setPasswordInput('password123');
      setRoleInput('USER');
    } else {
      setUsernameInput('chief_john');
      setPasswordInput('password123');
      setRoleInput('RESPONDER');
    }
  };

  // Toggle Dark Mode (CSS class mapping)
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  if (!token) {
    // Auth login/register view
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 relative transition-colors duration-300 ${isDarkMode ? 'cyber-grid text-slate-100' : 'cyber-grid-light text-slate-900'}`}>
        {/* Decorative ambient spots */}
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-opacity duration-500 ${isDarkMode ? 'bg-red-500/10' : 'bg-red-500/5'}`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-opacity duration-500 ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-500/5'}`}></div>

        {/* Theme Toggle in Login */}
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-all ${isDarkMode ? 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border-slate-800 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 bg-white/60 border-slate-200 hover:bg-slate-100'}`}
            title="Toggle theme"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className={`w-full max-w-md glass-panel p-8 rounded-2xl border shadow-2xl relative z-10 transition-all ${isDarkMode ? 'border-slate-800/80 hover:border-slate-700/60' : 'border-slate-200/80 hover:border-slate-350'}`}>
          <div className="flex flex-col items-center mb-6">
            <div className={`p-3.5 rounded-2xl border text-red-500 mb-3 shadow-lg shadow-red-950/20 relative flex items-center justify-center ${isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-500/5 border-red-500/10'}`}>
              <ShieldAlert size={36} className="animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
              </span>
            </div>
            <h1 className="text-3xl font-black font-display tracking-tight text-center bg-gradient-to-r from-red-500 via-amber-500 to-red-600 bg-clip-text text-transparent">GuardianAI</h1>
            <p className={`text-xs mt-1 text-center font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-650'}`}>Disaster & Emergency Response System</p>
          </div>

          {/* Quick Pre-fills for Testing */}
          <div className={`mb-6 p-4 rounded-xl border flex flex-col gap-2.5 transition-all ${isDarkMode ? 'bg-slate-900/60 border-slate-800/60' : 'bg-slate-100 border-slate-250'}`}>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Identity Pre-fills:</span>
            <div className="flex gap-2.5">
              <button 
                onClick={() => handlePreFill('USER')}
                className={`flex-1 text-[11px] font-bold py-2 px-2.5 border rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700' 
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                }`}
              >
                <UserCheck size={12} className="text-slate-400" /> Citizen Jane
              </button>
              <button 
                onClick={() => handlePreFill('RESPONDER')}
                className={`flex-1 text-[11px] font-bold py-2 px-2.5 border rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                  isDarkMode 
                    ? 'bg-red-950/40 hover:bg-red-900/30 text-red-300 border-red-900/30' 
                    : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-sm'
                }`}
              >
                <Radio size={12} className="text-red-500" /> Chief John
              </button>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={14} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
                </span>
                <input 
                  type="text" 
                  required
                  placeholder="Enter username"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900/80 border-slate-800 text-slate-100 focus:border-slate-700 focus:ring-1 focus:ring-slate-700' 
                      : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-300'
                  }`}
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={14} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
                </span>
                <input 
                  type="password" 
                  required
                  placeholder="Password"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900/80 border-slate-800 text-slate-100 focus:border-slate-700 focus:ring-1 focus:ring-slate-700' 
                      : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-300'
                  }`}
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                />
              </div>
            </div>

            {isRegistering && (
              <div className="animate-fade-in">
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Role Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={() => setRoleInput('USER')}
                    className={`py-2 px-4 rounded-lg border text-xs font-bold transition-all ${
                      roleInput === 'USER' 
                        ? (isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-100 shadow-md' : 'bg-slate-200 border-slate-300 text-slate-900 shadow-sm')
                        : (isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-550' : 'bg-slate-50 border-slate-100 text-slate-450')
                    }`}
                  >
                    Citizen (User)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRoleInput('RESPONDER')}
                    className={`py-2 px-4 rounded-lg border text-xs font-bold transition-all ${
                      roleInput === 'RESPONDER' 
                        ? (isDarkMode ? 'bg-red-950 border-red-800 text-red-200 shadow-md' : 'bg-red-100 border-red-200 text-red-905 shadow-sm')
                        : (isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-550' : 'bg-slate-50 border-slate-100 text-slate-450')
                    }`}
                  >
                    Responder
                  </button>
                </div>
              </div>
            )}

            {authError && (
              <div className={`p-3 border text-xs rounded-lg flex gap-1.5 items-center animate-fade-in ${
                isDarkMode ? 'bg-red-950/40 border-red-900/30 text-red-300' : 'bg-red-50 border-red-100 text-red-700'
              }`}>
                <AlertTriangle size={15} className="shrink-0" />
                <span className="font-medium">{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className={`p-3 border text-xs rounded-lg flex gap-1.5 items-center animate-fade-in ${
                isDarkMode ? 'bg-emerald-950/40 border-emerald-900/30 text-emerald-300' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
              }`}>
                <UserCheck size={15} className="shrink-0" />
                <span className="font-medium">{authSuccess}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={authLoading}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 hover:shadow-red-800/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {authLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Processing Authentication...
                </>
              ) : (
                isRegistering ? 'Create Secure Profile' : 'Authenticate Securely'
              )}
            </button>
          </form>

          <div className={`mt-6 pt-4 border-t text-center ${isDarkMode ? 'border-slate-900' : 'border-slate-200'}`}>
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError('');
                setAuthSuccess('');
              }}
              className={`text-xs underline underline-offset-4 font-medium transition-colors ${isDarkMode ? 'text-slate-450 hover:text-slate-300' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {isRegistering ? 'Already registered? Log in here' : "First time? Create a new secure key profile"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Logged-in view
  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'light-mode bg-slate-50 text-slate-900'}`}>
      
      {/* 1. HEADER */}
      <header className={`h-16 border-b px-6 flex items-center justify-between shrink-0 glass-panel sticky top-0 z-50 transition-all ${isDarkMode ? 'border-slate-900/80 bg-slate-950/70' : 'border-slate-200/80 bg-white/70'}`}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-red-500/10 rounded-lg border border-red-500/25 text-red-500">
            <ShieldAlert size={22} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black font-display tracking-tight flex items-center gap-1.5">
              GuardianAI
              <span className="text-[9px] uppercase font-black tracking-widest px-2 py-0.5 bg-red-500/15 border border-red-500/20 text-red-400 rounded-full animate-pulse">
                Live Ops
              </span>
            </h1>
          </div>
        </div>

        {/* Center Alert Indicator */}
        <div className={`hidden md:flex items-center gap-2 text-xs py-1.5 px-3.5 border rounded-full ${isDarkMode ? 'bg-slate-900/80 border-slate-800/80 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="font-semibold">Active Warnings:</span>
          <span className="font-bold text-red-500 dark:text-red-400">{alerts.length} Locations</span>
        </div>

        {/* Profile and Settings */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs ${isDarkMode ? 'bg-slate-900/60 border-slate-805 text-slate-350' : 'bg-slate-100 border-slate-250 text-slate-700'}`}>
            <UserCheck size={14} className="text-slate-400" />
            <span className="font-bold">{user?.username}</span>
            <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-black border ${user?.role === 'RESPONDER' ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
              {user?.role}
            </span>
          </div>

          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-slate-800' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100 border-slate-200'}`}
            title="Toggle theme"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button 
            onClick={handleLogout}
            className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-colors flex items-center gap-1 text-xs cursor-pointer"
            title="Log out session"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline font-bold">Logout</span>
          </button>
        </div>
      </header>

      {/* 2. BODY CONTAINER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className={`w-64 border-r shrink-0 hidden md:flex flex-col p-4 justify-between transition-all ${isDarkMode ? 'border-slate-905 bg-slate-950/20' : 'border-slate-200/80 bg-slate-50/20'}`}>
          <div className="space-y-6">
            <div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-450'}`}>Navigation</span>
              <nav className="mt-2 space-y-1.5">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'dashboard' 
                      ? (isDarkMode ? 'bg-slate-900/85 text-red-400 border-l-2 border-red-500 shadow-md shadow-red-950/5' : 'bg-slate-200/85 text-red-750 border-l-2 border-red-600 shadow-sm') 
                      : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40' : 'text-slate-605 hover:text-slate-900 hover:bg-slate-100')
                  }`}
                >
                  <ShieldAlert size={16} />
                  <span>Disaster Dashboard</span>
                </button>

                <button 
                  onClick={() => {
                    if (conversations.length === 0) {
                      createNewConversation();
                    } else {
                      setActiveTab('chat');
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'chat' 
                      ? (isDarkMode ? 'bg-slate-900/85 text-red-400 border-l-2 border-red-500 shadow-md shadow-red-950/5' : 'bg-slate-200/85 text-red-750 border-l-2 border-red-600 shadow-sm') 
                      : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40' : 'text-slate-605 hover:text-slate-900 hover:bg-slate-100')
                  }`}
                >
                  <MessageSquare size={16} />
                  <span>Agent Coordination</span>
                </button>

                <button 
                  onClick={() => setActiveTab('map')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'map' 
                      ? (isDarkMode ? 'bg-slate-900/85 text-red-400 border-l-2 border-red-500 shadow-md shadow-red-950/5' : 'bg-slate-200/85 text-red-750 border-l-2 border-red-600 shadow-sm') 
                      : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40' : 'text-slate-605 hover:text-slate-900 hover:bg-slate-100')
                  }`}
                >
                  <Map size={16} />
                  <span>Interactive Map</span>
                </button>

                <button 
                  onClick={() => setActiveTab('kits')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'kits' 
                      ? (isDarkMode ? 'bg-slate-900/85 text-red-400 border-l-2 border-red-500 shadow-md shadow-red-950/5' : 'bg-slate-200/85 text-red-750 border-l-2 border-red-600 shadow-sm') 
                      : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40' : 'text-slate-605 hover:text-slate-900 hover:bg-slate-100')
                  }`}
                >
                  <CheckSquare size={16} />
                  <span>Emergency Kits & Contacts</span>
                </button>
              </nav>
            </div>

            {/* Conversation History Sidebar Block */}
            {conversations.length > 0 && (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between px-2 mb-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-450'}`}>Recent Chats</span>
                  <button 
                    onClick={createNewConversation}
                    className={`p-1 rounded border transition-colors cursor-pointer ${
                      isDarkMode 
                        ? 'border-slate-800 hover:bg-slate-900 text-slate-450 hover:text-slate-200' 
                        : 'border-slate-200 hover:bg-slate-100 text-slate-550 hover:text-slate-805'
                    }`}
                    title="New coordination chat"
                  >
                    <Plus size={11} />
                  </button>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                  {conversations.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedConvId(c.id);
                        setActiveTab('chat');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate block transition-all font-medium cursor-pointer ${
                        selectedConvId === c.id 
                          ? (isDarkMode ? 'bg-slate-900/80 text-red-400 border-l-2 border-red-500' : 'bg-slate-200 text-red-700 border-l-2 border-red-600') 
                          : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50')
                      }`}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={`pt-4 border-t ${isDarkMode ? 'border-slate-900' : 'border-slate-200'}`}>
            <div className={`p-3 rounded-xl border text-[11px] leading-relaxed transition-all ${
              isDarkMode ? 'bg-slate-900/40 border-slate-900/60 text-slate-400' : 'bg-slate-100/80 border-slate-200 text-slate-605'
            }`}>
              <strong className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>ADK Multi-Agent Orchestrator</strong> delegates goals dynamically to Weather, Medical, Shelter, Resource, and Communication sub-agents.
            </div>
          </div>
        </aside>

        {/* MAIN DISPLAY AREA */}
        <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
          
          {/* Mobile Bottom Navigation Bar */}
          <div className={`md:hidden flex border-b px-2 py-1.5 justify-around sticky top-0 z-40 transition-colors ${isDarkMode ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-white/80'}`}>
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`p-2 flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer ${activeTab === 'dashboard' ? 'text-red-500' : 'text-slate-400'}`}
            >
              <ShieldAlert size={16} />
              Dashboard
            </button>
            <button 
              onClick={() => {
                if (conversations.length === 0) createNewConversation();
                else setActiveTab('chat');
              }}
              className={`p-2 flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer ${activeTab === 'chat' ? 'text-red-500' : 'text-slate-400'}`}
            >
              <MessageSquare size={16} />
              Agent Chat
            </button>
            <button 
              onClick={() => setActiveTab('map')} 
              className={`p-2 flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer ${activeTab === 'map' ? 'text-red-500' : 'text-slate-400'}`}
            >
              <Map size={16} />
              Map
            </button>
            <button 
              onClick={() => setActiveTab('kits')} 
              className={`p-2 flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer ${activeTab === 'kits' ? 'text-red-500' : 'text-slate-400'}`}
            >
              <CheckSquare size={16} />
              Kits & Helplines
            </button>
          </div>

          {/* RENDERING DYNAMIC TABS */}
          <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* Hero Panel */}
                <div className={`glass-panel p-6 rounded-2xl border shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                  isDarkMode 
                    ? 'border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-red-950/20' 
                    : 'border-slate-200 bg-gradient-to-br from-white via-slate-50 to-red-50/20'
                }`}>
                  <div className={`absolute top-0 right-0 w-80 h-full bg-gradient-to-l pointer-events-none transition-opacity duration-300 ${isDarkMode ? 'from-red-500/5' : 'from-red-500/3'}`}></div>
                  <div className="relative z-10">
                    <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight leading-tight">Disaster Response Operations Command</h2>
                    <p className={`text-xs md:text-sm mt-1.5 max-w-2xl leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-655'}`}>
                      GuardianAI orchestrates dedicated agent networks to analyze emergencies, secure shelters, lookup emergency medical capacities, and translate broadcasts.
                    </p>
                  </div>
                  <button 
                    onClick={createNewConversation}
                    className="py-2.5 px-5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white rounded-lg font-bold text-xs shadow-md shadow-red-950/15 hover:shadow-red-800/25 active:scale-95 transition-all shrink-0 flex items-center gap-2 cursor-pointer z-10"
                  >
                    <MessageSquare size={14} /> Initiate AI Response
                  </button>
                </div>

                {/* Dashboard grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Warning Cards */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold font-display flex items-center gap-2">
                        <AlertTriangle size={18} className="text-amber-500 animate-bounce" /> Active Threat Feed
                      </h3>
                      <button 
                        onClick={fetchAlerts}
                        disabled={isLoadingAlerts}
                        className={`text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer font-semibold ${isDarkMode ? 'text-slate-450 hover:text-slate-205' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        <RefreshCw size={12} className={isLoadingAlerts ? 'animate-spin' : ''} /> Refresh
                      </button>
                    </div>

                    <AlertCards 
                      alerts={alerts} 
                      user={user} 
                      onNewAlertAdded={fetchAlerts}
                      token={token || ''}
                      API_BASE={API_BASE}
                      isDarkMode={isDarkMode}
                    />
                  </div>

                  {/* Right Column: Mini Widgets */}
                  <div className="space-y-6">
                    {/* Live Info Widget */}
                    <div className={`glass-card p-5 rounded-xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-200 shadow-sm'}`}>
                      <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        <PhoneCall size={14} className="text-red-500" /> Essential Numbers (Mumbai)
                      </h3>
                      <div className="space-y-2.5">
                        <div className={`flex justify-between items-center py-2.5 px-3 border rounded-lg transition-colors ${
                          isDarkMode ? 'bg-slate-900/60 border-slate-800/30' : 'bg-slate-100/50 border-slate-200'
                        }`}>
                          <div>
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Mumbai Disaster Control</p>
                            <p className="text-[10px] text-slate-500">Local Dispatch</p>
                          </div>
                          <span className="font-bold text-red-500 dark:text-red-400 text-xs px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded">022-22694727</span>
                        </div>
                        <div className={`flex justify-between items-center py-2.5 px-3 border rounded-lg transition-colors ${
                          isDarkMode ? 'bg-slate-900/60 border-slate-800/30' : 'bg-slate-100/50 border-slate-200'
                        }`}>
                          <div>
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>NDRF Maharashtra</p>
                            <p className="text-[10px] text-slate-550">State Logistics</p>
                          </div>
                          <span className="font-bold text-red-500 dark:text-red-400 text-xs px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded">022-22027990</span>
                        </div>
                        <div className={`flex justify-between items-center py-2.5 px-3 border rounded-lg transition-colors ${
                          isDarkMode ? 'bg-slate-900/60 border-slate-800/30' : 'bg-slate-100/50 border-slate-200'
                        }`}>
                          <div>
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>NDMA National Helpline</p>
                            <p className="text-[10px] text-slate-550">Federal Support</p>
                          </div>
                          <span className="font-bold text-red-500 dark:text-red-400 text-xs px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded">011-26701728</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab('kits')}
                        className={`mt-4 w-full py-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                          isDarkMode 
                            ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300' 
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
                        }`}
                      >
                        View Full Helpline Directory
                      </button>
                    </div>

                    {/* Quick Instructions checklist */}
                    <div className={`glass-card p-5 rounded-xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-200 shadow-sm'}`}>
                      <h3 className={`text-xs font-bold uppercase tracking-wider mb-3.5 flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        <CheckSquare size={14} className="text-amber-500 animate-pulse" /> Immediate Evacuation Guide
                      </h3>
                      <ul className={`text-xs space-y-2 list-decimal list-inside leading-relaxed ${isDarkMode ? 'text-slate-305' : 'text-slate-655'}`}>
                        <li>Grab your Go-Bag containing vital paper credentials, water bottles, and medicine prescriptions.</li>
                        <li>Shut off gas main valves and standard circuit breakers before departing.</li>
                        <li>Check the <strong className="text-red-500 dark:text-red-400">Interactive Map</strong> tab for open safe havens in your sector.</li>
                        <li>Avoid walking or driving through water currents of any depth.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <ChatInterface 
                token={token || ''}
                conversationId={selectedConvId}
                API_BASE={API_BASE}
                onCreateNew={createNewConversation}
                onMsgAdded={fetchConversations}
                isDarkMode={isDarkMode}
              />
            )}

            {activeTab === 'map' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold font-display">Interactive Emergency Map</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Displaying open safe havens, medical facility wait times, and danger radii.</p>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded font-bold uppercase tracking-wider animate-pulse">
                    OSM Tiles Connected
                  </span>
                </div>
                
                {/* Renders leaflet map wrapper */}
                <div className={`h-[600px] border rounded-xl overflow-hidden shadow-2xl relative transition-all ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <InteractiveMap alerts={alerts} isDarkMode={isDarkMode} />
                </div>
              </div>
            )}

            {activeTab === 'kits' && (
              <ChecklistPanel API_BASE={API_BASE} isDarkMode={isDarkMode} />
            )}
          </div>
        </main>
      </div>
      
      {/* 3. FOOTER */}
      <footer className={`h-10 border-t px-6 flex items-center justify-between shrink-0 text-[10px] font-medium transition-all ${isDarkMode ? 'border-slate-900 text-slate-500' : 'border-slate-200 text-slate-500 bg-white/30'}`}>
        <span>© 2026 GuardianAI Inc. Secure ADK Multi-Agent Orchestrator.</span>
        <span>Secure Sandbox Node Session</span>
      </footer>
    </div>
  );
}
