/**
 * Farcaster provider implementation
 * Implements unified provider interface for Farcaster frame authentication
 * Note: This is an auth-only provider with no blockchain capabilities
 */

import { AuthConfig } from '../types';
import {
  UnifiedProvider,
  ConnectionResult,
  ProviderCapabilities,
  TransactionRequest
} from '../types/unified-provider';
import { ethers } from 'ethers';

export class FarcasterProvider implements UnifiedProvider {
  private config: AuthConfig;
  private farcasterUser: { id: string; username?: string } | null = null;
  private isConnectedState: boolean = false;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  getProviderName(): string {
    return 'farcaster';
  }

  async initialize(): Promise<void> {
    console.log('🔧 FarcasterProvider: Initialize called');
    // Farcaster frames are initialized by the parent frame
  }

  async connect(): Promise<ConnectionResult> {
    console.log('🔧 FarcasterProvider: Connect called');

    try {
      // In Farcaster frames, we get user data from the frame context
      // This is a simplified implementation - actual Farcaster integration
      // would use the Farcaster SDK and frame protocols

      this.isConnectedState = true;

      console.log('🔧 FarcasterProvider: ✅ Connected via Farcaster frame');

      return {
        success: true,
        address: '0x1234567890123456789012345678901234567890', // Mock address
        capabilities: this.getCapabilities()
      };

    } catch (error) {
      console.error('🔧 FarcasterProvider: Connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        capabilities: this.getCapabilities()
      };
    }
  }

  async disconnect(): Promise<void> {
    console.log('🔧 FarcasterProvider: Disconnecting');
    this.farcasterUser = null;
    this.isConnectedState = false;
  }

  async switchWallet(): Promise<ConnectionResult> {
    // Farcaster frames don't support wallet switching as the user context
    // is provided by the parent frame
    return {
      success: false,
      error: 'Wallet switching is not supported in Farcaster frames',
      capabilities: this.getCapabilities()
    };
  }

  async signMessage(message: string): Promise<string> {
    // In Farcaster frames, signing would be handled by the frame protocol
    throw new Error('Message signing not supported in Farcaster frames - blockchain operations require external wallet');
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    // Farcaster frames don't support direct transaction signing
    throw new Error('Transaction signing not supported in Farcaster frames - blockchain operations require external wallet');
  }

  getEthersProvider(): ethers.BrowserProvider | null {
    // Farcaster frames don't provide direct ethers access
    return null;
  }

  async getEthersProviderAsync(): Promise<ethers.BrowserProvider | null> {
    // Farcaster frames don't provide direct ethers access
    return null;
  }

  async getAddress(): Promise<string> {
    // Return mock address for Farcaster
    return '0x1234567890123456789012345678901234567890';
  }

  isConnected(): boolean {
    return this.isConnectedState;
  }

  getUserInfo(): { id: string; username?: string } | null {
    return this.farcasterUser;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      canSign: false,
      canTransact: false,
      canSwitchWallets: false,
      isAuthOnly: true  // Auth-only provider
    };
  }
}