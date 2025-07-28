import { useEffect, useState } from 'react';

interface LogEntry {
  type: 'log' | 'error' | 'warn';
  message: string;
  timestamp: Date;
}

export default function MobileDebug() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Capture console methods
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };

    const addLog = (type: 'log' | 'error' | 'warn', args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev.slice(-20), { // Keep only last 20 logs
        type,
        message,
        timestamp: new Date()
      }]);
    };

    console.log = (...args) => {
      originalConsole.log(...args);
      addLog('log', args);
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      addLog('error', args);
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      addLog('warn', args);
    };

    // Capture unhandled errors
    const handleError = (event: ErrorEvent) => {
      addLog('error', [`Unhandled error: ${event.error?.message || event.message}`]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addLog('error', [`Unhandled rejection: ${event.reason}`]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      // Restore original console methods
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Don't render on desktop
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) return null;

  return (
    <>
      {/* Debug Toggle Button */}
      <button
        className="fixed top-4 right-4 z-50 bg-red-600 text-white px-3 py-1 rounded text-xs"
        onClick={() => setIsVisible(!isVisible)}
      >
        Debug {isVisible ? 'Hide' : 'Show'} ({logs.length})
      </button>

      {/* Debug Panel */}
      {isVisible && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-90 p-4 overflow-auto">
          <div className="bg-gray-900 rounded p-4 max-h-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold">Mobile Debug Console</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setLogs([])}
                  className="bg-yellow-600 text-white px-2 py-1 rounded text-xs"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  className="bg-red-600 text-white px-2 py-1 rounded text-xs"
                >
                  Close
                </button>
              </div>
            </div>
            
            <div className="space-y-2 text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-400">No logs yet...</p>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded ${
                      log.type === 'error' 
                        ? 'bg-red-900 text-red-200' 
                        : log.type === 'warn'
                        ? 'bg-yellow-900 text-yellow-200'
                        : 'bg-gray-800 text-gray-200'
                    }`}
                  >
                    <div className="flex justify-between text-xs opacity-75 mb-1">
                      <span>{log.type.toUpperCase()}</span>
                      <span>{log.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-words">{log.message}</pre>
                  </div>
                ))
              )}
            </div>
            
            {/* Device Info */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-white font-semibold mb-2">Device Info:</h4>
              <div className="text-xs text-gray-300 space-y-1">
                <div>User Agent: {navigator.userAgent}</div>
                <div>Screen: {window.screen.width}x{window.screen.height}</div>
                <div>Viewport: {window.innerWidth}x{window.innerHeight}</div>
                <div>Device Pixel Ratio: {window.devicePixelRatio}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}