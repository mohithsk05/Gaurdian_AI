import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, RefreshCw, AlertTriangle, ShieldAlert, Sparkles, 
  HelpCircle, Info, Hospital, ClipboardList, Radio
} from 'lucide-react';
import Timeline from './Timeline';
import type { AgentTrace } from './Timeline';

interface ChatInterfaceProps {
  token: string;
  conversationId: string;
  API_BASE: string;
  onCreateNew: () => void;
  onMsgAdded: () => void;
  isDarkMode: boolean;
}

interface ChatMessage {
  id: number;
  sender: 'user' | 'coordinator' | 'agent';
  content: string;
  timeline_data?: AgentTrace[];
  created_at: string;
}

const SAMPLE_PROMPTS = [
  {
    label: "Mumbai Flood Response",
    text: "A severe flood is approaching Mumbai. Where is the nearest shelter? Tell me first-aid rules for minor water-borne infections, and write a warning broadcast in Hindi."
  },
  {
    label: "Bengaluru Storm Warning",
    text: "We have a severe thunderstorm coming to Bengaluru. Tell me active alerts, find open shelters, and write a radio broadcast warning."
  },
  {
    label: "Mumbai Hospital Search",
    text: "Find hospitals near Mumbai with available ICU beds and short ER wait times. What first aid should I prepare for wounds?"
  }
];

