'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '../../context/WalletContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchAllRentals,
  fetchAllItems,
  returnItemOnChain,
  cancelRentalOnChain,
  extendRentalOnChain,
  isContractConfigured,
  parseContractError,
} from '../../lib/contract';
import { RENTAL_STATUS, DEFAULT_EXPLORER_URL } from '../../lib/constants';
import RentalCard from '../../components/RentalCard';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import TransactionStatus from '../../components/TransactionStatus';
import RentalStatus from '../../components/RentalStatus';
import RentalCountdown from '../../components/RentalCountdown';
import { formatAddress, formatDateTime } from '../../lib/wallet';

/**
 * My Rentals Page (app/my-rentals/page.js)
 * Displays active rentals, security deposit recovery status,
 * and comprehensive completed rental transaction history with i18n support.
 */
export default function MyRentalsPage() {
  const { account, isSepolia, connect, switchNetwork } = useWallet();
  const { t, language } = useLanguage();

  const [myRentals, setMyRentals] = useState([]);
  const [itemsMap, setItemsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Filter: 'ACTIVE' | 'RETURNED' | 'ALL' | 'CANCELLED'
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  // Return & Cancel Action Modals State
  const [actionRental, setActionRental] = useState(null);
  const [actionType, setActionType] = useState(null); // 'RETURN' | 'CANCEL'
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  // Extend Rental Modal State
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [extendRentalItem, setExtendRentalItem] = useState(null);
  const [extendDurationValue, setExtendDurationValue] = useState(2);
  const [extendDurationUnit, setExtendDurationUnit] = useState('minutes'); // 'minutes' | 'hours' | 'days'
  const [extendTxState, setExtendTxState] = useState(null);
  const [extendTxHash, setExtendTxHash] = useState(null);
  const [extendError, setExtendError] = useState(null);
  const [isExtending, setIsExtending] = useState(false);

  // Blockchain Transaction States
  const [txState, setTxState] = useState(null); // 'waiting_approval' | 'pending' | 'confirmed' | 'failed'
  const [txHash, setTxHash] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const contractConfigured = isContractConfigured();
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  const loadUserRentals = useCallback(async () => {
    if (!contractConfigured || !account) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [allRentals, allItems] = await Promise.all([
        fetchAllRentals(account),
        fetchAllItems(account),
      ]);

      const map = {};
      (allItems || []).forEach((item) => {
        map[item.itemId] = item;
      });
      setItemsMap(map);

      const userRentals = (allRentals || []).filter(
        (r) => r.renter && r.renter.toLowerCase() === account.toLowerCase()
      );
      setMyRentals(userRentals);
    } catch (err) {
      console.warn('Could not load user rentals:', err.message);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [contractConfigured, account]);

  // Auto-Sync state for real-time live updates
  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    loadUserRentals();
    if (!autoSync) return;
    const interval = setInterval(() => {
      loadUserRentals();
    }, 6000);
    return () => clearInterval(interval);
  }, [loadUserRentals, autoSync]);

  // Check URL query parameters on mount (e.g. ?status=ACTIVE)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const qStatus = params.get('status');
      if (qStatus && ['ACTIVE', 'RETURNED', 'ALL', 'CANCELLED'].includes(qStatus.toUpperCase())) {
        setStatusFilter(qStatus.toUpperCase());
      }
    } catch (_) {}
  }, []);

  // Open confirmation modal for Return or Cancel
  const handleOpenActionModal = (rental, type) => {
    setActionRental(rental);
    setActionType(type);
    setIsActionModalOpen(true);
    setTxState(null);
    setTxHash(null);
    setActionError(null);
  };

  const handleExecuteAction = async () => {
    if (!actionRental) return;

    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    setTxState('waiting_approval');

    try {
      let result;
      if (actionType === 'RETURN') {
        result = await returnItemOnChain(actionRental.rentalId);
      } else if (actionType === 'CANCEL') {
        result = await cancelRentalOnChain(actionRental.rentalId);
      }

      setTxHash(result.hash);
      setTxState('confirmed');
      await loadUserRentals();
    } catch (err) {
      console.error('Contract action failed:', err);
      setActionError(parseContractError(err));
      setTxState('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Extension duration calculation
  const calculateExtendFee = (rental, val, unit) => {
    if (!rental) return '0.0050';
    const pricePerDay = parseFloat(rental.rentalPriceEth || '0.05');
    let fee = 0;
    if (unit === 'minutes') {
      fee = Math.max(0.005, (pricePerDay / 1440) * Number(val));
    } else if (unit === 'hours') {
      fee = Math.max(0.01, (pricePerDay / 24) * Number(val));
    } else {
      fee = Math.max(pricePerDay, pricePerDay * Number(val));
    }
    return fee.toFixed(4);
  };

  const calculateExtendSeconds = (val, unit) => {
    const num = Number(val || 1);
    if (unit === 'minutes') return num * 60;
    if (unit === 'hours') return num * 3600;
    return num * 86400;
  };

  const handleOpenExtendModal = (rental) => {
    setExtendRentalItem(rental);
    setExtendDurationValue(2);
    setExtendDurationUnit('minutes');
    setExtendTxState(null);
    setExtendTxHash(null);
    setExtendError(null);
    setIsExtendModalOpen(true);
  };

  const handleExecuteExtend = async (forceDemo = false) => {
    if (!extendRentalItem) return;

    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    setIsExtending(true);
    setExtendError(null);
    setExtendTxState('waiting_approval');

    try {
      const additionalSeconds = calculateExtendSeconds(extendDurationValue, extendDurationUnit);
      const additionalFeeEth = calculateExtendFee(extendRentalItem, extendDurationValue, extendDurationUnit);

      const result = await extendRentalOnChain({
        rentalId: extendRentalItem.rentalId,
        additionalSeconds,
        additionalFeeEth,
        forceDemo,
      });

      setExtendTxHash(result.hash);
      setExtendTxState('confirmed');
      await loadUserRentals();
    } catch (err) {
      console.error('Rental extension failed:', err);
      setExtendError(parseContractError(err));
      setExtendTxState('failed');
    } finally {
      setIsExtending(false);
    }
  };

  // Financial summary metrics
  const activeRentals = myRentals.filter((r) => r.status === RENTAL_STATUS.ACTIVE);
  const completedRentals = myRentals.filter(
    (r) => r.status === RENTAL_STATUS.RETURNED || r.status === RENTAL_STATUS.COMPLETED
  );
  const cancelledRentals = myRentals.filter((r) => r.status === RENTAL_STATUS.CANCELLED);

  const totalSpentEth = myRentals.reduce(
    (acc, r) => acc + (parseFloat(r.totalPaidEth) || 0),
    0
  );
  const activeLockedDepositEth = activeRentals.reduce(
    (acc, r) => acc + (parseFloat(r.depositEth) || 0),
    0
  );
  const refundedDepositEth = completedRentals.reduce(
    (acc, r) => acc + (parseFloat(r.depositEth) || 0),
    0
  );

  // Filter rentals based on active tab
  const filteredRentals = myRentals.filter((r) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return r.status === RENTAL_STATUS.ACTIVE;
    if (statusFilter === 'RETURNED')
      return r.status === RENTAL_STATUS.RETURNED || r.status === RENTAL_STATUS.COMPLETED;
    if (statusFilter === 'CANCELLED') return r.status === RENTAL_STATUS.CANCELLED;
    return true;
  });

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">{t('myRentals.title')}</h2>
          <p className="text-muted small mb-0">
            {t('myRentals.subtitle')}
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <div className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1.5 rounded-pill small d-flex align-items-center gap-1.5 shadow-xs">
            <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '8px', height: '8px' }} role="status"></span>
            <span>{language === 'th' ? 'ซิงค์สด Real-Time' : 'Live Real-Time'}</span>
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
            onClick={loadUserRentals}
            disabled={loading || !account}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center rounded-pill"
          >
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>
            {t('myRentals.refreshBtn')}
          </button>
        </div>
      </div>

      {/* Wallet Not Connected State */}
      {!account ? (
        <div className="card shadow-sm border text-center py-5 bg-white rounded-4">
          <div className="card-body p-4">
            <div className="rounded-circle bg-light text-primary mx-auto mb-3 p-3 d-flex align-items-center justify-content-center" style={{ width: '64px', height: '64px' }}>
              <i className="bi bi-wallet2 fs-2"></i>
            </div>
            <h4 className="fw-bold text-dark">{t('myRentals.connectPromptTitle')}</h4>
            <p className="text-muted small mb-4" style={{ maxWidth: '440px', margin: '0 auto' }}>
              {t('myRentals.connectPromptDesc')}
            </p>
            <button onClick={connect} className="btn btn-primary fw-bold px-4 py-2.5 rounded-3">
              <i className="bi bi-wallet2 me-2"></i> {t('nav.connectWallet')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Financial & Deposit Summary Bar */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
                <span className="text-muted small mb-1">{t('myRentals.statsSpent')}</span>
                <div className="fs-4 fw-bold font-monospace text-primary">{totalSpentEth.toFixed(4)} ETH</div>
                <span className="badge bg-light text-secondary border small mt-1">
                  {myRentals.length} {language === 'th' ? 'รายการเช่า' : 'Total Rentals'}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
                <span className="text-muted small mb-1">{t('myRentals.statsLockedDeposit')}</span>
                <div className="fs-4 fw-bold font-monospace text-warning">{activeLockedDepositEth.toFixed(4)} ETH</div>
                <span className="badge bg-warning-subtle text-warning-emphasis small mt-1">
                  {activeRentals.length} {language === 'th' ? 'รายการล็อกใน Escrow' : 'In Escrow'}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
                <span className="text-muted small mb-1">{t('myRentals.statsRecoveredDeposit')}</span>
                <div className="fs-4 fw-bold font-monospace text-success">{refundedDepositEth.toFixed(4)} ETH</div>
                <span className="badge bg-success-subtle text-success small mt-1">
                  {completedRentals.length} {language === 'th' ? 'รายการคืนเงินแล้ว' : 'Refunded'}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white rounded-3">
                <span className="text-muted small mb-1">{language === 'th' ? 'สถานะเครือข่าย' : 'Network'}</span>
                <div className="fs-5 fw-bold text-dark mt-1">Sepolia Testnet</div>
                <span className="badge bg-primary-subtle text-primary small mt-1">
                  Chain ID 11155111
                </span>
              </div>
            </div>
          </div>

          {/* Global Error Banner */}
          {error && <ErrorMessage error={error} onRetry={loadUserRentals} />}

          {/* Filter Status Tabs */}
          <div className="card shadow-sm border mb-4 bg-white rounded-3">
            <div className="card-body p-2.5 d-flex flex-wrap gap-2">
              <button
                className={`btn btn-sm rounded-pill px-3 fw-medium ${statusFilter === 'ACTIVE' ? 'btn-primary shadow-sm' : 'btn-light'}`}
                onClick={() => setStatusFilter('ACTIVE')}
              >
                <i className="bi bi-broadcast me-1"></i>
                {t('myRentals.tabActive')} ({activeRentals.length})
              </button>
              <button
                className={`btn btn-sm rounded-pill px-3 fw-medium ${statusFilter === 'RETURNED' ? 'btn-success shadow-sm' : 'btn-light'}`}
                onClick={() => setStatusFilter('RETURNED')}
              >
                <i className="bi bi-check-circle-fill me-1"></i>
                {t('myRentals.tabReturned')} ({completedRentals.length})
              </button>
              <button
                className={`btn btn-sm rounded-pill px-3 fw-medium ${statusFilter === 'ALL' ? 'btn-dark shadow-sm' : 'btn-light'}`}
                onClick={() => setStatusFilter('ALL')}
              >
                {t('myRentals.tabAll')} ({myRentals.length})
              </button>
              <button
                className={`btn btn-sm rounded-pill px-3 fw-medium ${statusFilter === 'CANCELLED' ? 'btn-secondary shadow-sm' : 'btn-light'}`}
                onClick={() => setStatusFilter('CANCELLED')}
              >
                {t('myRentals.tabCancelled')} ({cancelledRentals.length})
              </button>
            </div>
          </div>

          {/* Loading / Empty States */}
          {loading ? (
            <Loading message={language === 'th' ? 'กำลังอ่านรายการสัญญาเช่าของคุณจาก Sepolia...' : 'Reading your rental agreements from Ethereum Sepolia...'} />
          ) : filteredRentals.length === 0 ? (
            <div className="card shadow-sm border text-center py-5 bg-white rounded-4">
              <div className="card-body p-4">
                <i className="bi bi-file-earmark-text fs-1 text-secondary mb-2 d-block"></i>
                <h5 className="fw-bold text-dark">{t('myRentals.emptyTitle')}</h5>
                <p className="text-muted small mb-4">
                  {myRentals.length === 0
                    ? t('myRentals.emptyDescUser')
                    : t('myRentals.emptyDescFilter')}
                </p>
                <Link href="/rentals" className="btn btn-primary fw-medium px-4 rounded-3">
                  <i className="bi bi-grid me-2"></i> {t('myRentals.btnBrowseToRent')}
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Card Grid View */}
              <div className="row g-4 mb-4">
                {filteredRentals.map((rental) => {
                  const item = itemsMap[rental.itemId];
                  return (
                    <div key={rental.rentalId} className="col-12 col-md-6 col-lg-4">
                      <RentalCard
                        rental={rental}
                        itemName={item?.name}
                        isCurrentUserRenter={true}
                        onReturn={() => handleOpenActionModal(rental, 'RETURN')}
                        onCancel={() => handleOpenActionModal(rental, 'CANCEL')}
                        onExtend={() => handleOpenExtendModal(rental)}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Completed & Cancelled History Table Ledger */}
              {(statusFilter === 'RETURNED' || statusFilter === 'CANCELLED' || statusFilter === 'ALL') && (completedRentals.length > 0 || cancelledRentals.length > 0) && (
                <div className="card shadow-sm border bg-white rounded-4 mb-4 overflow-hidden">
                  <div className="card-header bg-light py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                      <h6 className="fw-bold text-dark mb-0 d-flex align-items-center">
                        <i className="bi bi-clock-history text-primary me-2 fs-5"></i>
                        {language === 'th'
                          ? 'ประวัติการเช่า การส่งคืน และการยกเลิกสัญญา (Settled & Cancelled History)'
                          : 'Settled & Cancelled Rental History'}
                      </h6>
                      <span className="text-muted small">
                        {language === 'th'
                          ? 'บันทึกสัญญาเช่าที่ส่งคืนของหรือยกเลิกสัญญา พร้อมรายละเอียดเงินมัดจำที่โอนคืนกลับเข้ากระเป๋า'
                          : 'Rental agreements returned or cancelled with deposit refund ledger on Sepolia'}
                      </span>
                    </div>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1.5 rounded-pill small">
                      <i className="bi bi-broadcast me-1"></i>
                      {language === 'th' ? `ประวัติทั้งหมด ${completedRentals.length + cancelledRentals.length} รายการ` : `${completedRentals.length + cancelledRentals.length} Total Records`}
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 small">
                      <thead className="table-light">
                        <tr>
                          <th>{language === 'th' ? 'รหัสสัญญา' : 'Rental ID'}</th>
                          <th>{language === 'th' ? 'ทรัพย์สิน' : 'Asset'}</th>
                          <th>{language === 'th' ? 'เจ้าของ' : 'Owner'}</th>
                          <th>{language === 'th' ? 'เริ่มต้น' : 'Start'}</th>
                          <th>{language === 'th' ? 'สิ้นสุด' : 'End'}</th>
                          <th>{language === 'th' ? 'ค่าเช่าที่จ่าย' : 'Fee Paid'}</th>
                          <th>{language === 'th' ? 'เงินมัดจำที่ได้คืน' : 'Deposit Refunded'}</th>
                          <th>{language === 'th' ? 'สถานะ' : 'Status'}</th>
                          <th className="text-end">{language === 'th' ? 'ตรวจสอบ' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(statusFilter === 'CANCELLED'
                          ? cancelledRentals
                          : statusFilter === 'RETURNED'
                          ? completedRentals
                          : [...completedRentals, ...cancelledRentals]
                        )
                          .slice()
                          .sort((a, b) => b.createdAt - a.createdAt)
                          .map((r) => {
                            const item = itemsMap[r.itemId];
                            const isCancelled = r.status === RENTAL_STATUS.CANCELLED;

                            return (
                              <tr key={r.rentalId}>
                                <td className="fw-bold font-monospace">#{r.rentalId}</td>
                                <td>
                                  <Link href={`/rentals/${r.itemId}`} className="fw-semibold text-dark text-decoration-none">
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
                                    {formatAddress(r.owner)} <i className="bi bi-box-arrow-up-right small"></i>
                                  </a>
                                </td>
                                <td className="font-monospace text-dark">
                                  {formatDateTime(r.startTime, language)}
                                </td>
                                <td className="font-monospace text-dark">
                                  {formatDateTime(r.endTime, language)}
                                </td>
                                <td className="font-monospace text-primary fw-medium">
                                  {r.rentalPriceEth} ETH
                                </td>
                                <td className="font-monospace text-success fw-bold">
                                  +{r.depositEth} ETH
                                </td>
                                <td>
                                  {isCancelled ? (
                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle py-1 px-2">
                                      <i className="bi bi-x-circle me-1"></i>
                                      {language === 'th' ? 'ยกเลิกแล้ว (คืนมัดจำแล้ว)' : 'Cancelled & Refunded'}
                                    </span>
                                  ) : (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle py-1 px-2">
                                      <i className="bi bi-check2-circle me-1"></i>
                                      {language === 'th' ? 'คืนของ & คืนมัดจำแล้ว' : 'Returned & Refunded'}
                                    </span>
                                  )}
                                </td>
                                <td className="text-end">
                                  <Link href={`/claims?id=${r.rentalId}`} className="btn btn-xs btn-outline-info py-1 px-2.5 rounded-pill me-1 text-decoration-none">
                                    {language === 'th' ? 'ตรวจสัญญา' : 'Audit'}
                                  </Link>
                                  <Link href={`/rentals/${r.itemId}`} className="btn btn-xs btn-outline-secondary py-1 px-2.5 rounded-pill text-decoration-none">
                                    {language === 'th' ? 'ดูทรัพย์สิน' : 'View Item'}
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Confirmation Modal for Return / Cancel */}
      {isActionModalOpen && actionRental && (
        <>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
                <div className="modal-header bg-dark text-white py-3">
                  <h5 className="modal-title fw-bold">
                    {actionType === 'RETURN' ? (
                      <>
                        <i className="bi bi-arrow-return-left text-success me-2"></i>
                        {t('myRentals.modalReturnTitle')}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle text-danger me-2"></i>
                        {t('myRentals.modalCancelTitle')}
                      </>
                    )}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setIsActionModalOpen(false)}
                    disabled={isProcessing}
                  ></button>
                </div>

                <div className="modal-body p-4 bg-white">
                  {txState && (
                    <TransactionStatus
                      status={txState}
                      txHash={txHash}
                      errorMessage={actionError}
                      onReset={() => setTxState(null)}
                    />
                  )}

                  {actionError && !txState && (
                    <ErrorMessage error={actionError} onDismiss={() => setActionError(null)} dismissible />
                  )}

                  {actionType === 'RETURN' ? (
                    <div>
                      <p className="text-dark mb-3">
                        {t('myRentals.modalReturnPrompt')}{' '}
                        <strong>
                          {language === 'th' ? `สัญญา #${actionRental.rentalId}` : `Rental Agreement #${actionRental.rentalId}`}
                        </strong>{' '}
                        ({language === 'th' ? `ทรัพย์สิน #${actionRental.itemId}` : `Item #${actionRental.itemId}`})?
                      </p>

                      <div className="border border-success-subtle bg-success-subtle p-3 rounded-3 mb-3 small">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-muted">{t('myRentals.depositRefundLabel')}</span>
                          <span className="fw-bold font-monospace text-success fs-6">
                            +{actionRental.depositEth} ETH
                          </span>
                        </div>
                        <div className="text-secondary small mt-2">
                          <i className="bi bi-shield-check text-success me-1"></i>
                          {t('myRentals.depositRefundNotice')}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-dark mb-3">
                        {language === 'th'
                          ? 'คุณต้องการยกเลิกสัญญาเช่าและขอรับเงินมัดจำคืนสำหรับ'
                          : 'Are you sure you want to cancel and refund deposit for'}{' '}
                        <strong>#{actionRental.rentalId}</strong> (
                        {language === 'th' ? `ทรัพย์สิน #${actionRental.itemId}` : `Item #${actionRental.itemId}`})?
                      </p>

                      <div className="border border-danger-subtle bg-danger-subtle p-3 rounded-3 mb-3 small">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-dark fw-medium">
                            {language === 'th' ? 'เงินมัดจำที่จะได้รับคืนทันที:' : 'Deposit Refunded to Wallet:'}
                          </span>
                          <span className="fw-bold font-monospace text-success fs-6">
                            +{actionRental.depositEth} ETH
                          </span>
                        </div>
                        <div className="text-secondary small mt-2">
                          <i className="bi bi-shield-check text-success me-1"></i>
                          {language === 'th'
                            ? 'เมื่อยืนยันใน MetaMask ระบบจะสั่งให้ Smart Contract โอนเงินมัดจำความเสียหายคืนเข้ากระเป๋าของคุณทันที และเปลี่ยนสถานะทรัพย์สินให้พร้อมเช่าอีกครั้ง'
                            : 'Upon confirmation in MetaMask, the Smart Contract unlocks and refunds your deposit directly to your wallet.'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light py-2.5">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-3"
                    onClick={() => setIsActionModalOpen(false)}
                    disabled={isProcessing}
                  >
                    {t('common.close')}
                  </button>
                  <button
                    type="button"
                    className={`btn fw-bold px-4 rounded-3 ${actionType === 'RETURN' ? 'btn-success' : 'btn-danger'}`}
                    onClick={handleExecuteAction}
                    disabled={isProcessing || txState === 'confirmed'}
                  >
                    {isProcessing ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {language === 'th' ? 'กำลังเซ็นใน MetaMask...' : 'Signing in MetaMask...'}
                      </>
                    ) : txState === 'confirmed' ? (
                      <>
                        <i className="bi bi-check-circle me-1"></i> {t('myRentals.processedBadge')}
                      </>
                    ) : actionType === 'RETURN' ? (
                      <>
                        <i className="bi bi-arrow-return-left me-1"></i> {t('myRentals.btnConfirmReturn')}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle me-1"></i> {language === 'th' ? 'ยืนยันยกเลิก & รับเงินมัดจำคืน' : 'Confirm Cancel & Refund'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

      {/* Extend Rental Modal */}
      {isExtendModalOpen && extendRentalItem && (
        <>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
                <div className="modal-header bg-dark text-white py-3">
                  <h5 className="modal-title fw-bold d-flex align-items-center">
                    <i className="bi bi-clock-history text-primary me-2"></i>
                    {language === 'th' ? 'ต่ออายุระยะเวลาสัญญาเช่า' : 'Extend Rental Duration'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setIsExtendModalOpen(false)}
                    disabled={isExtending}
                  ></button>
                </div>

                <div className="modal-body p-4 bg-white">
                  {extendTxState && (
                    <TransactionStatus
                      status={extendTxState}
                      txHash={extendTxHash}
                      errorMessage={extendError}
                      onReset={() => setExtendTxState(null)}
                    />
                  )}

                  {extendError && !extendTxState && (
                    <ErrorMessage error={extendError} onDismiss={() => setExtendError(null)} dismissible />
                  )}

                  <div className="mb-3">
                    <span className="badge bg-secondary font-monospace mb-1">
                      {language === 'th' ? `สัญญา #${extendRentalItem.rentalId}` : `Rental #${extendRentalItem.rentalId}`}
                    </span>
                    <h6 className="fw-bold text-dark mb-1">
                      {itemsMap[extendRentalItem.itemId]?.name || `Item #${extendRentalItem.itemId}`}
                    </h6>
                    <div className="text-muted small">
                      {language === 'th' ? 'สิ้นสุดสัญญาเดิม:' : 'Current End Time:'}{' '}
                      <span className="font-monospace fw-semibold text-dark">
                        {formatDateTime(extendRentalItem.endTime, language)}
                      </span>
                    </div>
                  </div>

                  {/* Extension Unit and Value */}
                  <div className="card bg-light border p-3 rounded-3 mb-3">
                    <label className="form-label fw-bold small text-dark mb-2">
                      <i className="bi bi-stopwatch text-primary me-1"></i>
                      {language === 'th' ? 'เลือกระยะเวลาที่ต้องการต่อเพิ่ม:' : 'Select Additional Duration:'}
                    </label>

                    {/* Presets */}
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        className={`btn btn-sm ${extendDurationUnit === 'minutes' && extendDurationValue === 2 ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => { setExtendDurationUnit('minutes'); setExtendDurationValue(2); }}
                        disabled={isExtending}
                      >
                        ⚡ +2 {language === 'th' ? 'นาที (Demo)' : 'mins (Demo)'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${extendDurationUnit === 'minutes' && extendDurationValue === 5 ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => { setExtendDurationUnit('minutes'); setExtendDurationValue(5); }}
                        disabled={isExtending}
                      >
                        ⚡ +5 {language === 'th' ? 'นาที (Demo)' : 'mins (Demo)'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${extendDurationUnit === 'hours' && extendDurationValue === 1 ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => { setExtendDurationUnit('hours'); setExtendDurationValue(1); }}
                        disabled={isExtending}
                      >
                        +1 {language === 'th' ? 'ชม.' : 'hr'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${extendDurationUnit === 'days' && extendDurationValue === 1 ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => { setExtendDurationUnit('days'); setExtendDurationValue(1); }}
                        disabled={isExtending}
                      >
                        +1 {language === 'th' ? 'วัน' : 'day'}
                      </button>
                    </div>

                    {/* Input */}
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        min="1"
                        max={extendDurationUnit === 'minutes' ? 720 : 365}
                        className="form-control font-monospace fw-bold"
                        value={extendDurationValue}
                        onChange={(e) => setExtendDurationValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        disabled={isExtending}
                      />
                      <select
                        className="form-select form-select-sm"
                        value={extendDurationUnit}
                        onChange={(e) => setExtendDurationUnit(e.target.value)}
                        disabled={isExtending}
                      >
                        <option value="minutes">{language === 'th' ? 'นาที (Real-time Demo)' : 'Minutes'}</option>
                        <option value="hours">{language === 'th' ? 'ชั่วโมง' : 'Hours'}</option>
                        <option value="days">{language === 'th' ? 'วัน' : 'Days'}</option>
                      </select>
                    </div>
                  </div>

                  {/* Summary of Additional Fee */}
                  <div className="border border-info-subtle bg-info-subtle p-3 rounded-3 mb-2 small">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-dark fw-medium">
                        {language === 'th' ? 'ค่าเช่าเพิ่มเติมที่ต้องชำระ:' : 'Additional Rental Fee:'}
                      </span>
                      <span className="fw-bold font-monospace text-primary fs-6">
                        {calculateExtendFee(extendRentalItem, extendDurationValue, extendDurationUnit)} ETH
                      </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center text-muted small">
                      <span>{language === 'th' ? 'เงินมัดจำเดิม (ไม่ต้องจ่ายเพิ่ม):' : 'Deposit (No extra fee):'}</span>
                      <span className="font-monospace text-success fw-semibold">+{extendRentalItem.depositEth} ETH (Hold)</span>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2.5">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-3"
                    onClick={() => setIsExtendModalOpen(false)}
                    disabled={isExtending}
                  >
                    {t('common.close')}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary fw-bold px-4 rounded-3"
                    onClick={() => handleExecuteExtend(false)}
                    disabled={isExtending || extendTxState === 'confirmed'}
                  >
                    {isExtending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {language === 'th' ? 'กำลังเซ็นใน MetaMask...' : 'Signing in MetaMask...'}
                      </>
                    ) : extendTxState === 'confirmed' ? (
                      <>
                        <i className="bi bi-check-circle me-1"></i> {language === 'th' ? 'ต่ออายุสำเร็จแล้ว' : 'Extended Successfully'}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-clock-history me-1"></i>{' '}
                        {language === 'th'
                          ? `ยืนยันต่ออายุ (${calculateExtendFee(extendRentalItem, extendDurationValue, extendDurationUnit)} ETH)`
                          : `Confirm Extension (${calculateExtendFee(extendRentalItem, extendDurationValue, extendDurationUnit)} ETH)`}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  );
}
