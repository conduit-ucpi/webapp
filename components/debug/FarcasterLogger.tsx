import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { useFarcaster } from '../farcaster/FarcasterDetectionProvider';
import { setLoggerInstance } from '@/utils/farcasterLogger';

declare global {
  interface Window {
    __farcasterLoggerSetup?: boolean;
    __farcasterLoggerInitialized?: boolean;
  }
}

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
      
      // Test that console override is working (only once)
      if (!window.__farcasterLoggerInitialized) {
        setTimeout(() => {
          const originalLog = (console as any).__originalLog || console.log;
          originalLog('🧪 Logger initialized successfully');
        }, 1000);
        window.__farcasterLoggerInitialized = true;
      }
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
      const originalLog = (console as any).__originalLog || console.log;
      originalLog('FarcasterLogger: toggleLogger called');
      setIsVisible(prev => {
        const newValue = !prev;
        originalLog('FarcasterLogger: toggling from', prev, 'to', newValue);
        return newValue;
      });
    } catch (error) {
      console.error('FarcasterLogger: Error in toggleLogger:', error);
    }
  }, []); // Remove isVisible dependency to prevent stale closures

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
    
    const originalLog = (console as any).__originalLog || console.log;
    originalLog('🪵 Setting up console override. isInFarcaster:', isInFarcaster, 'isDev:', process.env.NODE_ENV === 'development');
    
    // Skip adding setup logs to avoid circular dependencies
    window.__farcasterLoggerSetup = true;

    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    // Store reference for debug use
    (console as any).__originalLog = originalConsole.log;
    (console as any).__originalWarn = originalConsole.warn;
    (console as any).__originalError = originalConsole.error;
    (console as any).__originalInfo = originalConsole.info;

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

    let isLogging = false; // Prevent infinite loops

    // Override console methods to capture logs
    console.log = (...args) => {
      originalConsole.log(...args);
      if (!isLogging) {
        try {
          isLogging = true;
          addLog('log', args.map(safeStringify).join(' '));
        } catch (error) {
          originalConsole.error('FarcasterLogger error:', error);
        } finally {
          isLogging = false;
        }
      }
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      if (!isLogging) {
        try {
          isLogging = true;
          addLog('warn', args.map(safeStringify).join(' '));
        } catch (error) {
          originalConsole.error('FarcasterLogger error:', error);
        } finally {
          isLogging = false;
        }
      }
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      if (!isLogging) {
        try {
          isLogging = true;
          addLog('error', args.map(safeStringify).join(' '));
        } catch (error) {
          originalConsole.error('FarcasterLogger error:', error);
        } finally {
          isLogging = false;
        }
      }
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      if (!isLogging) {
        try {
          isLogging = true;
          addLog('info', args.map(safeStringify).join(' '));
        } catch (error) {
          originalConsole.error('FarcasterLogger error:', error);
        } finally {
          isLogging = false;
        }
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
  const shouldShowOverlay = isInFarcaster || (process.env.NODE_ENV === 'development') || true; // Always show for debugging
  
  // Debug the visibility conditions (only once when isInFarcaster changes)
  useEffect(() => {
    const originalLog = (console as any).__originalLog || console.log;
    originalLog('FarcasterLogger visibility check:', {
      isInFarcaster,
      nodeEnv: process.env.NODE_ENV,
      shouldShowOverlay
    });
  }, [isInFarcaster]);

  // Debug render decision (in useEffect to avoid infinite loops)
  useEffect(() => {
    const originalLog = (console as any).__originalLog || console.log;
    originalLog('FarcasterLoggerProvider render decision:', {
      shouldShowOverlay,
      isInFarcaster,
      nodeEnv: process.env.NODE_ENV,
      willRenderOverlay: shouldShowOverlay
    });
  }, [shouldShowOverlay, isInFarcaster]);

  return (
    <FarcasterLoggerContext.Provider value={value}>
      {children}
      {shouldShowOverlay && <FarcasterLoggerOverlay />}
      {/* FORCE RENDER TEST - ALWAYS SHOW */}
      <div
        style={{
          position: 'fixed',
          top: '50px',
          left: '50px',
          zIndex: 999999,
          padding: '10px',
          backgroundColor: 'orange',
          color: 'black',
          border: '2px solid black',
          borderRadius: '5px',
          fontWeight: 'bold'
        }}
      >
        LOGGER TEST: {shouldShowOverlay ? 'SHOULD SHOW' : 'HIDDEN'}
      </div>
    </FarcasterLoggerContext.Provider>
  );
};

// WORKING Simple button component with minimal state dependencies
const SimpleLoggerButton: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const [localVisible, setLocalVisible] = useState(false);
  
  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 99999,
          width: '70px',
          height: '70px',
          backgroundColor: '#8b5cf6',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          fontSize: '28px',
          userSelect: 'none',
          touchAction: 'manipulation',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 0 3px white',
          border: '3px solid white',
          fontWeight: 'bold'
        }}
        onClick={() => {
          setLocalVisible(!localVisible);
        }}
      >
        🔍
        {logs.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              color: 'white',
              border: '2px solid white'
            }}
          >
            {logs.length > 99 ? '99+' : logs.length}
          </div>
        )}
      </div>
      
      {localVisible && (
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
                    console.log('🧪 Manual test log');
                    console.warn('🧪 Manual test warning');
                    console.error('🧪 Manual test error');
                    console.info('🧪 Manual test info');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                  type="button"
                >
                  Test
                </button>
                <button
                  onClick={() => setLocalVisible(false)}
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
                  No logs yet. Debug information will appear here when the app runs.
                </div>
              ) : (
                logs.map((log) => {
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
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const FarcasterLoggerOverlay: React.FC = () => {
  const { logs, clearLogs, isVisible, toggleLogger } = useFarcasterLogger();
  const { isInFarcaster } = useFarcaster();

  // Debug: Log when overlay renders
  useEffect(() => {
    const originalLog = (console as any).__originalLog || console.log;
    originalLog('FarcasterLoggerOverlay rendered. isInFarcaster:', isInFarcaster, 'isVisible:', isVisible, 'logs count:', logs.length);
    if (isVisible) {
      originalLog('OVERLAY SHOULD BE VISIBLE NOW!');
    }
  }, [isInFarcaster, isVisible, logs.length]);

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

  // Add render logging (moved to useEffect to prevent loops)
  useEffect(() => {
    const originalLog = (console as any).__originalLog || console.log;
    originalLog('FarcasterLoggerOverlay RENDERING - logs:', logs.length);
  }, [logs.length]);

  return (
    <>
      {/* SIMPLE TEST BUTTON */}
      <button
        style={{
          position: 'fixed',
          top: '100px',
          right: '20px',
          zIndex: 999999,
          padding: '10px',
          backgroundColor: 'red',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
        onClick={() => {
          alert('SIMPLE BUTTON WORKS!');
          console.log('Simple button clicked');
        }}
      >
        TEST
      </button>

      {/* SUPER SIMPLE BUTTON - NO STATE DEPENDENCIES */}
      <SimpleLoggerButton logs={logs} />

      {/* Debug Logger Button - ALWAYS VISIBLE */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '100px',
          zIndex: 99999,
          width: '70px',
          height: '70px',
          backgroundColor: logs.length > 0 ? '#10b981' : '#ff6b35',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          fontSize: '28px',
          userSelect: 'none',
          touchAction: 'manipulation',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 0 3px white',
          border: '3px solid white',
          fontWeight: 'bold',
          pointerEvents: 'auto',
          isolation: 'isolate'
        }}
        onClick={() => {
          console.log('Green button clicked - toggling logger');
          toggleLogger();
        }}
      >
        📋
        {logs.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              color: 'white',
              border: '2px solid white'
            }}
          >
            {logs.length > 99 ? '99+' : logs.length}
          </div>
        )}
      </div>

      {/* Logger Panel */}
      {isVisible && (
        <>
          {/* TEST VISIBILITY */}
          <div
            style={{
              position: 'fixed',
              top: '200px',
              left: '200px',
              width: '200px',
              height: '100px',
              backgroundColor: 'yellow',
              border: '5px solid red',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            OVERLAY IS VISIBLE!
          </div>
          
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            style={{ 
              backgroundColor: 'rgba(255, 0, 0, 0.8)',
              zIndex: 99998 
            }}
          >
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
                    console.log('🧪 Manual test log');
                    console.warn('🧪 Manual test warning');
                    console.error('🧪 Manual test error');
                    console.info('🧪 Manual test info');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                  type="button"
                >
                  Test
                </button>
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
                    toggleLogger();
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
        </>
      )}
    </>
  );
};