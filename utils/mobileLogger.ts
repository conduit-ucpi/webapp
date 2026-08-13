/**
 * Mobile debugging logger that sends logs to backend
 * Used to debug mobile authentication flow issues
 */

interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  data?: any;
  userAgent?: string;
  url?: string;
}

class MobileLogger {
  private logs: LogEntry[] = [];
  private isFlushScheduled = false;
  private maxLogs = 50;

  constructor() {
    // Auto-flush logs periodically
    setInterval(() => {
      this.flush();
    }, 10000); // Every 10 seconds
  }

  private addLog(level: LogEntry['level'], component: string, message: string, data?: any) {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      component,
      message,
      data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };

    this.logs.push(logEntry);

    // Also log to console for immediate debugging
    const consoleMessage = `[${component}] ${message}`;
    switch (level) {
      case 'debug':
        console.log(consoleMessage, data);
        break;
      case 'info':
        console.info(consoleMessage, data);
        break;
      case 'warn':
        console.warn(consoleMessage, data);
        break;
      case 'error':
        console.error(consoleMessage, data);
        break;
    }

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Schedule flush if not already scheduled
    if (!this.isFlushScheduled) {
      this.isFlushScheduled = true;
      setTimeout(() => {
        this.flush();
      }, 2000); // Flush after 2 seconds
    }
  }

  debug(component: string, message: string, data?: any) {
    this.addLog('debug', component, message, data);
  }

  info(component: string, message: string, data?: any) {
    this.addLog('info', component, message, data);
  }

  warn(component: string, message: string, data?: any) {
    this.addLog('warn', component, message, data);
  }

  error(component: string, message: string, data?: any) {
    this.addLog('error', component, message, data);
  }

  async flush() {
    if (this.logs.length === 0) {
      this.isFlushScheduled = false;
      return;
    }

    const logsToSend = [...this.logs];
    this.logs = [];
    this.isFlushScheduled = false;

    try {
      // Send logs to backend
      const response = await fetch('/api/debug/mobile-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          sessionId: this.getSessionId()
        }),
      });

      if (!response.ok) {
        console.warn('Failed to send mobile logs to backend:', response.status);
        // Put logs back if sending failed
        this.logs.unshift(...logsToSend);
      }
    } catch (error) {
      console.warn('Error sending mobile logs to backend:', error);
      // Put logs back if sending failed
      this.logs.unshift(...logsToSend);
    }
  }

  private getSessionId(): string {
    let sessionId = '';
    try {
      sessionId = localStorage.getItem('mobile-debug-session') || '';
      if (!sessionId) {
        sessionId = 'mobile-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('mobile-debug-session', sessionId);
      }
    } catch {
      sessionId = 'mobile-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
    }
    return sessionId;
  }

  // Force flush all logs immediately
  async forceFlush() {
    await this.flush();
  }
}

// Create singleton instance
const mobileLogger = new MobileLogger();

// Helper function to check if we're on mobile
export const isMobile = () => {
  return typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
};

// Enhanced logging functions that only send to backend on mobile
export const mLog = {
  debug: (component: string, message: string, data?: any) => {
    if (isMobile()) {
      mobileLogger.debug(component, message, data);
    } else {
      console.log(`[${component}] ${message}`, data);
    }
  },
  info: (component: string, message: string, data?: any) => {
    if (isMobile()) {
      mobileLogger.info(component, message, data);
    } else {
      console.info(`[${component}] ${message}`, data);
    }
  },
  warn: (component: string, message: string, data?: any) => {
    if (isMobile()) {
      mobileLogger.warn(component, message, data);
    } else {
      console.warn(`[${component}] ${message}`, data);
    }
  },
  error: (component: string, message: string, data?: any) => {
    if (isMobile()) {
      mobileLogger.error(component, message, data);
    } else {
      console.error(`[${component}] ${message}`, data);
    }
  },
  forceFlush: () => mobileLogger.forceFlush()
};

/**
 * Mirror console output into the mobile log pipeline.
 *
 * Without this, only explicit mLog.* calls reach the backend, so anything a
 * dependency logs itself is invisible on a phone - which is exactly where the
 * interesting failures are. AppKit reports SIWX failures via
 * console.error('SIWXUtil:initializeIfEnabled', err) and then disconnects the
 * wallet, and none of that was reachable from a device.
 *
 * warn/error are always captured. log/info are captured only when they match
 * NOISE_FILTER, because the buffer holds 50 entries and an unfiltered mirror
 * would evict the useful lines before a flush.
 *
 * Set NEXT_PUBLIC_MOBILE_CONSOLE_CAPTURE=false to disable.
 */
const NOISE_FILTER = /SIWX|EmbeddedOnlySIWX|ReownWalletConnect|AppKit|WalletConnect|MetaMask|eip6963/i;

let consoleCaptured = false;

export function captureConsoleForMobile() {
  if (consoleCaptured) return;
  if (typeof window === 'undefined' || !isMobile()) return;
  if (process.env.NEXT_PUBLIC_MOBILE_CONSOLE_CAPTURE === 'false') return;

  consoleCaptured = true;

  /* addLog() mirrors back out to console.*, so without this guard the patched
     methods would call themselves forever. */
  let inside = false;

  const describe = (arg: unknown): string => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack ?? '(no stack)'}`;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  };

  (['log', 'info', 'warn', 'error'] as const).forEach(level => {
    const original = console[level].bind(console);

    console[level] = (...args: unknown[]) => {
      original(...args);
      if (inside) return;

      try {
        const text = args.map(describe).join(' ');
        const isProblem = level === 'warn' || level === 'error';
        if (!isProblem && !NOISE_FILTER.test(text)) return;

        inside = true;
        mobileLogger[isProblem ? level : 'debug']('console', text.slice(0, 2000));
      } catch {
        /* never let logging break the page */
      } finally {
        inside = false;
      }
    };
  });

  /* Errors that never reach console.error - unhandled throws and rejected
     promises. An AppKit SIWX failure can surface as either. */
  window.addEventListener('error', event => {
    mobileLogger.error('window.onerror', event.message, {
      source: `${event.filename}:${event.lineno}:${event.colno}`,
      stack: event.error?.stack
    });
  });

  window.addEventListener('unhandledrejection', event => {
    const reason: any = event.reason;
    mobileLogger.error('unhandledrejection', describe(reason), { stack: reason?.stack });
  });

  mobileLogger.info('mobileLogger', 'Console capture enabled');
}

export default mobileLogger;