'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '../../context/WalletContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchAllItems,
  fetchAllRentals,
  isContractConfigured,
} from '../../lib/contract';
import { RENTAL_STATUS, DEFAULT_EXPLORER_URL } from '../../lib/constants';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import RentalStatus from '../../components/RentalStatus';
import RentalCountdown from '../../components/RentalCountdown';
import { formatAddress, formatDateTime } from '../../lib/wallet';

/**
 * Dashboard Page (app/dashboard/page.js)
 * Platform overview showing on-chain metrics, connected wallet status,
 * user-specific statistics, quick navigation buttons, and comprehensive
 * historical rental and transaction ledger on Ethereum Sepolia.
 */
export default function DashboardPage() {
  const { account, isSepolia, balance, connect, isConnecting } = useWallet();
  const { t, language } = useLanguage();

  const [items, setItems] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [itemsMap, setItemsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // History Filter & Search State
  const [historyFilter, setHistoryFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'RETURNED'
  const [historySearch, setHistorySearch] = useState('');

  const contractConfigured = isContractConfigured();
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  const loadBlockchainData = useCallback(async () => {
    if (!contractConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [fetchedItems, fetchedRentals] = await Promise.all([
        fetchAllItems(account),
        fetchAllRentals(account),
      ]);

      const map = {};
      (fetchedItems || []).forEach((item) => {
        map[item.itemId] = item;
      });
      setItemsMap(map);

      setItems(fetchedItems || []);
      setRentals(fetchedRentals || []);
    } catch (err) {
      console.warn('Dashboard data fetch notice:', err.message);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [contractConfigured, account]);

  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    loadBlockchainData();
    if (!autoSync) return;
    const interval = setInterval(() => {
      loadBlockchainData();
    }, 6000);
    return () => clearInterval(interval);
  }, [loadBlockchainData, autoSync]);

  // Derived metrics
  const totalItems = items.length;
  const availableItems = items.filter((i) => i.available).length;
  const activeRentals = rentals.filter((r) => r.status === RENTAL_STATUS.ACTIVE).length;
  const completedRentals = rentals.filter(
    (r) => r.status === RENTAL_STATUS.RETURNED || r.status === RENTAL_STATUS.COMPLETED
  ).length;
  const cancelledRentals = rentals.filter(
    (r) => r.status === RENTAL_STATUS.CANCELLED
  ).length;

  const myRentalsCount = account
    ? rentals.filter((r) => r.renter?.toLowerCase() === account.toLowerCase()).length
    : 0;
  const myOwnedItemsCount = account
    ? items.filter((i) => i.owner?.toLowerCase() === account.toLowerCase()).length
    : 0;

  // Filter history records
  const filteredRentals = rentals.filter((r) => {
    const item = itemsMap[r.itemId];
    const itemName = item?.name || '';
    
    // Status filter
    let matchesStatus = true;
    if (historyFilter === 'ACTIVE') matchesStatus = r.status === RENTAL_STATUS.ACTIVE;
    if (historyFilter === 'RETURNED') {
      matchesStatus = r.status === RENTAL_STATUS.RETURNED || r.status === RENTAL_STATUS.COMPLETED;
    }
    if (historyFilter === 'CANCELLED') {
      matchesStatus = r.status === RENTAL_STATUS.CANCELLED;
    }
    if (historyFilter === 'MY_TRANSACTIONS' && account) {
      matchesStatus =
        (r.renter && r.renter.toLowerCase() === account.toLowerCase()) ||
        (r.owner && r.owner.toLowerCase() === account.toLowerCase());
    }

    // Search filter
    const query = historySearch.trim().toLowerCase();
    let matchesSearch = true;
    if (query) {
      matchesSearch =
        String(r.rentalId).includes(query) ||
        String(r.itemId).includes(query) ||
        itemName.toLowerCase().includes(query) ||
        (r.renter && r.renter.toLowerCase().includes(query)) ||
        (r.owner && r.owner.toLowerCase().includes(query));
    }

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="container py-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">{t('dashboard.title')}</h2>
          <p className="text-muted small mb-0">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <div className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1.5 rounded-pill small d-flex align-items-center gap-1.5 shadow-xs">
            <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '8px', height: '8px' }} role="status"></span>
            <span>{language === 'th' ? 'ซิงค์สด Real-Time จาก Sepolia' : 'Live Real-Time from Sepolia'}</span>
          </div>

          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`btn btn-sm ${autoSync ? 'btn-outline-success' : 'btn-outline-secondary'} rounded-pill`}
            title={language === 'th' ? 'เปิด/ปิดการดึงข้อมูลอัตโนมัติ' : 'Toggle live auto-refresh'}
          >
            <i className={`bi ${autoSync ? 'bi-check2-circle' : 'bi-pause-circle'} me-1`}></i>
            {language === 'th' ? (autoSync ? 'Auto-Sync: เปิด' : 'Auto-Sync: พัก') : (autoSync ? 'Auto-Sync: On' : 'Paused')}
          </button>

          <button
            onClick={loadBlockchainData}
            disabled={loading || !contractConfigured}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center rounded-pill"
          >
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>
            {t('dashboard.refreshBtn')}
          </button>
        </div>
      </div>

      {/* Contract Configuration Notice */}
      {!contractConfigured && (
        <div className="alert alert-info shadow-sm mb-4 rounded-3">
          <div className="d-flex align-items-start">
            <i className="bi bi-gear-wide-connected fs-4 text-primary me-3"></i>
            <div>
              <h6 className="fw-bold mb-1">
                {language === 'th' ? 'ต้องกำหนดที่อยู่สัญญา (Contract Address)' : 'Contract Address Required'}
              </h6>
              <p className="small mb-2">
                {language === 'th'
                  ? 'ยังไม่ได้กำหนดที่อยู่ Smart Contract ในไฟล์ .env.local เมื่อคุณ Deploy สัญญาด้วย Remix IDE ไปยัง Sepolia แล้ว ให้กำหนดค่า:'
                  : 'The smart contract address has not yet been set in .env.local. Once you deploy your contract using Remix IDE to Ethereum Sepolia, set:'}
              </p>
              <pre className="bg-light p-2 rounded border small mb-2">
                NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddress
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Connection Status Card */}
      <div className="card shadow-sm border mb-4 bg-white rounded-4 overflow-hidden">
        <div className="card-body p-4">
          <div className="row align-items-center gy-3">
            <div className="col-md-7">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-white p-3"
                  style={{
                    width: '54px',
                    height: '54px',
                    background: account
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                  }}
                >
                  <i className={`bi ${account ? 'bi-wallet-fill' : 'bi-wallet2'} fs-4`}></i>
                </div>

                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <h5 className="fw-bold text-dark mb-0">
                      {account ? t('dashboard.walletConnected') : t('dashboard.walletDisconnected')}
                    </h5>
                    {account && isSepolia && (
                      <span className="badge bg-success-subtle text-success border border-success-subtle small rounded-pill">
                        {t('dashboard.sepoliaVerified')}
                      </span>
                    )}
                  </div>
                  {account ? (
                    <div className="small text-muted font-monospace">
                      <span>{account}</span>
                      <a
                        href={`${explorerBase}/address/${account}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ms-2 text-primary text-decoration-none"
                      >
                        <i className="bi bi-box-arrow-up-right"></i>
                      </a>
                    </div>
                  ) : (
                    <p className="text-muted small mb-0">
                      {language === 'th'
                        ? 'เชื่อมต่อกระเป๋า MetaMask เพื่อเช่าทรัพย์สิน จัดการสิ่งของของคุณ และเซ็นยืนยันธุรกรรม'
                        : 'Connect your MetaMask wallet to rent assets, manage registrations, and sign transactions.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-5 text-md-end">
              {account ? (
                <div className="d-inline-flex flex-column align-items-md-end">
                  <div className="small text-muted mb-1">{t('dashboard.balanceLabel')}</div>
                  <div className="fs-4 fw-bold font-monospace text-primary">{balance} ETH</div>
                </div>
              ) : (
                <button
                  onClick={connect}
                  disabled={isConnecting}
                  className="btn btn-primary fw-bold px-4 py-2 rounded-3"
                >
                  <i className="bi bi-wallet2 me-2"></i>
                  {isConnecting ? t('nav.connecting') : t('nav.connectWallet')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message if fetch failed */}
      {error && <ErrorMessage error={error} onRetry={loadBlockchainData} />}

      {/* Statistics Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
            <span className="text-muted small mb-1">{t('dashboard.totalItems')}</span>
            <div className="fs-3 fw-bold text-dark">{loading ? '-' : totalItems}</div>
            <span className="badge bg-light text-secondary border small mt-1">On-Chain</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
            <span className="text-muted small mb-1">{t('dashboard.availableItems')}</span>
            <div className="fs-3 fw-bold text-success">{loading ? '-' : availableItems}</div>
            <span className="badge bg-success-subtle text-success small mt-1">{t('common.available')}</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
            <span className="text-muted small mb-1">{t('dashboard.activeRentals')}</span>
            <div className="fs-3 fw-bold text-primary">{loading ? '-' : activeRentals}</div>
            <span className="badge bg-primary-subtle text-primary small mt-1">{t('common.active')}</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
            <span className="text-muted small mb-1">{t('dashboard.completed')}</span>
            <div className="fs-3 fw-bold text-info">{loading ? '-' : completedRentals}</div>
            <span className="badge bg-info-subtle text-info small mt-1">{t('common.returned')}</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
            <span className="text-muted small mb-1">{t('dashboard.myRentals')}</span>
            <div className="fs-3 fw-bold text-dark">{account ? myRentalsCount : '-'}</div>
            <span className="badge bg-secondary-subtle text-secondary small mt-1">{language === 'th' ? 'ที่เช่าไว้' : 'Rented by You'}</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
            <span className="text-muted small mb-1">{t('dashboard.myAssets')}</span>
            <div className="fs-3 fw-bold text-dark">{account ? myOwnedItemsCount : '-'}</div>
            <span className="badge bg-secondary-subtle text-secondary small mt-1">{language === 'th' ? 'ที่คุณเป็นเจ้าของ' : 'Owned by You'}</span>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="card shadow-sm border mb-4 bg-white rounded-4">
        <div className="card-header bg-light py-3">
          <h5 className="fw-bold text-dark mb-0">
            <i className="bi bi-grid-3x3-gap-fill text-primary me-2"></i>
            {t('dashboard.quickActions')}
          </h5>
        </div>
        <div className="card-body p-4">
          <div className="row g-3">
            <div className="col-sm-6 col-lg-3">
              <Link
                href="/rentals"
                className="btn btn-outline-primary w-100 p-3 text-start d-flex align-items-center gap-3 h-100 shadow-sm rounded-3"
              >
                <div className="bg-primary text-white p-2.5 rounded-3 fs-4">
                  <i className="bi bi-search"></i>
                </div>
                <div>
                  <div className="fw-bold">{t('dashboard.quickBrowse')}</div>
                  <div className="text-muted small">{t('dashboard.quickBrowseSub')}</div>
                </div>
              </Link>
            </div>

            <div className="col-sm-6 col-lg-3">
              <Link
                href="/register"
                className="btn btn-outline-success w-100 p-3 text-start d-flex align-items-center gap-3 h-100 shadow-sm rounded-3"
              >
                <div className="bg-success text-white p-2.5 rounded-3 fs-4">
                  <i className="bi bi-plus-lg"></i>
                </div>
                <div>
                  <div className="fw-bold">{t('dashboard.quickRegister')}</div>
                  <div className="text-muted small">{t('dashboard.quickRegisterSub')}</div>
                </div>
              </Link>
            </div>

            <div className="col-sm-6 col-lg-3">
              <Link
                href="/my-rentals"
                className="btn btn-outline-info w-100 p-3 text-start d-flex align-items-center gap-3 h-100 shadow-sm rounded-3"
              >
                <div className="bg-info text-white p-2.5 rounded-3 fs-4">
                  <i className="bi bi-bag-check"></i>
                </div>
                <div>
                  <div className="fw-bold text-dark">{t('dashboard.quickMyRentals')}</div>
                  <div className="text-muted small">{t('dashboard.quickMyRentalsSub')}</div>
                </div>
              </Link>
            </div>

            <div className="col-sm-6 col-lg-3">
              <Link
                href="/owner"
                className="btn btn-outline-dark w-100 p-3 text-start d-flex align-items-center gap-3 h-100 shadow-sm rounded-3"
              >
                <div className="bg-dark text-white p-2.5 rounded-3 fs-4">
                  <i className="bi bi-shield-check"></i>
                </div>
                <div>
                  <div className="fw-bold">{t('dashboard.quickOwner')}</div>
                  <div className="text-muted small">{t('dashboard.quickOwnerSub')}</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Blockchain Rental & Transaction History Section */}
      <div className="card shadow-sm border bg-white rounded-4 overflow-hidden">
        <div className="card-header bg-light py-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <h5 className="fw-bold text-dark mb-0">
                <i className="bi bi-clock-history text-primary me-2"></i>
                {t('dashboard.recentActivity')}
              </h5>
              <span className="text-muted small">
                {language === 'th' ? 'ประวัติสัญญาเช่าและการโอนเงินมัดจำทั้งหมดบนเครือข่าย Sepolia' : 'All rental agreements & deposit escrows on Ethereum Sepolia'}
              </span>
            </div>

            {/* Filter Tabs & Search */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="btn-group btn-group-sm">
                <button
                  className={`btn ${historyFilter === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setHistoryFilter('ALL')}
                >
                  {t('common.all')} ({rentals.length})
                </button>
                {account && (
                  <button
                    className={`btn ${historyFilter === 'MY_TRANSACTIONS' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setHistoryFilter('MY_TRANSACTIONS')}
                    title={language === 'th' ? 'กรองเฉพาะรายการที่ฉันเช่าหรือเป็นเจ้าของ' : 'Filter records involving your wallet'}
                  >
                    <i className="bi bi-person-fill me-1"></i>
                    {language === 'th' ? 'ประวัติของฉัน' : 'My History'} (
                    {
                      rentals.filter(
                        (r) =>
                          (r.renter && r.renter.toLowerCase() === account.toLowerCase()) ||
                          (r.owner && r.owner.toLowerCase() === account.toLowerCase())
                      ).length
                    }
                    )
                  </button>
                )}
                <button
                  className={`btn ${historyFilter === 'ACTIVE' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setHistoryFilter('ACTIVE')}
                >
                  {t('common.active')} ({activeRentals})
                </button>
                <button
                  className={`btn ${historyFilter === 'RETURNED' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setHistoryFilter('RETURNED')}
                >
                  {t('common.returned')} ({completedRentals})
                </button>
                <button
                  className={`btn ${historyFilter === 'CANCELLED' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setHistoryFilter('CANCELLED')}
                >
                  {t('common.cancelled')} ({cancelledRentals})
                </button>
              </div>

              <div className="input-group input-group-sm" style={{ width: '200px' }}>
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted small"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder={language === 'th' ? 'ค้นหาประวัติ...' : 'Search records...'}
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <Loading message={language === 'th' ? 'กำลังอ่านกิจกรรมการเช่าจาก Sepolia...' : 'Reading rental activity from Sepolia...'} />
          ) : filteredRentals.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
              <p className="mb-0">
                {rentals.length === 0
                  ? t('dashboard.noRecentRentals')
                  : language === 'th' ? 'ไม่พบรายการที่ตรงกับคำค้นหา' : 'No records match your filter criteria.'}
              </p>
              {rentals.length === 0 && (
                <div className="mt-3">
                  <Link href="/rentals" className="btn btn-sm btn-primary rounded-3">
                    {language === 'th' ? 'ค้นหาทรัพย์สินเพื่อสร้างรายการเช่าแรก' : 'Browse Items to Create First Rental'}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>{t('dashboard.tableRentalId')}</th>
                    <th>{t('dashboard.tableItemId')}</th>
                    <th>{t('common.owner')}</th>
                    <th>{t('dashboard.tableRenter')}</th>
                    <th>{language === 'th' ? 'ระยะเวลา (Timeline)' : 'Timeline'}</th>
                    <th>{language === 'th' ? 'นับถอยหลัง Real-time' : 'Live Status'}</th>
                    <th>{t('dashboard.tableTotalPaid')}</th>
                    <th>{t('dashboard.tableDeposit')}</th>
                    <th>{t('dashboard.tableStatus')}</th>
                    <th className="text-end">{t('dashboard.tableAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRentals.slice().reverse().map((r) => {
                    const item = itemsMap[r.itemId];
                    return (
                      <tr key={r.rentalId}>
                        <td className="fw-bold font-monospace">#{r.rentalId}</td>
                        <td>
                          <Link href={`/rentals/${r.itemId}`} className="fw-medium text-dark text-decoration-none">
                            {item ? item.name : `Item #${r.itemId}`}
                          </Link>
                        </td>
                        <td className="font-monospace text-secondary">
                          <a
                            href={`${explorerBase}/address/${r.owner}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none text-secondary"
                            title="View owner on Etherscan"
                          >
                            {formatAddress(r.owner)}
                          </a>
                        </td>
                        <td className="font-monospace text-secondary">
                          <a
                            href={`${explorerBase}/address/${r.renter}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none text-secondary"
                            title="View renter on Etherscan"
                          >
                            {formatAddress(r.renter)} <i className="bi bi-box-arrow-up-right small"></i>
                          </a>
                        </td>
                        <td>
                          <div className="font-monospace text-dark small">
                            <div>{formatDateTime(r.startTime, language)}</div>
                            <div className="text-muted">{formatDateTime(r.endTime, language)}</div>
                          </div>
                        </td>
                        <td>
                          <RentalCountdown
                            endTime={r.endTime}
                            startTime={r.startTime}
                            status={r.status}
                            compact={true}
                          />
                        </td>
                        <td className="font-monospace fw-medium text-primary">{r.totalPaidEth} ETH</td>
                        <td className="font-monospace text-success">+{r.depositEth} ETH</td>
                        <td>
                          <RentalStatus status={r.status} />
                        </td>
                        <td className="text-end">
                          <Link
                            href={`/claims?id=${r.rentalId}`}
                            className="btn btn-xs btn-outline-info py-1 px-2 rounded-pill me-1 text-decoration-none"
                            title={language === 'th' ? 'ตรวจสัญญา' : 'Audit'}
                          >
                            {language === 'th' ? 'ตรวจสัญญา' : 'Audit'}
                          </Link>
                          <Link href={`/rentals/${r.itemId}`} className="btn btn-xs btn-outline-secondary py-1 px-2.5 rounded-pill text-decoration-none">
                            {t('dashboard.viewItem')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
