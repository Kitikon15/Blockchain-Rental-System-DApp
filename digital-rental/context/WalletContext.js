'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  isMetaMaskInstalled,
  getProvider,
  getAccount,
  getChainId,
  switchToSepolia,
  formatAddress,
  requestAccountPermissions,
  revokeAccountPermissions,
  requestLogoutConfirmation,
} from '../lib/wallet';
import { SEPOLIA_CHAIN_ID } from '../lib/constants';
import { formatEther } from 'ethers';

const WalletContext = createContext({
  account: null,
  shortAccount: '',
  chainId: null,
  isSepolia: false,
  balance: '0.0',
  isConnecting: false,
  isDisconnecting: false,
  error: null,
  connect: async () => {},
  disconnect: async () => {},
  switchNetwork: async () => {},
  syncWalletState: async () => {},
});

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState('0.0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState(null);

  const isSepolia = chainId === SEPOLIA_CHAIN_ID;
  const shortAccount = formatAddress(account);

  // Update account balance
  const updateBalance = useCallback(async (addr) => {
    if (!addr) {
      setBalance('0.0');
      return;
    }
    const provider = getProvider();
    if (!provider) return;
    try {
      const balWei = await provider.getBalance(addr);
      setBalance(parseFloat(formatEther(balWei)).toFixed(4));
    } catch (err) {
      console.warn('Error fetching balance:', err);
    }
  }, []);

  // Sync state with current MetaMask state
  const syncWalletState = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    try {
      // Check if user manually clicked Logout previously
      const isDisconnected = localStorage.getItem('blockrental_disconnected') === 'true';
      if (isDisconnected) {
        setAccount(null);
        setBalance('0.0');
        const currentChainId = await getChainId();
        setChainId(currentChainId);
        return;
      }

      const currentAccount = await getAccount();
      const currentChainId = await getChainId();

      setAccount(currentAccount);
      setChainId(currentChainId);

      if (currentAccount) {
        await updateBalance(currentAccount);
      } else {
        setBalance('0.0');
      }
    } catch (err) {
      console.error('Wallet sync error:', err);
    }
  }, [updateBalance]);

  // Connect wallet action with interactive MetaMask popup
  const connect = async (forcePopup = true) => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed. Please install MetaMask to use this application.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Clear manual disconnect flag
      localStorage.removeItem('blockrental_disconnected');

      // Force MetaMask popup by requesting permissions first if desired
      if (forcePopup) {
        try {
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch (permErr) {
          if (permErr.code === 4001) {
            throw permErr;
          }
          console.warn('wallet_requestPermissions fallback:', permErr?.message);
        }
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const currentChainId = await getChainId();

      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        setChainId(currentChainId);
        await updateBalance(accounts[0]);
      }
    } catch (err) {
      if (err.code === 4001) {
        setError('การเชื่อมต่อถูกยกเลิกใน MetaMask (Connection rejected in MetaMask)');
      } else {
        setError(err.message || 'Failed to connect MetaMask.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect / Logout wallet action with optional MetaMask confirmation popup
  const disconnect = async (options = {}) => {
    const { requireMetaMask = false, language = 'th' } =
      typeof options === 'boolean' ? { requireMetaMask: options } : options;

    setError(null);

    if (requireMetaMask && account) {
      setIsDisconnecting(true);
      try {
        // 1. Trigger MetaMask personal_sign confirmation popup
        await requestLogoutConfirmation(account, language);
        // 2. Revoke permissions in MetaMask
        await revokeAccountPermissions();
      } catch (err) {
        setIsDisconnecting(false);
        if (err.code === 4001 || err.message === 'USER_REJECTED_LOGOUT') {
          const rejectErr = new Error('USER_REJECTED_LOGOUT');
          rejectErr.code = 4001;
          throw rejectErr;
        }
        console.warn('MetaMask logout error:', err);
      } finally {
        setIsDisconnecting(false);
      }
    }

    setAccount(null);
    setBalance('0.0');
    try {
      localStorage.setItem('blockrental_disconnected', 'true');
    } catch (e) {}
  };

  // Switch network to Sepolia
  const switchNetwork = async () => {
    setError(null);
    try {
      await switchToSepolia();
      const newChainId = await getChainId();
      setChainId(newChainId);
    } catch (err) {
      setError(err.message || 'Failed to switch network.');
    }
  };

  // Listen to MetaMask lifecycle events
  useEffect(() => {
    syncWalletState();

    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        const isDisconnected = localStorage.getItem('blockrental_disconnected') === 'true';
        if (isDisconnected || accounts.length === 0) {
          setAccount(null);
          setBalance('0.0');
        } else {
          setAccount(accounts[0]);
          updateBalance(accounts[0]);
        }
      };

      const handleChainChanged = (hexChainId) => {
        const newId = parseInt(hexChainId, 16);
        setChainId(newId);
        if (account) {
          updateBalance(account);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [syncWalletState, updateBalance, account]);

  return (
    <WalletContext.Provider
      value={{
        account,
        shortAccount,
        chainId,
        isSepolia,
        balance,
        isConnecting,
        isDisconnecting,
        error,
        connect,
        disconnect,
        switchNetwork,
        syncWalletState,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
