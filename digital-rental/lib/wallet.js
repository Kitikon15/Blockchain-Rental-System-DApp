/**
 * Blockchain-Based Rental System
 * Wallet Utilities (MetaMask + ethers.js v6)
 * Handles wallet connection, account changes, chain switching, and balance queries.
 */

import { BrowserProvider, formatEther, parseEther } from 'ethers';
import { SEPOLIA_CHAIN_ID, SEPOLIA_HEX_CHAIN_ID, NETWORK_NAME, DEFAULT_EXPLORER_URL, DEFAULT_RPC_URL } from './constants';

/**
 * Check if MetaMask (or any EIP-1193 provider) is installed in window.ethereum
 */
export function isMetaMaskInstalled() {
  return typeof window !== 'undefined' && Boolean(window.ethereum && window.ethereum.isMetaMask);
}

/**
 * Get an ethers BrowserProvider instance from window.ethereum
 */
export function getProvider() {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }
  return new BrowserProvider(window.ethereum);
}

/**
 * Get the signer from BrowserProvider for write transactions
 */
export async function getSigner() {
  const provider = getProvider();
  if (!provider) {
    throw new Error('MetaMask is not installed or available in this browser.');
  }
  return await provider.getSigner();
}

/**
 * Request account permissions to force MetaMask to pop up its account selection window
 */
export async function requestAccountPermissions() {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to use this application.');
  }

  try {
    const permissions = await window.ethereum.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
    return permissions;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error('Wallet connection was rejected by the user in MetaMask.');
    }
    console.warn('wallet_requestPermissions fallback:', error.message);
    return null;
  }
}

/**
 * Revoke site permissions in MetaMask (EIP-2255)
 */
export async function revokeAccountPermissions() {
  if (!isMetaMaskInstalled()) return false;
  try {
    await window.ethereum.request({
      method: 'wallet_revokePermissions',
      params: [{ eth_accounts: {} }],
    });
    return true;
  } catch (error) {
    console.warn('wallet_revokePermissions not supported or failed:', error?.message);
    return false;
  }
}

/**
 * Trigger MetaMask confirmation popup via personal_sign for Logout
 * This pops up MetaMask window asking the user to sign the logout confirmation message.
 */
export async function requestLogoutConfirmation(address, language = 'th') {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed.');
  }
  if (!address) {
    throw new Error('No account address provided for logout confirmation.');
  }

  const timestamp = new Date().toLocaleString(language === 'th' ? 'th-TH' : 'en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const message =
    language === 'th'
      ? `🔐 ยืนยันการออกจากระบบ (Logout Confirmation)\n` +
        `----------------------------------------\n` +
        `ระบบ: Blockchain-Based Rental System (BlockRental)\n` +
        `กระเป๋าเงิน: ${address}\n` +
        `เวลาทำรายการ: ${timestamp}\n\n` +
        `กรุณากด "ลงนาม" (Sign) ใน MetaMask เพื่อยืนยันการตัดการเชื่อมต่อกระเป๋าเงินและออกจากระบบอย่างปลอดภัย`
      : `🔐 Logout Confirmation\n` +
        `----------------------------------------\n` +
        `System: Blockchain-Based Rental System (BlockRental)\n` +
        `Wallet Account: ${address}\n` +
        `Timestamp: ${timestamp}\n\n` +
        `Please click "Sign" in MetaMask to confirm disconnecting your wallet and logging out securely.`;

  try {
    const provider = getProvider();
    if (provider) {
      const signer = await provider.getSigner();
      return await signer.signMessage(message);
    } else {
      const hexMessage =
        '0x' +
        Array.from(new TextEncoder().encode(message))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      return await window.ethereum.request({
        method: 'personal_sign',
        params: [hexMessage, address],
      });
    }
  } catch (error) {
    if (error.code === 4001 || error.message?.toLowerCase().includes('user rejected')) {
      const err = new Error('USER_REJECTED_LOGOUT');
      err.code = 4001;
      throw err;
    }
    throw error;
  }
}

/**
 * Connect wallet by requesting accounts from MetaMask (with forced popup)
 */
export async function connectWallet(forcePopup = true) {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to use this application.');
  }

  try {
    if (forcePopup) {
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch (permError) {
        if (permError.code === 4001) {
          throw new Error('Wallet connection was rejected by the user in MetaMask.');
        }
        console.warn('wallet_requestPermissions fallback:', permError.message);
      }
    }

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts selected. Please connect your MetaMask account.');
    }

    const provider = getProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const address = accounts[0];
    const isSepolia = chainId === SEPOLIA_CHAIN_ID;

    // Get current balance
    let balance = '0.0';
    try {
      const balanceWei = await provider.getBalance(address);
      balance = formatEther(balanceWei);
    } catch (err) {
      console.warn('Error fetching balance:', err);
    }

    return {
      address,
      chainId,
      isSepolia,
      balance,
    };
  } catch (error) {
    if (error.code === 4001) {
      throw new Error('Wallet connection was rejected by the user in MetaMask.');
    }
    throw error;
  }
}

/**
 * Get currently active connected account if already authorized
 */
export async function getAccount() {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch (err) {
    console.error('Error fetching account:', err);
    return null;
  }
}

/**
 * Get the current network Chain ID from MetaMask
 */
export async function getChainId() {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  try {
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainIdHex, 16);
  } catch (err) {
    console.error('Error fetching chain ID:', err);
    return null;
  }
}

/**
 * Check if the active connected network is Sepolia Testnet
 */
export async function isSepoliaNetwork() {
  const chainId = await getChainId();
  return chainId === SEPOLIA_CHAIN_ID;
}

/**
 * Switch MetaMask to Ethereum Sepolia Testnet (Chain ID 11155111 / 0xaa36a7)
 */
export async function switchToSepolia() {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to switch network.');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_HEX_CHAIN_ID }],
    });
    return true;
  } catch (switchError) {
    // Error code 4902 indicates that the chain has not been added to MetaMask yet
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: SEPOLIA_HEX_CHAIN_ID,
              chainName: `${NETWORK_NAME} Testnet`,
              nativeCurrency: {
                name: 'Sepolia ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: [DEFAULT_RPC_URL],
              blockExplorerUrls: [DEFAULT_EXPLORER_URL],
            },
          ],
        });
        return true;
      } catch (addError) {
        throw new Error(`Failed to add Sepolia network to MetaMask: ${addError.message}`);
      }
    } else if (switchError.code === 4001) {
      throw new Error('Network switch request was rejected by user.');
    } else {
      throw switchError;
    }
  }
}

/**
 * Get ETH balance of a specific address
 */
export async function getBalance(address) {
  const provider = getProvider();
  if (!provider || !address) return '0.0';
  try {
    const balanceWei = await provider.getBalance(address);
    return formatEther(balanceWei);
  } catch (err) {
    console.error('Error fetching balance:', err);
    return '0.0';
  }
}

/**
 * Format wallet address to shortened readable format (e.g. 0x1234...5678)
 */
export function formatAddress(address) {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Safe format ether value to human-readable string with fixed decimals
 */
export function formatEthAmount(val, decimals = 4) {
  if (val === undefined || val === null) return '0.00';
  try {
    const num = typeof val === 'bigint' ? parseFloat(formatEther(val)) : parseFloat(val);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals,
    });
  } catch {
    return '0.00';
  }
}

export { formatEther, parseEther };
