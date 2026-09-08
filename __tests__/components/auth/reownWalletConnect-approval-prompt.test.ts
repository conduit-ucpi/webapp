/**
 * connect() must not close AppKit's modal while the wallet is asking the user
 * to approve something.
 *
 * The bug: on /create the app does not wait for connect() to resolve. AppKit
 * publishes the address, AuthManager's subscribeAccount listener flips
 * isConnected, the wizard mounts, its first API call 401s and lazy auth asks
 * the embedded wallet for a signature — all while connect()'s poll loop is
 * still running. AppKit answers that personal_sign by opening its modal on the
 * ApproveTransaction view; the poll loop then closed that modal, and AppKit
 * aborts every in-flight unsafe RPC request when the modal closes with an empty
 * transaction stack. The prompt flashed up and vanished, and the signature
 * rejected with "Request was aborted".
 */

jest.unmock('@/components/auth/reownWalletConnect')

jest.mock('@reown/appkit-adapter-ethers', () => ({ EthersAdapter: jest.fn() }))

jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
  },
}))

import { ReownWalletConnectProvider } from '@/components/auth/reownWalletConnect'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const CAIP_ADDRESS = `eip155:8453:${ADDRESS}`
const BASE_CHAIN_ID_HEX = '0x2105' // 8453

/**
 * AppKit reports no address for the two checks connect() makes before it opens
 * the modal, then reports one — the shape of a connection landing mid-poll.
 */
function makeConnectingAppKit(walletProvider: any) {
  let caipReads = 0
  return {
    getCaipAddress: jest.fn(() => (++caipReads <= 2 ? null : CAIP_ADDRESS)),
    getWalletProvider: jest.fn(() => walletProvider),
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }
}

describe('ReownWalletConnectProvider connect() modal close', () => {
  it('leaves the modal open when a wallet approval prompt is on screen', async () => {
    const provider = new ReownWalletConnectProvider({ chainId: 8453 })

    // Lazy auth fires as soon as the address lands — model that by starting a
    // signature request (which never settles) from inside the network check
    // connect() runs just before it decides to close the modal.
    const walletProvider = {
      request: jest.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') {
          void provider.withApprovalPrompt(() => new Promise<string>(() => {}))
          return BASE_CHAIN_ID_HEX
        }
        throw new Error(`unexpected method ${method}`)
      }),
    }
    const appKit = makeConnectingAppKit(walletProvider)
    ;(provider as any).appKit = appKit

    const result = await provider.connect()

    expect(result.success).toBe(true)
    expect(appKit.close).not.toHaveBeenCalled()
  })

  it('closes the modal when nothing is waiting on the user', async () => {
    const provider = new ReownWalletConnectProvider({ chainId: 8453 })

    const walletProvider = {
      request: jest.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return BASE_CHAIN_ID_HEX
        throw new Error(`unexpected method ${method}`)
      }),
    }
    const appKit = makeConnectingAppKit(walletProvider)
    ;(provider as any).appKit = appKit

    const result = await provider.connect()

    expect(result.success).toBe(true)
    expect(appKit.close).toHaveBeenCalledTimes(1)
  })
})

describe('ReownWalletConnectProvider.requestAuthentication()', () => {
  it('marks the approval prompt as on screen while the wallet is signing', async () => {
    const provider = new ReownWalletConnectProvider({ chainId: 8453 })

    let promptPendingDuringSigning: boolean | null = null
    const walletProvider = {
      request: jest.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return BASE_CHAIN_ID_HEX
        if (method === 'personal_sign') {
          promptPendingDuringSigning = provider.hasPendingApprovalPrompt()
          return '0xsignature'
        }
        throw new Error(`unexpected method ${method}`)
      }),
    }

    ;(provider as any).appKit = {
      getCaipAddress: jest.fn(() => CAIP_ADDRESS),
      getAddress: jest.fn(() => ADDRESS),
      getAccount: jest.fn(() => ({ allAccounts: [{ address: ADDRESS, type: 'eoa' }] })),
      getWalletProvider: jest.fn(() => walletProvider),
    }

    global.fetch = jest.fn(async (url: any) => {
      if (String(url).includes('/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'nonce123' }) } as any
      }
      return { ok: true } as any
    }) as any

    await expect(provider.requestAuthentication()).resolves.toBe(true)

    expect(promptPendingDuringSigning).toBe(true)
    // ...and released once the wallet has answered.
    expect(provider.hasPendingApprovalPrompt()).toBe(false)
  })
})
