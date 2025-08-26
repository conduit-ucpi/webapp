import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { useFarcaster } from '../farcaster/FarcasterDetectionProvider';
import { setLoggerInstance } from '@/utils/farcasterLogger';

interface LogEntry {
  id: number;
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  data?: any;
}

interface FarcasterLoggerContextType {
  logs: LogEntry[];
  isVisible: boolean;
  toggleLogger: () => void;
  clearLogs: () => void;
  addLog: (level: LogEntry['level'], message: string, data?: any) => void;
}

const FarcasterLoggerContext = createContext<FarcasterLoggerContextType | null>(null);

export const useFarcasterLogger = () => {
  const context = useContext(FarcasterLoggerContext);
  if (!context) {
    throw new Error('useFarcasterLogger must be used within a FarcasterLoggerProvider');
  }
  return context;
};

interface FarcasterLoggerProviderProps {
  children: ReactNode;
}

export const FarcasterLoggerProvider: React.FC<FarcasterLoggerProviderProps> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [logId, setLogId] = useState(0);
  const { isInFarcaster } = useFarcaster();

  // Debug: Log when provider mounts and Farcaster status
  useEffect(() => {
    console.log('FarcasterLoggerProvider mounted. isInFarcaster:', isInFarcaster);
    
    // Add an initial log to test the system (in Farcaster or development)
    const shouldShowInitialLog = isInFarcaster || (process.env.NODE_ENV === 'development');
    if (shouldShowInitialLog) {
      const initialLog: LogEntry = {
        id: 0,
        timestamp: Date.now(),
        level: 'info',
        message: isInFarcaster ? '🚀 Farcaster Logger initialized and ready!' : '🛠️ Development Logger initialized'
      };
      setLogs([initialLog]);
      setLogId(1);
      
      // Test that console override is working
      setTimeout(() => {
        console.log('🧪 Test log from FarcasterLoggerProvider - this should appear in the logger');
      }, 1000);
    }
  }, [isInFarcaster]);

  const addLog = useCallback((level: LogEntry['level'], message: string, data?: any) => {
    const newLog: LogEntry = {
      id: logId,
      timestamp: Date.now(),
      level,
      message,
      data
    };
    
    setLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100 logs
    setLogId(prev => prev + 1);
  }, [logId]);

  const toggleLogger = useCallback(() => {
    try {
      console.log('FarcasterLogger: toggleLogger called, current isVisible:', isVisible);
      setIsVisible(prev => {
        console.log('FarcasterLogger: toggling from', prev, 'to', !prev);
        return !prev;
      });
    } catch (error) {
      console.error('FarcasterLogger: Error in toggleLogger:', error);
    }
  }, [isVisible]);

  const clearLogs = useCallback(() => {
    try {
      console.log('FarcasterLogger: clearLogs called');
      setLogs([]);
      setLogId(0); // Reset log ID as well
    } catch (error) {
      console.error('FarcasterLogger: Error in clearLogs:', error);
    }
  }, []);

  // Override console methods when in Farcaster or development mode
  useEffect(() => {
    const shouldOverrideConsole = isInFarcaster || (process.env.NODE_ENV === 'development');
    if (!shouldOverrideConsole) return;
    
    console.log('🪵 Setting up console override. isInFarcaster:', isInFarcaster, 'isDev:', process.env.NODE_ENV === 'development');

    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    const safeStringify = (arg: any): string => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
      
      try {
        return JSON.stringify(arg, null, 2);
      } catch (error) {
        // Handle circular references or other JSON errors
        const seen = new WeakSet();
        try {
          return JSON.stringify(arg, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) return '[Circular]';
              seen.add(value);
            }
            return value;
          }, 2);
        } catch {
          return `[Object ${Object.prototype.toString.call(arg)}]`;
        }
      }
    };

    // Override console methods to capture logs
    console.log = (...args) => {
      try {
        originalConsole.log(...args);
        addLog('log', args.map(safeStringify).join(' '));
      } catch (error) {
        originalConsole.error('FarcasterLogger error:', error);
      }
    };

    console.warn = (...args) => {
      try {
        originalConsole.warn(...args);
        addLog('warn', args.map(safeStringify).join(' '));
      } catch (error) {
        originalConsole.error('FarcasterLogger error:', error);
      }
    };

    console.error = (...args) => {
      try {
        originalConsole.error(...args);
        addLog('error', args.map(safeStringify).join(' '));
      } catch (error) {
        originalConsole.error('FarcasterLogger error:', error);
      }
    };

    console.info = (...args) => {
      try {
        originalConsole.info(...args);
        addLog('info', args.map(safeStringify).join(' '));
      } catch (error) {
        originalConsole.error('FarcasterLogger error:', error);
      }
    };

    // Cleanup function to restore original console methods
    return () => {
      Object.assign(console, originalConsole);
    };
  }, [isInFarcaster, addLog]);

  // Make logger instance available globally
  useEffect(() => {
    setLoggerInstance({ addLog });
    return () => setLoggerInstance(null);
  }, [addLog]);

  const value: FarcasterLoggerContextType = {
    logs,
    isVisible,
    toggleLogger,
    clearLogs,
    addLog,
  };

  // Show overlay in Farcaster OR development mode for testing
  const shouldShowOverlay = isInFarcaster || (process.env.NODE_ENV === 'development');

  return (
    <FarcasterLoggerContext.Provider value={value}>
      {children}
      {shouldShowOverlay && <FarcasterLoggerOverlay />}
    </FarcasterLoggerContext.Provider>
  );
};

