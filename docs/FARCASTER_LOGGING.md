# Farcaster Logging System

This documentation explains how to use the Farcaster logging system that provides visual logs when the app runs inside the Farcaster environment.

## Overview

When the app runs inside Farcaster, console logs are not visible through normal developer tools. This logging system provides:

- **Visual log overlay** that displays all console output within the app
- **Automatic console interception** when running in Farcaster
- **Enhanced logging functions** with context and categorization
- **Developer-friendly controls** for testing and debugging

## Architecture

The system consists of:

- `FarcasterLoggerProvider` - Main provider that captures and manages logs
- `FarcasterLoggerOverlay` - Visual interface for viewing logs
- `useFarcasterLogger` hook - Enhanced logging functions
- Utility functions for different log categories

## Usage

### Basic Logging

Use the enhanced logging hook throughout your components:

```tsx
import { useFarcasterLogger } from '@/hooks/useFarcasterLogger';

function MyComponent() {
  const logger = useFarcasterLogger();

  const handleSomething = () => {
    logger.log('Basic log message');
    logger.warn('Warning message');
    logger.error('Error message');
    logger.info('Info message');
    logger.debug('Debug message'); // Only in development or Farcaster
  };

  // ... rest of component
}
```

### Contextual Logging

Use specific logging functions for different operations:

```tsx
const logger = useFarcasterLogger();

// Contract operations
logger.logContract('create', 'contract-123', { amount: 1000000 });
logger.logContract('dispute', 'contract-456');

// Authentication operations
logger.logAuth('login', { wallet: '0x123...' });
logger.logAuth('logout');

// Web3 operations
logger.logWeb3('transaction', { hash: '0xabc...', gas: 21000 });

// API calls
logger.logAPI('/api/contracts', 'POST', { data: requestData });

// Errors with context
logger.logError('contract creation', new Error('Invalid amount'), { 
  contractId: 'contract-123',
  userWallet: '0x123...' 
});
```

### Direct Utility Functions

You can also use the utility functions directly:

```tsx
import { 
  farcasterLog, 
  farcasterError, 
  logContractOperation 
} from '@/utils/farcasterLogger';

// These work anywhere in the app
farcasterLog('Direct log message');
farcasterError('Direct error message');
logContractOperation('create', 'contract-123');
```

## Visual Interface

When running in Farcaster, you'll see:

### Debug Button
- **Purple floating button** in bottom-right corner
- Always visible when in Farcaster environment
- Click to toggle the log viewer

### Log Viewer
- **Full-screen overlay** with all captured logs
- **Timestamp and log level** for each entry
- **Color-coded by severity** (error=red, warn=yellow, info=blue, log=gray)
- **Expandable additional data** for complex objects
- **Clear and Close buttons** in the header

### Development Demo
- **Test button** in top-left corner (development only)
- Click to generate sample logs of all types
- Helps verify the logging system is working

## Automatic Behavior

### Console Interception
When running in Farcaster, the system automatically:
- Intercepts all `console.log()`, `console.warn()`, `console.error()`, `console.info()` calls
- Displays them in the visual log viewer
- Still forwards to the original console (for any external logging)

### Environment Detection
The system only activates when:
- Running inside Farcaster environment (detected automatically)
- Or in development mode (for testing)

### Log Management
- Keeps the **last 100 log entries** in memory
- Automatically clears old entries to prevent memory issues
- Provides manual clear function

## Implementation Details

### Provider Setup
The logging system is already integrated into the app through the provider chain in `_app.tsx`:

```tsx
<FarcasterDetectionProvider>
  <FarcasterLoggerProvider>
    {/* Your app content */}
  </FarcasterLoggerProvider>
</FarcasterDetectionProvider>
```

### Log Entry Format
Each log entry contains:
- `id`: Unique identifier
- `timestamp`: When the log occurred (milliseconds)
- `level`: Type of log ('log', 'warn', 'error', 'info')
- `message`: The log message string
- `data`: Optional additional data object

### Performance Considerations
- Only active when running in Farcaster
- Minimal overhead in normal browser environment
- Logs are stored in memory only (not persisted)
- Auto-cleanup prevents memory leaks

## Testing

To test the logging system:

1. **Development Mode**: The demo button appears in top-left corner
2. **Click "Test Logs"** to generate sample logs
3. **Click the purple debug button** to open/close the log viewer
4. **Try different log levels** to see color coding

## Best Practices

### When to Use Enhanced Logging
- Use `logger.logContract()` for all contract-related operations
- Use `logger.logAuth()` for authentication events
- Use `logger.logWeb3()` for blockchain interactions
- Use `logger.logAPI()` for API calls (especially for debugging)
- Use `logger.logError()` for errors with context

### Error Logging
Always include context when logging errors:

```tsx
try {
  await createContract(data);
} catch (error) {
  logger.logError('contract creation', error, {
    contractData: data,
    userWallet: wallet.address,
    timestamp: Date.now()
  });
  throw error; // Re-throw if needed
}
```

### Development vs Production
- `logger.debug()` only shows in development or Farcaster
- Other log levels always show when in Farcaster
- No visual impact when running in normal browser

## Troubleshooting

### Logs Not Appearing
1. Verify app is running in Farcaster (check detection in demo button text)
2. Check that purple debug button is visible
3. Click debug button to open log viewer
4. Try generating test logs with demo button

### Console Override Issues
If you notice console methods not working properly:
- The system restores original console methods on cleanup
- Refresh the app if console seems broken
- Check browser developer tools for any JavaScript errors

### Performance Issues
If the app seems slow:
- Clear logs using the "Clear" button in log viewer
- The system auto-limits to 100 entries, but manual clearing helps
- Check if you have excessive logging in tight loops

## Future Enhancements

Potential improvements:
- Log filtering by level or category
- Search functionality within logs  
- Export logs to external service
- Performance metrics and timing
- Remote logging when in Farcaster