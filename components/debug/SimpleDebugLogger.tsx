import React, { useState, useEffect } from 'react';
import { useFarcaster } from '../farcaster/FarcasterDetectionProvider';

interface LogEntry {
  id: string | number;
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
}

export const SimpleDebugLogger: React.FC = () => {
  const { isInFarcaster } = useFarcaster();
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 0,
      timestamp: Date.now(),
      level: 'info',
      message: '✅ Debug logger ready!'
    }
  ]);
  const [isVisible, setIsVisible] = useState(false);
  const [logIdCounter, setLogIdCounter] = useState(1);

  // Stable function to add logs
  const addLog = (level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev.slice(-99), {
      id: logIdCounter,
      timestamp: Date.now(),
      level,
      message
    }]);
    setLogIdCounter(prev => prev + 1);
  };

  const addTestLog = () => {
    addLog('log', `Test log #${logIdCounter} - ${new Date().toLocaleTimeString()}`);
  };

  // Console override - set up once and never change
  useEffect(() => {
    let isOverrideActive = false;
    
    // Store original console methods
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
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    };

    // Override console methods
    console.log = (...args) => {
      originalConsole.log(...args);
      if (!isOverrideActive) {
        isOverrideActive = true;
        const message = args.map(safeStringify).join(' ');
        setLogs(prev => [...prev.slice(-99), {
          id: `${Date.now()}-${Math.random()}`, // Unique ID to avoid duplicates
          timestamp: Date.now(),
          level: 'log',
          message
        }]);
        isOverrideActive = false;
      }
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      if (!isOverrideActive) {
        isOverrideActive = true;
        const message = args.map(safeStringify).join(' ');
        setLogs(prev => [...prev.slice(-99), {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          level: 'warn',
          message
        }]);
        isOverrideActive = false;
      }
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      if (!isOverrideActive) {
        isOverrideActive = true;
        const message = args.map(safeStringify).join(' ');
        setLogs(prev => [...prev.slice(-99), {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          level: 'error',
          message
        }]);
        isOverrideActive = false;
      }
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      if (!isOverrideActive) {
        isOverrideActive = true;
        const message = args.map(safeStringify).join(' ');
        setLogs(prev => [...prev.slice(-99), {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          level: 'info',
          message
        }]);
        isOverrideActive = false;
      }
    };

    // Test the override
    setTimeout(() => {
      console.log('🔥 Console capture is now active!');
    }, 500);

    // Cleanup function
    return () => {
      Object.assign(console, originalConsole);
    };
  }, []); // Empty dependency array - set up once and never change

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return '#ef4444';
      case 'warn': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  // Only render in Farcaster
  if (!isInFarcaster) {
    return null;
  }

  return (
    <>
      {/* Debug Button */}
      <button
        onClick={() => {
          alert(`Button clicked! Current visible: ${isVisible}`);
          setIsVisible(!isVisible);
        }}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: '#8b5cf6',
          color: 'white',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 2147483647, // Maximum z-index value
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          pointerEvents: 'auto'
        }}
      >
        🐛
      </button>

      {/* Logger Panel */}
      {isVisible && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            width: '400px',
            height: '500px',
            backgroundColor: 'white',
            border: '2px solid #8b5cf6',
            borderRadius: '8px',
            zIndex: 2147483646, // Just below the button
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'monospace',
            fontSize: '12px',
            pointerEvents: 'auto'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>Debug Logger ({logs.length})</span>
            <div>
              <button
                onClick={addTestLog}
                style={{
                  background: '#10b981',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '3px 6px',
                  borderRadius: '3px',
                  marginRight: '4px'
                }}
              >
                Test
              </button>
              <button
                onClick={() => {
                  console.log('🧪 Manual test log');
                  console.warn('⚠️ Manual test warning');
                  console.error('❌ Manual test error');
                  console.info('ℹ️ Manual test info');
                }}
                style={{
                  background: '#3b82f6',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '3px 6px',
                  borderRadius: '3px',
                  marginRight: '8px'
                }}
              >
                Console Test
              </button>
              <button
                onClick={() => setIsVisible(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Logs */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '10px'
            }}
          >
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  marginBottom: '5px',
                  padding: '5px',
                  backgroundColor: '#f8f9fa',
                  borderLeft: `3px solid ${getLogColor(log.level)}`,
                  fontSize: '11px'
                }}
              >
                <div style={{ color: '#666', marginBottom: '2px' }}>
                  {formatTime(log.timestamp)} [{log.level.toUpperCase()}]
                </div>
                <div style={{ color: '#000' }}>
                  {log.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};