export default function ChatInterface({ token, conversationId, API_BASE, onCreateNew, onMsgAdded, isDarkMode }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTimeline, setActiveTimeline] = useState<AgentTrace[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
    } else {
      setMessages([]);
      setActiveTimeline([]);
    }
  }, [conversationId]);

  useEffect(() => {
    // Scroll chat to bottom on new message
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        
        // Find the last coordinator response containing timeline data
        const coordMsgs = data.filter((m: any) => m.sender === 'coordinator' && m.timeline_data && m.timeline_data.length > 0);
        if (coordMsgs.length > 0) {
          setActiveTimeline(coordMsgs[coordMsgs.length - 1].timeline_data);
        } else {
          setActiveTimeline([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async (e?: React.FormEvent, promptText?: string) => {
    if (e) e.preventDefault();
    const query = promptText || inputVal;
    if (!query.trim() || loading) return;

    setInputVal('');
    setErrorMsg('');
    setLoading(true);

    // Optimistically add user message to list
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      content: query,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: query,
          conversation_id: conversationId
        })
      });
      const data = await response.json();
      
      if (response.ok) {
        // Add coordinator response
        const tempCoordMsg: ChatMessage = {
          id: Date.now() + 1,
          sender: 'coordinator',
          content: data.response,
          timeline_data: data.timeline,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempCoordMsg]);
        if (data.timeline) {
          setActiveTimeline(data.timeline);
        }
        onMsgAdded(); // Notify App to refresh history
      } else {
        setErrorMsg(data.detail || 'An error occurred during multi-agent analysis.');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  // Parses response markdown chunks into tactical UI blocks
  const renderTacticalPlan = (content: string) => {
    if (!content.includes('## ')) {
      return <div className="whitespace-pre-line text-xs md:text-sm font-sans">{content}</div>;
    }

    const sections = content.split(/\n?(?=##\s)/);

    return (
      <div className="space-y-4 mt-2">
        {sections.map((section, idx) => {
          const trimmed = section.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith('## ')) {
            const lines = trimmed.split('\n');
            const headerLine = lines[0].replace('## ', '').trim();
            const bodyLines = lines.slice(1).join('\n').trim();

            let icon = <Info size={16} />;
            let cardStyle = isDarkMode 
              ? 'bg-slate-900/40 border-slate-805 text-slate-200' 
              : 'bg-slate-100/50 border-slate-200 text-slate-800';
            let titleStyle = 'text-slate-400 dark:text-slate-400 font-bold';

            if (headerLine.includes('Emergency Assessment') || headerLine.includes('Assessment') || headerLine.includes('🛑')) {
              icon = <AlertTriangle size={16} className="text-red-500 animate-pulse" />;
              cardStyle = isDarkMode 
                ? 'bg-red-955/10 border-red-500/20 text-red-200 glow-critical' 
                : 'bg-red-50/40 border-red-205 text-red-900';
              titleStyle = 'text-red-500 font-black';
            } else if (headerLine.includes('Shelter') || headerLine.includes('Hospital') || headerLine.includes('🏠')) {
              icon = <Hospital size={16} className="text-blue-500" />;
              cardStyle = isDarkMode 
                ? 'bg-blue-955/10 border-blue-500/20 text-blue-200' 
                : 'bg-blue-50/45 border-blue-205 text-blue-900';
              titleStyle = 'text-blue-500 font-black';
            } else if (headerLine.includes('Resource') || headerLine.includes('Checklist') || headerLine.includes('📦')) {
              icon = <ClipboardList size={16} className="text-emerald-500" />;
              cardStyle = isDarkMode 
                ? 'bg-emerald-955/10 border-emerald-500/20 text-emerald-200' 
                : 'bg-emerald-50/40 border-emerald-205 text-emerald-900';
              titleStyle = 'text-emerald-500 font-black';
            } else if (headerLine.includes('Broadcast') || headerLine.includes('Evacuation') || headerLine.includes('📢')) {
              icon = <Radio size={16} className="text-purple-500" />;
              cardStyle = isDarkMode 
                ? 'bg-purple-955/10 border-purple-500/20 text-purple-200' 
                : 'bg-purple-50/40 border-purple-205 text-purple-900';
              titleStyle = 'text-purple-500 font-black';
            }

            return (
              <div key={idx} className={`border rounded-xl p-4 shadow-sm transition-all ${cardStyle}`}>
                <div className="flex items-center gap-2 font-black text-xs md:text-sm uppercase tracking-wider mb-2.5 border-b pb-1.5 border-slate-800/10">
                  {icon}
                  <span className={titleStyle}>{headerLine}</span>
                </div>
                <div className="whitespace-pre-line text-xs md:text-sm leading-relaxed space-y-1 font-sans">
                  {bodyLines}
                </div>
              </div>
            );
          }

          if (trimmed.startsWith('# ')) {
            const lines = trimmed.split('\n');
            const titleLine = lines[0].replace('# ', '').trim();
            const remaining = lines.slice(1).join('\n').trim();

            return (
              <div key={idx} className="mb-4">
                <h2 className="text-base md:text-lg font-black font-display text-red-500 dark:text-red-400 mb-1.5 flex items-center gap-2">
                  <ShieldAlert size={20} />
                  {titleLine}
                </h2>
                {remaining && (
                  <div className="text-xs text-slate-400 dark:text-slate-400 font-medium whitespace-pre-line border-l border-slate-805 pl-3.5 py-0.5 leading-relaxed">
                    {remaining}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={idx} className="whitespace-pre-line text-xs md:text-sm font-sans my-2">
              {trimmed}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)] min-h-[500px]">
      
      {/* LEFT PANEL: Chat Client (2 cols) */}
      <div className={`lg:col-span-2 flex flex-col justify-between glass-panel rounded-2xl border shadow-xl overflow-hidden ${
        isDarkMode ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-white/40'
      }`}>
        
        {/* Chat Header */}
        <div className={`px-5 py-3 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? 'border-slate-900 bg-slate-950/20' : 'border-slate-200 bg-slate-50/20'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-red-500 dark:text-red-400 animate-pulse" />
            <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-655'}`}>AI Coordinator Agent Session</span>
          </div>
          <button
            onClick={onCreateNew}
            className={`py-1 px-3 border hover:bg-slate-100 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-slate-305 hover:bg-slate-800 hover:text-slate-100' 
                : 'bg-white border-slate-205 text-slate-750 hover:bg-slate-50'
            }`}
          >
            <Plus size={12} /> New Thread
          </button>
        </div>

        {/* Message Stream */}
        <div className={`flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar ${
          isDarkMode ? 'bg-slate-950/10' : 'bg-slate-50/5'
        }`}>
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-full text-slate-500 animate-pulse">
                <ShieldAlert size={36} />
              </div>
              <div className="max-w-md">
                <h4 className="font-extrabold font-display text-base tracking-tight text-slate-205">GuardianAI Multi-Agent Coordinator</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Submit an emergency description. The Coordinator Agent will automatically delegate goals to specialized sub-agents, pull real-time weather and maps resources, and formulate a unified emergency action plan.
                </p>
              </div>

              {/* Sample Prompts */}
              <div className="w-full max-w-lg space-y-2 pt-2 text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Click a Template to Test:</span>
                {SAMPLE_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(undefined, p.text)}
                    className={`w-full p-3.5 border text-left rounded-xl text-xs leading-normal transition-all hover:translate-x-1 flex gap-2.5 items-start cursor-pointer shadow-sm ${
                      isDarkMode 
                        ? 'bg-slate-900/40 border-slate-900 hover:border-slate-800 text-slate-300' 
                        : 'bg-white border-slate-200 hover:border-slate-305 text-slate-700 hover:shadow-md'
                    }`}
                  >
                    <HelpCircle size={14} className="text-slate-505 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-205 block mb-0.5">{p.label}</strong>
                      <span className="opacity-80">{p.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Loop */}
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}
            >
              <div className={`max-w-[85%] rounded-2xl p-4 text-xs md:text-sm leading-relaxed border ${
                m.sender === 'user'
                  ? 'bg-gradient-to-br from-red-600 to-red-750 border-red-505 text-white rounded-tr-none shadow-md shadow-red-950/15'
                  : isDarkMode 
                    ? 'bg-slate-900/80 border-slate-805 text-slate-100 rounded-tl-none' 
                    : 'bg-white border-slate-205 text-slate-900 rounded-tl-none shadow-sm'
              }`}>
                {m.sender !== 'user' && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 mb-2 border-b border-slate-800 pb-1">
                    <ShieldAlert size={12} />
                    <span>Emergency Response Plan Synthesis</span>
                  </div>
                )}
                
                {m.sender === 'user' ? (
                  <div className="whitespace-pre-line font-medium">{m.content}</div>
                ) : (
                  renderTacticalPlan(m.content)
                )}
              </div>
              
              <span className="text-[9px] text-slate-500 mt-1 px-1">
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {/* Loading Skeleton */}
          {loading && (
            <div className="flex flex-col items-start animate-pulse">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl rounded-tl-none p-4 w-[75%] space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-800">
                  <RefreshCw size={11} className="animate-spin" />
                  <span>AI Agent Network Coordinating...</span>
                </div>
                <div className="h-3.5 bg-slate-800 rounded w-full"></div>
                <div className="h-3.5 bg-slate-800 rounded w-[85%]"></div>
                <div className="h-3.5 bg-slate-800 rounded w-[90%]"></div>
                <div className="h-3.5 bg-slate-800 rounded w-[60%]"></div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/30 border border-red-900/30 text-red-300 text-xs rounded-lg flex gap-1.5 items-center">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-850 bg-slate-950/20 flex gap-2 shrink-0">
          <input
            type="text"
            required
            disabled={loading}
            placeholder="e.g. Flood disaster in Seattle, find open shelters..."
            className="flex-1 px-4 py-2.5 bg-slate-900/80 border border-slate-800 focus:border-slate-700 focus:outline-none rounded-xl text-slate-205 text-xs md:text-sm transition-colors"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !inputVal.trim()}
            className="p-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl active:scale-95 transition-all shadow-lg shadow-red-900/10 flex items-center justify-center"
          >
            <Send size={16} />
          </button>
        </form>

      </div>

      {/* RIGHT PANEL: Execution Timeline (1 col) */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 shadow-xl overflow-y-auto custom-scrollbar h-full lg:h-auto">
        <Timeline traces={activeTimeline} />
      </div>

    </div>
  );
}
