# Conduit UCPI Web3 SDK - Frontend

A Next.js web application for creating and managing time-delayed escrow contracts on Avalanche blockchain.

## Features

- **Secure Authentication**: Web3Auth integration for wallet-based login
- **Escrow Contracts**: Create time-delayed escrow agreements with built-in dispute resolution
- **USDC Support**: Native USDC token support with automatic approval handling
- **MoonPay Integration**: Direct USDC purchases within the app
- **Real-time Updates**: Auto-refreshing dashboard for contract status changes
- **Mobile Responsive**: Optimized for all device sizes

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Configuration

### Required Environment Variables

- `WEB3AUTH_CLIENT_ID`: Your Web3Auth project client ID
- `CONTRACT_FACTORY_ADDRESS`: Deployed escrow factory contract address
- `MOONPAY_API_KEY`: MoonPay API key for USDC purchases

### Backend Services

The app requires two backend microservices:

- **User Service** (port 8977): Handles authentication and user management
- **Chain Service** (port 8978): Manages blockchain interactions and contract deployment

## Tech Stack

- **Framework**: Next.js 14 (Pages Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3**: Web3Auth + ethers.js
- **UI**: Headless UI components
- **Payments**: MoonPay SDK

## Architecture

This is a frontend-focused application that proxies API calls to backend microservices. Key architectural decisions:

- Client-side transaction signing with server-side submission
- HTTP-only cookies for secure authentication
- Context-based state management (no Redux/Zustand needed)
- Component-based architecture with clear separation of concerns

## Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Production build
npm run build
```

## Deployment

1. Build the application: `npm run build`
2. Configure environment variables in your deployment platform
3. Deploy to Vercel, Netlify, or your preferred hosting provider
4. Ensure backend microservices are accessible from your deployment

## Security

- Private keys never leave the client
- All authentication via secure JWT tokens and HTTP-only cookies
- Input validation on all user-provided data
- Environment variables for sensitive configuration

---

Built with ❤️ for secure Web3 transactions