const FarcasterLoggerOverlay: React.FC = () => {
  const [localIsVisible, setLocalIsVisible] = useState(false);
  const { logs, clearLogs } = useFarcasterLogger();
  const { isInFarcaster } = useFarcaster();

  // Stable references to prevent re-renders from breaking the button
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Stable toggle function
  const simpleToggle = useCallback(() => {
    setLocalIsVisible(prev => {
      const newValue = !prev;
      console.log(`Toggle: ${prev} -> ${newValue}`);
      return newValue;
    });
  }, []);

  // Debug: Log when overlay renders
  useEffect(() => {
    console.log('FarcasterLoggerOverlay rendered. isInFarcaster:', isInFarcaster, 'localIsVisible:', localIsVisible, 'logs count:', logs.length);
  }, [isInFarcaster, localIsVisible, logs.length]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      default: return 'text-gray-300';
    }
  };

  const getLogBg = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'bg-red-900/20 border-red-700/30';
      case 'warn': return 'bg-yellow-900/20 border-yellow-700/30';
      case 'info': return 'bg-blue-900/20 border-blue-700/30';
      default: return 'bg-gray-900/20 border-gray-700/30';
    }
  };

  return (
    <>
      {/* Super Simple Button */}
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 9999,
          width: '60px',
          height: '60px',
          backgroundColor: '#9333ea',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          fontSize: '24px',
          userSelect: 'none',
          touchAction: 'manipulation'
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const timestamp = new Date().toLocaleTimeString();
          alert(`CLICK! ${timestamp}\nVisible: ${localIsVisible}\nLogs: ${logs?.length || 0}`);
          
          // Direct state update - no function calls
          setLocalIsVisible(current => !current);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const timestamp = new Date().toLocaleTimeString();
          alert(`TOUCH! ${timestamp}\nVisible: ${localIsVisible}\nLogs: ${logs?.length || 0}`);
          
          // Direct state update - no function calls
          setLocalIsVisible(current => !current);
        }}
      >
        📋
      </div>

      {/* Logger Panel */}
      {localIsVisible && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm">
          <div className="absolute inset-4 bg-gray-900 rounded-lg border border-gray-700 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-white">Debug Logger</h3>
                <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-medium">
                  {logs.length} logs
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (clearLogs) clearLogs();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                  type="button"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    simpleToggle();
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Log Entries */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No logs yet. Debug information will appear here when the app runs in Farcaster.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`border rounded p-2 ${getLogBg(log.level)}`}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-gray-400 text-xs shrink-0 mt-0.5">
                        {formatTime(log.timestamp)}
                      </span>
                      <span className={`text-xs font-bold uppercase shrink-0 mt-0.5 ${getLogColor(log.level)}`}>
                        {log.level}
                      </span>
                    </div>
                    <div className="text-gray-200 whitespace-pre-wrap break-words">
                      {log.message}
                    </div>
                    {log.data && (
                      <details className="mt-2">
                        <summary className="text-gray-400 text-xs cursor-pointer hover:text-gray-300">
                          Additional Data
                        </summary>
                        <pre className="mt-1 text-xs text-gray-300 bg-black/30 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};