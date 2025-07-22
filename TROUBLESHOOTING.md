# Troubleshooting Guide

## Web3Auth MetaMask Conflict

If you see the error "Failed to connect to MetaMask", this means Web3Auth is trying to use MetaMask instead of its own modal system.

### Solutions:

1. **Disable MetaMask temporarily:**
   - Go to Chrome Extensions (chrome://extensions/)
   - Turn off MetaMask extension
   - Refresh the page and try connecting again

2. **Use Incognito Mode:**
   - Open the app in an incognito/private browser window
   - This bypasses all extensions including MetaMask

3. **Use a different browser:**
   - Try Firefox, Safari, or Edge without MetaMask installed

4. **Clear browser data:**
   - Clear localStorage and sessionStorage for the site
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Why This Happens:

Web3Auth automatically detects installed wallet extensions and may try to use them instead of showing its own login modal. This is a known issue when MetaMask is installed.

### Expected Behavior:

When working correctly, Web3Auth should show a modal with social login options (Google, Facebook, etc.) rather than trying to connect to MetaMask.

## Other Common Issues:

### Environment Variables Not Loading
- Make sure `.env.local` exists in the project root
- Restart the development server after changing environment variables
- Check that all required variables are set (see `.env.example`)

### Network Configuration
- Ensure `CHAIN_ID` matches the RPC URL (43113 for Avalanche testnet)
- Verify `WEB3AUTH_CLIENT_ID` is valid and corresponds to your Web3Auth project

### Build Issues
- Run `npm install` to ensure all dependencies are installed
- Try deleting `node_modules` and `.next` folders, then reinstall

## Getting Help:

If issues persist, check:
1. Browser console for detailed error messages
2. Network tab for failed API requests
3. Web3Auth documentation: https://web3auth.io/docs/