'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useWallet } from '../context/WalletContext';
import { useLanguage } from '../context/LanguageContext';
import { isMetaMaskInstalled } from '../lib/wallet';
import { DEFAULT_EXPLORER_URL } from '../lib/constants';

/**
 * ConnectWallet component
 * Integrated MetaMask wallet button handling connection with forced popup dialog,
 * network detection, one-click Sepolia network switching, balance display,
 * account details modal, and interactive MetaMask confirmation prompt on Logout.
 */
export default function ConnectWallet() {
  const {
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
  } = useWallet();

  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Logout confirmation states
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutStatus, setLogoutStatus] = useState(null); // 'waiting_metamask' | 'success' | 'rejected' | null
  const [logoutError, setLogoutError] = useState(null);

  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  const handleCopy = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenModal = () => {
    setShowLogoutConfirm(false);
    setLogoutStatus(null);
    setLogoutError(null);
    setShowWalletModal(true);
  };

  const handleCloseModal = () => {
    if (logoutStatus === 'waiting_metamask') return; // Don't close while MetaMask popup is open
    setShowWalletModal(false);
    setShowLogoutConfirm(false);
    setLogoutStatus(null);
    setLogoutError(null);
  };

  // 1. Interactive logout with forced MetaMask confirmation popup
  const handleDisconnectWithMetaMask = async () => {
    setLogoutStatus('waiting_metamask');
    setLogoutError(null);
    try {
      await disconnect({ requireMetaMask: true, language });
      setLogoutStatus('success');
      setTimeout(() => {
        handleCloseModal();
      }, 1200);
    } catch (err) {
      if (err.code === 4001 || err.message === 'USER_REJECTED_LOGOUT') {
        setLogoutStatus('rejected');
      } else {
        setLogoutError(err.message || 'Logout confirmation failed');
        setLogoutStatus(null);
      }
    }
  };

  // 2. Direct logout without triggering MetaMask
  const handleDirectDisconnect = async () => {
    await disconnect({ requireMetaMask: false });
    handleCloseModal();
  };

  // Prevent SSR hydration mismatch - render matching placeholder button during initial hydration
  if (!mounted) {
    return (
      <button
        disabled
        className="btn btn-info btn-sm d-flex align-items-center px-3.5 py-1.5 fw-bold text-dark shadow-sm rounded-pill opacity-75"
      >
        <i className="bi bi-wallet2 me-1.5"></i> {t('nav.connectWallet')}
      </button>
    );
  }

  // 1. MetaMask not installed (evaluated only after client mount)
  if (!isMetaMaskInstalled()) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-warning btn-sm d-flex align-items-center shadow-sm rounded-pill px-3 fw-medium"
      >
        <i className="bi bi-download me-1.5"></i> {t('nav.installMetaMask')}
      </a>
    );
  }

  // 2. Disconnected state - clicking opens MetaMask permission popup
  if (!account) {
    return (
      <button
        onClick={() => connect(true)}
        disabled={isConnecting}
        className="btn btn-info btn-sm d-flex align-items-center px-3.5 py-1.5 fw-bold text-dark shadow-sm rounded-pill"
        title={language === 'th' ? 'คลิกเพื่อเปิดหน้าต่างเชื่อมต่อใน MetaMask' : 'Click to open MetaMask connection dialog'}
      >
        {isConnecting ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
            {t('nav.connecting')}
          </>
        ) : (
          <>
            <i className="bi bi-wallet2 me-1.5"></i> {t('nav.connectWallet')}
          </>
        )}
      </button>
    );
  }

  // 3. Connected but wrong network
  if (!isSepolia) {
    return (
      <div className="d-flex align-items-center gap-1.5">
        <span className="badge bg-danger-subtle text-danger border border-danger-subtle py-1.5 px-2.5 rounded-pill small">
          <i className="bi bi-exclamation-octagon-fill me-1"></i> {t('nav.wrongNetwork')}
        </span>
        <button
          onClick={switchNetwork}
          className="btn btn-warning btn-sm fw-bold shadow-sm rounded-pill py-1 px-2.5"
          title="Switch MetaMask to Ethereum Sepolia"
        >
          <i className="bi bi-arrow-repeat me-1"></i> {t('nav.switchToSepolia')}
        </button>
      </div>
    );
  }

  // 4. Connected to Sepolia successfully
  return (
    <>
      <div className="wallet-chip">
        {/* Network Badge */}
        <span className="badge bg-dark bg-opacity-75 text-light d-flex align-items-center py-1 px-2 rounded-pill small">
          <span className="pulse-indicator me-1.5"></span>
          Sepolia
        </span>

        {/* Balance */}
        <span className="text-light small font-monospace d-none d-md-inline pe-1">
          <i className="bi bi-coin text-warning me-1"></i>
          {balance} ETH
        </span>

        {/* Trigger Account Modal Button */}
        <button
          type="button"
          onClick={handleOpenModal}
          className="btn btn-xs btn-outline-light d-flex align-items-center font-monospace rounded-pill px-2.5 py-1"
          title={language === 'th' ? 'ดูข้อมูลกระเป๋าและจัดการการเชื่อมต่อ' : 'View account info & manage connection'}
        >
          <i className="bi bi-person-circle text-info me-1"></i>
          <span>{shortAccount}</span>
          <i className="bi bi-chevron-down ms-1 text-muted" style={{ fontSize: '0.65rem' }}></i>
        </button>
      </div>

      {/* Account Details & Logout Modal */}
      {showWalletModal && mounted && createPortal(
        <>
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              zIndex: 9999,
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              overflowY: 'auto',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseModal();
            }}
          >
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px', margin: '1.75rem auto' }}>
              <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
                {/* Modal Header */}
                <div className="modal-header bg-dark text-white border-bottom border-secondary py-3">
                  <h6 className="modal-title fw-bold d-flex align-items-center">
                    <i className="bi bi-wallet2 text-info me-2"></i>
                    {showLogoutConfirm ? t('nav.logoutConfirmTitle') : t('nav.walletModalTitle')}
                  </h6>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={handleCloseModal}
                    disabled={logoutStatus === 'waiting_metamask'}
                    aria-label="Close"
                  ></button>
                </div>

                {/* Modal Body */}
                <div className="modal-body p-4 bg-white">
                  {!showLogoutConfirm ? (
                    /* Normal Account Info View */
                    <>
                      {/* Account Badge & Balance */}
                      <div className="text-center mb-4">
                        <div
                          className="rounded-circle mx-auto mb-2.5 d-flex align-items-center justify-content-center text-white"
                          style={{
                            width: '56px',
                            height: '56px',
                            background: 'linear-gradient(135deg, #0284c7 0%, #10b981 100%)',
                            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
                          }}
                        >
                          <i className="bi bi-person-fill fs-3"></i>
                        </div>
                        <div className="small text-muted mb-1">
                          {language === 'th' ? 'ยอดคงเหลือ Sepolia' : 'Sepolia Balance'}
                        </div>
                        <div className="fs-4 fw-bold font-monospace text-primary">{balance} ETH</div>
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill small mt-1">
                          <span className="pulse-indicator me-1.5"></span>
                          Ethereum Sepolia (11155111)
                        </span>
                      </div>

                      {/* Full Address with Copy */}
                      <div className="bg-light p-3 rounded-3 border mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted small">
                            {language === 'th' ? 'ที่อยู่กระเป๋า (Wallet Address):' : 'Wallet Address:'}
                          </span>
                          <button
                            onClick={handleCopy}
                            className="btn btn-xs btn-outline-secondary py-0.5 px-2 rounded-pill small"
                          >
                            <i className={`bi ${copied ? 'bi-check2 text-success' : 'bi-clipboard'} me-1`}></i>
                            {copied ? t('nav.copied') : language === 'th' ? 'คัดลอก' : 'Copy'}
                          </button>
                        </div>
                        <div className="font-monospace small text-break text-dark bg-white p-2 rounded border">
                          {account}
                        </div>
                      </div>

                      {/* Etherscan Link */}
                      <a
                        href={`${explorerBase}/address/${account}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-secondary w-100 mb-3 d-flex align-items-center justify-content-center"
                      >
                        <i className="bi bi-box-arrow-up-right me-1.5"></i>
                        {t('nav.viewOnEtherscan')}
                      </a>

                      {/* Quick Shortcuts */}
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <Link
                            href="/my-rentals"
                            onClick={handleCloseModal}
                            className="btn btn-sm btn-light w-100 text-start border py-2"
                          >
                            <i className="bi bi-bag-check text-info me-1"></i>
                            <span className="small fw-medium">{t('nav.myRentals')}</span>
                          </Link>
                        </div>
                        <div className="col-6">
                          <Link
                            href="/owner"
                            onClick={handleCloseModal}
                            className="btn btn-sm btn-light w-100 text-start border py-2"
                          >
                            <i className="bi bi-shield-check text-primary me-1"></i>
                            <span className="small fw-medium">{t('nav.ownerPanel')}</span>
                          </Link>
                        </div>
                      </div>

                      {/* Switch Account Tip */}
                      <div className="text-muted small mb-3 text-center" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-info-circle me-1"></i>
                        {t('nav.switchAccountTip')}
                      </div>

                      {/* Disconnect / Logout Trigger Button */}
                      <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(true)}
                        className="btn btn-danger w-100 fw-bold py-2 rounded-3 d-flex align-items-center justify-content-center shadow-sm"
                      >
                        <i className="bi bi-box-arrow-right me-2"></i>
                        {t('nav.disconnect')}
                      </button>
                    </>
                  ) : (
                    /* Interactive MetaMask Logout Confirmation View */
                    <div className="text-center py-2">
                      <div
                        className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center text-danger bg-danger-subtle border border-danger-subtle"
                        style={{ width: '60px', height: '60px' }}
                      >
                        <i className="bi bi-shield-lock-fill fs-2"></i>
                      </div>

                      <h5 className="fw-bold text-dark mb-2">{t('nav.logoutConfirmTitle')}</h5>
                      <p className="text-muted small mb-3 text-start">
                        {t('nav.logoutConfirmDesc')}
                      </p>

                      {/* Status Feedback Banners */}
                      {logoutStatus === 'waiting_metamask' && (
                        <div className="alert alert-warning border border-warning-subtle py-2.5 px-3 mb-3 text-start small">
                          <div className="d-flex align-items-center mb-1">
                            <span className="spinner-border spinner-border-sm text-warning me-2" role="status"></span>
                            <span className="fw-bold text-dark">{t('nav.waitingMetaMaskSign')}</span>
                          </div>
                          <div className="text-muted small">
                            {language === 'th'
                              ? 'หน้าต่าง MetaMask จะเด้งขึ้นมา ให้ตรวจสอบข้อความแล้วกด "ลงนาม (Sign)" เพื่อยืนยัน'
                              : 'Check the MetaMask popup window and click "Sign" to securely confirm logout.'}
                          </div>
                        </div>
                      )}

                      {logoutStatus === 'success' && (
                        <div className="alert alert-success border border-success-subtle py-2.5 px-3 mb-3 text-start small">
                          <i className="bi bi-check-circle-fill text-success me-1.5"></i>
                          <span className="fw-bold">{t('nav.logoutSuccess')}</span>
                        </div>
                      )}

                      {logoutStatus === 'rejected' && (
                        <div className="alert alert-info border border-info-subtle py-2 px-3 mb-3 text-start small">
                          <i className="bi bi-info-circle-fill text-info me-1.5"></i>
                          <span>
                            {t('nav.logoutRejected')}{' '}
                            {language === 'th'
                              ? '(หากต้องการออกจากระบบทันที สามารถกดปุ่ม "ออกจากระบบทันที" ด้านล่าง)'
                              : '(You can use "Disconnect Directly" below to force logout)'}
                          </span>
                        </div>
                      )}

                      {logoutError && (
                        <div className="alert alert-danger py-2 px-3 mb-3 text-start small">
                          <i className="bi bi-exclamation-triangle-fill text-danger me-1.5"></i>
                          <span>{logoutError}</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="d-flex flex-column gap-2 mt-3">
                        {/* Option 1: Confirm in MetaMask (Primary) */}
                        <button
                          type="button"
                          onClick={handleDisconnectWithMetaMask}
                          disabled={logoutStatus === 'waiting_metamask' || logoutStatus === 'success'}
                          className="btn btn-primary fw-bold py-2 rounded-3 d-flex align-items-center justify-content-center shadow-sm"
                        >
                          {logoutStatus === 'waiting_metamask' ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                              {language === 'th' ? 'กำลังรอใน MetaMask...' : 'Waiting for MetaMask...'}
                            </>
                          ) : (
                            <>
                              <i className="bi bi-bell-fill me-2 text-warning"></i>
                              {t('nav.logoutWithMetaMask')}
                            </>
                          )}
                        </button>

                        {/* Option 2: Direct Logout */}
                        <button
                          type="button"
                          onClick={handleDirectDisconnect}
                          disabled={logoutStatus === 'waiting_metamask' || logoutStatus === 'success'}
                          className="btn btn-outline-danger btn-sm py-2 rounded-3 d-flex align-items-center justify-content-center"
                        >
                          <i className="bi bi-box-arrow-right me-1.5"></i>
                          {t('nav.logoutDirect')}
                        </button>

                        {/* Option 3: Cancel / Back */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowLogoutConfirm(false);
                            setLogoutStatus(null);
                            setLogoutError(null);
                          }}
                          disabled={logoutStatus === 'waiting_metamask' || logoutStatus === 'success'}
                          className="btn btn-light btn-sm text-secondary py-1.5 rounded-3"
                        >
                          {t('nav.cancelLogout')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 9990 }}></div>
        </>,
        document.body
      )}
    </>
  );
}
