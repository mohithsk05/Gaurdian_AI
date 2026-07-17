import { useState } from 'react';
import { Play, CheckCircle2, XCircle, ChevronDown, ChevronRight, Wrench, Settings } from 'lucide-react';

export interface ToolCall {
  tool_name: string;
  arguments: any;
  status: 'CALLING' | 'SUCCESS' | 'FAILED';
  response?: string;
}

export interface AgentTrace {
  agent_name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  input_params: any;
  output: string;
  tool_calls: ToolCall[];
  error?: string;
}

interface TimelineProps {
  traces: AgentTrace[];
  isDarkMode?: boolean;
}

export default function Timeline({ traces, isDarkMode = true }: TimelineProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleNode = (name: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'FAILED':
        return <XCircle size={16} className="text-red-500" />;
      case 'RUNNING':
        return <Settings size={16} className="text-amber-500 animate-spin" />;
      default:
        return <Play size={16} className="text-slate-500" />;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return isDarkMode 
          ? 'border-emerald-500/20 bg-emerald-950/10 text-emerald-300 shadow-sm' 
          : 'border-emerald-200 bg-emerald-50/40 text-emerald-800 shadow-sm';
      case 'FAILED':
        return isDarkMode 
          ? 'border-red-500/20 bg-red-950/10 text-red-300 shadow-sm' 
          : 'border-red-200 bg-red-50/40 text-red-800 shadow-sm';
      case 'RUNNING':
        return isDarkMode 
          ? 'border-amber-500/20 bg-amber-950/10 text-amber-300 shadow-sm animate-pulse' 
          : 'border-amber-200 bg-amber-50/40 text-amber-800 shadow-sm animate-pulse';
      default:
        return isDarkMode 
          ? 'border-slate-800 bg-slate-900/20 text-slate-400' 
          : 'border-slate-205 bg-slate-100/50 text-slate-500';
    }
  };

  if (!traces || traces.length === 0) {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-6 text-center text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-505'}`}>
        <Settings size={28} className="text-slate-600 mb-2.5 animate-spin" style={{ animationDuration: '6s' }} />
        <span>Waiting for multi-agent execution query...</span>
        <span className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-450'}`}>Traces appear here in real-time.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between border-b pb-2.5 ${isDarkMode ? 'border-slate-900' : 'border-slate-200'}`}>
        <span className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Agent Invocation Trace</span>
        <span className="text-[9px] bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 font-black px-2 py-0.5 rounded animate-pulse">
          ADK Flow
        </span>
      </div>

      <div className={`relative pl-4 border-l-2 space-y-5 py-1 transition-colors ${isDarkMode ? 'border-slate-900' : 'border-slate-200'}`}>
        {traces.map((trace, idx) => {
          const isExpanded = expandedNodes[trace.agent_name] || false;
          
          return (
            <div key={trace.agent_name} className="relative animate-fade-in" style={{ animationDelay: `${idx * 0.08}s` }}>
              
              {/* Connector Dot */}
              <div className={`absolute -left-[25px] top-1.5 p-0.5 rounded-full border z-20 ${isDarkMode ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'}`}>
                {getStatusIcon(trace.status)}
              </div>

              {/* Box Container */}
              <div className={`border rounded-xl transition-all ${getStatusStyle(trace.status)}`}>
                
                {/* Node Title Header */}
                <button
                  onClick={() => toggleNode(trace.agent_name)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold focus:outline-none rounded-xl hover:bg-slate-500/5 cursor-pointer`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-display font-black text-sm">{trace.agent_name}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 border rounded font-bold ${
                      isDarkMode ? 'bg-slate-950/80 border-slate-900 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
                    }`}>
                      {trace.tool_calls.length} Tools
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black tracking-widest uppercase opacity-75">{trace.status}</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </button>

                {/* Node Body Details */}
                {isExpanded && (
                  <div className={`border-t px-3.5 py-3 space-y-3 text-[11px] leading-relaxed rounded-b-xl ${
                    isDarkMode ? 'border-slate-900 bg-slate-950/30 text-slate-300' : 'border-slate-100 bg-slate-50/30 text-slate-700'
                  }`}>
                    
                    {/* Inputs */}
                    <div>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Input Arguments</span>
                      <pre className={`mt-1.5 p-2 border rounded font-mono text-[10px] overflow-x-auto ${
                        isDarkMode ? 'bg-slate-950/80 border-slate-900 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
                      }`}>
                        {JSON.stringify(trace.input_params, null, 2)}
                      </pre>
                    </div>

                    {/* Tool Transactions */}
                    {trace.tool_calls.length > 0 && (
                      <div>
                        <span className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>MCP Tool Calls</span>
                        <div className="space-y-2">
                          {trace.tool_calls.map((tc, tcIdx) => (
                            <div key={tcIdx} className={`border rounded p-2.5 transition-all ${
                              isDarkMode ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200 shadow-xs'
                            }`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[10px] text-red-500 dark:text-red-400 font-bold flex items-center gap-1">
                                  <Wrench size={10} className="animate-pulse" /> {tc.tool_name}
                                </span>
                                <span className={`text-[8px] font-black px-1.5 py-0.2 rounded border ${
                                  tc.status === 'SUCCESS' ? (isDarkMode ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/20' : 'bg-emerald-50 text-emerald-800 border-emerald-200') :
                                  tc.status === 'CALLING' ? (isDarkMode ? 'bg-amber-955/30 text-amber-400 border-amber-800/20 animate-pulse' : 'bg-amber-50 text-amber-850 border-amber-200 animate-pulse') :
                                  'bg-red-950/30 text-red-400 border-red-800/20'
                                }`}>
                                  {tc.status}
                                </span>
                              </div>
                              <div className={`text-[10px] font-medium mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                Args: <span className="font-mono font-bold">{JSON.stringify(tc.arguments)}</span>
                              </div>
                              {tc.response && (
                                <div className="mt-1.5">
                                  <span className={`text-[8px] font-black uppercase tracking-widest block mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-450'}`}>Response Payload:</span>
                                  <pre className={`p-1.5 text-[9px] font-mono overflow-x-auto max-h-24 custom-scrollbar rounded border ${
                                    isDarkMode ? 'bg-slate-900 text-slate-300 border-slate-900' : 'bg-slate-50 text-slate-800 border-slate-200'
                                  }`}>
                                    {tc.response}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Final Output Summary */}
                    {trace.output && (
                      <div>
                        <span className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Agent Report Output</span>
                        <div className={`p-2.5 border rounded max-h-48 overflow-y-auto custom-scrollbar text-xs leading-relaxed font-sans ${
                          isDarkMode ? 'bg-slate-950/50 border-slate-900 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xs'
                        }`}>
                          {trace.output}
                        </div>
                      </div>
                    )}

                    {/* Errors */}
                    {trace.error && (
                      <div className="p-2.5 bg-red-500/10 border border-red-550/20 text-red-500 dark:text-red-400 rounded-lg">
                        <span className="font-bold">Error Trace:</span> {trace.error}
                      </div>
                    )}

                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
