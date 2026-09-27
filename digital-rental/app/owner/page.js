'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '../../context/WalletContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchAllItems,
  fetchAllRentals,
  updateItemAvailabilityOnChain,
  isContractConfigured,
  parseContractError,
} from '../../lib/contract';
import { RENTAL_STATUS, DEFAULT_EXPLORER_URL } from '../../lib/constants';
import RentalStatus from '../../components/RentalStatus';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import TransactionStatus from '../../components/TransactionStatus';
import { formatAddress } from '../../lib/wallet';

/**
 * Owner Dashboard (app/owner/page.js)
 * Dedicated portal for asset owners to monitor their listed items, toggle availability,
 * track active rentals, and review historical earnings on Ethereum Sepolia with i18n support.
 */
export default function OwnerDashboardPage() {
  const { account, isSepolia, connect, switchNetwork } = useWallet();
  const { t, language } = useLanguage();

  const [myItems, setMyItems] = useState([]);
  const [ownerRentals, setOwnerRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Availability Toggle State
  const [togglingItemId, setTogglingItemId] = useState(null);
  const [toggleTxState, setToggleTxState] = useState(null);
  const [toggleTxHash, setToggleTxHash] = useState(null);
  const [toggleError, setToggleError] = useState(null);

  const contractConfigured = isContractConfigured();
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  const loadOwnerData = useCallback(async () => {
    if (!contractConfigured || !account) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [allItems, allRentals] = await Promise.all([
        fetchAllItems(account),
        fetchAllRentals(account),
      ]);

      const owned = (allItems || []).filter(
        (i) => i.owner && i.owner.toLowerCase() === account.toLowerCase()
      );
      setMyItems(owned);

      const relevantRentals = (allRentals || []).filter(
        (r) => r.owner && r.owner.toLowerCase() === account.toLowerCase()
      );
      setOwnerRentals(relevantRentals);
    } catch (err) {
      console.warn('Error loading owner data:', err.message);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [contractConfigured, account]);

  useEffect(() => {
    loadOwnerData();
  }, [loadOwnerData]);

  // Handle toggling availability
  const handleToggle = async (item) => {
    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    setTogglingItemId(item.itemId);
    setToggleTxState('waiting_approval');
    setToggleError(null);

    try {
      const newAvailability = !item.available;
      const { hash } = await updateItemAvailabilityOnChain(item.itemId, newAvailability);
      setToggleTxHash(hash);
      setToggleTxState('confirmed');
      await loadOwnerData();
    } catch (err) {
      console.error('Error toggling availability:', err);
      setToggleError(parseContractError(err));
      setToggleTxState('failed');
    } finally {
      setTogglingItemId(null);
    }
  };

  // Metrics
  const totalOwned = myItems.length;
  const availableCount = myItems.filter((i) => i.available).length;
  const rentedCount = totalOwned - availableCount;
  const activeRentalsCount = ownerRentals.filter((r) => r.status === RENTAL_STATUS.ACTIVE).length;
  const completedRentalsCount = ownerRentals.filter(
    (r) => r.status === RENTAL_STATUS.RETURNED || r.status === RENTAL_STATUS.COMPLETED
  ).length;

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">{t('owner.title')}</h2>
          <p className="text-muted small mb-0">
            {t('owner.subtitle')}
          </p>
        </div>

        <div className="d-flex gap-2">
          <button
            onClick={loadOwnerData}
            disabled={loading || !account}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center"
          >
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>
            {t('owner.refreshData')}
          </button>
          <Link href="/register" className="btn btn-primary btn-sm d-flex align-items-center">
            <i className="bi bi-plus-circle me-1"></i> {t('owner.addAsset')}
          </Link>
        </div>
      </div>

      {/* Disconnected state */}
      {!account ? (
        <div className="card shadow-sm border text-center py-5 bg-white">
          <div className="card-body p-4">
            <i className="bi bi-shield-lock text-primary fs-1 mb-3 d-block"></i>
            <h4 className="fw-bold text-dark">{t('owner.authTitle')}</h4>
            <p className="text-muted small mb-4" style={{ maxWidth: '440px', margin: '0 auto' }}>
              {t('owner.authDesc')}
            </p>
            <button onClick={connect} className="btn btn-primary fw-bold px-4 py-2">
              <i className="bi bi-wallet2 me-2"></i> {t('nav.connectWallet')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Owner Statistics Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statTotalAssets')}</span>
                <div className="fs-3 fw-bold text-dark">{loading ? '-' : totalOwned}</div>
                <span className="badge bg-light text-secondary border small mt-1">{language === 'th' ? 'ลงทะเบียนแล้ว' : 'Registered'}</span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statAvailable')}</span>
                <div className="fs-3 fw-bold text-success">{loading ? '-' : availableCount}</div>
                <span className="badge bg-success-subtle text-success small mt-1">{t('common.available')}</span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statRentedOut')}</span>
                <div className="fs-3 fw-bold text-primary">{loading ? '-' : rentedCount}</div>
                <span className="badge bg-primary-subtle text-primary small mt-1">{language === 'th' ? 'ส่งมอบแล้ว' : 'In Custody'}</span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statActiveRentals')}</span>
                <div className="fs-3 fw-bold text-info">{loading ? '-' : activeRentalsCount}</div>
                <span className="badge bg-info-subtle text-info small mt-1">{t('common.active')}</span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statCompleted')}</span>
                <div className="fs-3 fw-bold text-success">{loading ? '-' : completedRentalsCount}</div>
                <span className="badge bg-success-subtle text-success small mt-1">{language === 'th' ? 'คืนแล้ว' : 'Returned'}</span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statTransactions')}</span>
                <div className="fs-3 fw-bold text-dark">{loading ? '-' : ownerRentals.length}</div>
                <span className="badge bg-secondary-subtle text-secondary small mt-1">{language === 'th' ? 'ธุรกรรม' : 'Transactions'}</span>
              </div>
            </div>
          </div>

          {/* Toggle Availability Transaction Status Alert */}
          {toggleTxState && (
            <TransactionStatus
              status={toggleTxState}
              txHash={toggleTxHash}
              errorMessage={toggleError}
              onReset={() => setToggleTxState(null)}
            />
          )}

          {error && <ErrorMessage error={error} onRetry={loadOwnerData} />}

          {/* Section 1: Registered Assets Table */}
          <div className="card shadow-sm border bg-white mb-5">
            <div className="card-header bg-light d-flex justify-content-between align-items-center py-3">
              <h5 className="fw-bold text-dark mb-0">
                <i className="bi bi-box-seam text-primary me-2"></i>
                {t('owner.registeredAssetsTitle')} ({myItems.length})
              </h5>
              <Link href="/register" className="btn btn-sm btn-primary">
                <i className="bi bi-plus me-1"></i> {t('owner.addAsset')}
              </Link>
            </div>

            <div className="card-body p-0">
              {loading ? (
                <Loading message={language === 'th' ? 'กำลังอ่านทรัพย์สินของคุณจาก Ethereum Sepolia...' : 'Reading your registered assets from Ethereum Sepolia...'} />
              ) : myItems.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 mb-2 d-block"></i>
                  <h6 className="fw-bold text-dark">{t('owner.noAssetsRegistered')}</h6>
                  <p className="small mb-3">{t('owner.noAssetsDesc')}</p>
                  <Link href="/register" className="btn btn-primary btn-sm">
                    {t('owner.btnRegisterFirst')}
                  </Link>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light small">
                      <tr>
                        <th>ID</th>
                        <th>{language === 'th' ? 'ชื่อทรัพย์สิน' : 'Item Name'}</th>
                        <th>{language === 'th' ? 'หมวดหมู่' : 'Category'}</th>
                        <th>{t('common.dailyRate')}</th>
                        <th>{t('common.securityDeposit')}</th>
                        <th>{t('common.status')}</th>
                        <th className="text-end">{language === 'th' ? 'จัดการความพร้อม' : 'Availability Action'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myItems.map((item) => (
                        <tr key={item.itemId}>
                          <td className="fw-bold font-monospace">#{item.itemId}</td>
                          <td>
                            <Link href={`/rentals/${item.itemId}`} className="fw-semibold text-dark text-decoration-none">
                              {item.name}
                            </Link>
                          </td>
                          <td>
                            <span className="badge bg-light text-primary border small">
                              {t(`categories.${item.category}`) || item.category}
                            </span>
                          </td>
                          <td className="font-monospace text-primary fw-medium">
                            {item.rentalPriceEth} ETH
                          </td>
                          <td className="font-monospace small text-muted">
                            {item.depositEth} ETH
                          </td>
                          <td>
                            <RentalStatus available={item.available} />
                          </td>
                          <td className="text-end">
                            <div className="btn-group">
                              <Link
                                href={`/rentals/${item.itemId}`}
                                className="btn btn-outline-secondary btn-sm"
                                title="View detailed specs"
                              >
                                <i className="bi bi-eye"></i> {t('owner.btnSpecs')}
                              </Link>
                              <button
                                onClick={() => handleToggle(item)}
                                disabled={togglingItemId === item.itemId}
                                className={`btn btn-sm ${item.available ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                title={item.available ? 'Pause availability' : 'Make available'}
                              >
                                {togglingItemId === item.itemId ? (
                                  <span className="spinner-border spinner-border-sm" role="status"></span>
                                ) : item.available ? (
                                  <>
                                    <i className="bi bi-pause-fill me-1"></i> {t('owner.actionPause')}
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-play-fill me-1"></i> {t('owner.actionActivate')}
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Rentals on Owner's Assets */}
          <div className="card shadow-sm border bg-white">
            <div className="card-header bg-light d-flex justify-content-between align-items-center py-3">
              <h5 className="fw-bold text-dark mb-0">
                <i className="bi bi-file-earmark-text text-secondary me-2"></i>
                {t('owner.rentalsOnYourAssets')} ({ownerRentals.length})
              </h5>
              <span className="badge bg-secondary-subtle text-secondary small">
                Sepolia Audit Trail
              </span>
            </div>

            <div className="card-body p-0">
              {loading ? (
                <Loading message="Reading rental activity..." />
              ) : ownerRentals.length === 0 ? (
                <div className="text-center py-4 text-muted small">
                  {t('owner.noRentalsOnAssets')}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 small">
                    <thead className="table-light">
                      <tr>
                        <th>{t('dashboard.tableRentalId')}</th>
                        <th>{t('dashboard.tableItemId')}</th>
                        <th>{t('dashboard.tableRenter')}</th>
                        <th>{language === 'th' ? 'ระยะเวลาการเช่า' : 'Rental Period'}</th>
                        <th>{t('dashboard.tableTotalPaid')}</th>
                        <th>{t('dashboard.tableDeposit')}</th>
                        <th>{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownerRentals.map((r) => (
                        <tr key={r.rentalId}>
                          <td className="fw-bold font-monospace">#{r.rentalId}</td>
                          <td>
                            <Link href={`/rentals/${r.itemId}`} className="text-decoration-none">
                              {language === 'th' ? `ทรัพย์สิน #${r.itemId}` : `Item #${r.itemId}`}
                            </Link>
                          </td>
                          <td className="font-monospace">
                            <a
                              href={`${explorerBase}/address/${r.renter}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-decoration-none text-secondary"
                            >
                              {formatAddress(r.renter)} <i className="bi bi-box-arrow-up-right small"></i>
                            </a>
                          </td>
                          <td>
                            {new Date(r.startTime * 1000).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')} -{' '}
                            {new Date(r.endTime * 1000).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')}
                          </td>
                          <td className="font-monospace text-primary fw-medium">{r.totalPaidEth} ETH</td>
                          <td className="font-monospace text-success">{r.depositEth} ETH</td>
                          <td>
                            <RentalStatus status={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
