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
  requestRentalCancellationOnChain,
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
  const { account, isSepolia, connect, switchNetwork, switchAccount } = useWallet();
  const { t, language } = useLanguage();

  const [myRentals, setMyRentals] = useState([]);
  const [itemsMap, setItemsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Filter: 'ACTIVE' | 'CANCEL_REQUESTED' | 'RETURNED' | 'ALL' | 'CANCELLED'
  const [statusFilter, setStatusFilter] = useState('ACTIVE');


  // Return & Cancel Action Modals State
  const [actionRental, setActionRental] = useState(null);
  const [actionType, setActionType] = useState(null); // 'RETURN' | 'CANCEL'
  const [cancelReason, setCancelReason] = useState('');
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
      setMyRentals([]);
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

  // Immediate reset when switching accounts
  useEffect(() => {
    setMyRentals([]);
  }, [account]);

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
    setCancelReason('');
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
        // Submit cancellation request to owner for approval and refund
        result = await requestRentalCancellationOnChain(actionRental.rentalId, cancelReason);
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
  const pendingRentals = myRentals.filter((r) => r.status === RENTAL_STATUS.PENDING);
  const cancelRequestedRentals = myRentals.filter((r) => r.status === RENTAL_STATUS.CANCEL_REQUESTED);
  const completedRentals = myRentals.filter(
    (r) => r.status === RENTAL_STATUS.RETURNED || r.status === RENTAL_STATUS.COMPLETED
  );
  const cancelledRentals = myRentals.filter((r) => r.status === RENTAL_STATUS.CANCELLED);

  // Items currently in possession or pending approval
  const currentlyRentedList = myRentals.filter(
    (r) =>
      r.status === RENTAL_STATUS.ACTIVE ||
      r.status === RENTAL_STATUS.PENDING ||
      r.status === RENTAL_STATUS.CANCEL_REQUESTED
  );

  const totalSpentEth = myRentals.reduce(
    (acc, r) => acc + (parseFloat(r.totalPaidEth) || 0),
    0
  );
  const activeLockedDepositEth = [...activeRentals, ...pendingRentals, ...cancelRequestedRentals].reduce(
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
    if (statusFilter === 'PENDING') return r.status === RENTAL_STATUS.PENDING;
    if (statusFilter === 'CANCEL_REQUESTED') return r.status === RENTAL_STATUS.CANCEL_REQUESTED;
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
          {/* Active Wallet Account Banner & Fast Switch */}
          <div className="card shadow-sm border bg-white rounded-3 mb-4 p-3 border-start border-primary border-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center"
                  style={{ width: '44px', height: '44px', minWidth: '44px' }}
                >
                  <i className="bi bi-person-badge fs-4"></i>
                </div>
                <div>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="fw-bold text-dark">
                      {language === 'th' ? 'บัญชีผู้เช่าที่กำลังเชื่อมต่อ:' : 'Active Connected Renter:'}
                    </span>
                    <span className="badge bg-primary font-monospace px-2.5 py-1">
                      {account}
                    </span>
                  </div>
                  <div className="small text-muted mt-0.5">
                    {language === 'th'
                      ? 'รายการเช่าจะแสดงเฉพาะของกระเป๋านี้เท่านั้น หากต้องการเช็คของอีกบัญชี (เช่น Account 1 หรือ 2) ให้กดปุ่ม "สลับบัญชี"'
                      : 'Rental records are strictly isolated to this address. Switch account in MetaMask to view other rentals.'}
                  </div>
                </div>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                  type="button"
                  onClick={switchAccount}
                  className="btn btn-outline-primary btn-sm fw-semibold rounded-pill px-3 py-1.5 d-flex align-items-center"
                  title="เปิดหน้าต่าง MetaMask เพื่อเลือกสลับบัญชี (Account 1 / Account 2)"
                >
                  <i className="bi bi-arrow-left-right me-1.5"></i>
                  {language === 'th' ? 'สลับบัญชีใน MetaMask' : 'Switch Account'}
                </button>
              </div>
            </div>
          </div>

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

          {/* Pending Rentals Awaiting Owner Approval Banner */}
          {pendingRentals.length > 0 && (
            <div className="alert alert-warning border border-warning-subtle shadow-sm rounded-3 mb-4 d-flex align-items-center gap-3">
              <div
                className="rounded-circle bg-warning text-dark p-2 d-flex align-items-center justify-content-center"
                style={{ width: '42px', height: '42px', minWidth: '42px' }}
              >
                <i className="bi bi-clock-history fs-5"></i>
              </div>
              <div className="flex-grow-1">
                <div className="fw-bold text-dark">
                  {language === 'th'
                    ? `คุณมี ${pendingRentals.length} รายการที่กำลังรอเจ้าของอนุมัติการเช่า`
                    : `You have ${pendingRentals.length} rental request(s) awaiting owner approval`}
                </div>
                <div className="small text-muted">
                  {language === 'th'
                    ? 'เงินค่าเช่าและเงินมัดจำถูกพักไว้ในระบบอย่างปลอดภัย เมื่อเจ้าของอุปกรณ์ตรวจสอบและกดยืนยันอนุมัติ เวลาการเช่าจะเริ่มนับถอยหลังทันที'
                    : 'Rental fee and deposit are securely held in escrow. Countdown begins automatically once approved by the owner.'}
                </div>
              </div>
            </div>
          )}

          {/* Active Rentals Hub - ส่วนที่คนเช่าสามารถเช็คสถานะว่าตอนนี้เราเช่าแล้วและมีข้อมูลที่เราเช่าอยู่ */}
          <div className="card shadow-sm border bg-white rounded-3 mb-4 overflow-hidden">
            <div
              className="card-header py-3 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2"
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#fff',
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center bg-primary text-white"
                  style={{ width: '32px', height: '32px' }}
                >
                  <i className="bi bi-box-seam-fill small"></i>
                </div>
                <div>
                  <h5 className="mb-0 fw-bold fs-6">
                    {language === 'th'
                      ? 'ข้อมูลทรัพย์สินที่คุณกำลังเช่าอยู่ในปัจจุบัน (Active Rentals Hub)'
                      : 'Your Current Active Rentals & Status'}
                  </h5>
                  <small className="text-light-emphasis small" style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                    {language === 'th'
                      ? 'เช็คสถานะการเช่า ข้อมูลทรัพย์สิน กำหนดส่งคืน และเวลาคงเหลือแบบเรียลไทม์'
                      : 'Check your active rentals, agreement specs, return deadline, and live countdown'}
                  </small>
                </div>
              </div>
              <span className="badge bg-primary-subtle text-info border border-info-subtle px-2.5 py-1 font-monospace">
                {currentlyRentedList.length} {language === 'th' ? 'รายการกำลังเช่า/รออนุมัติ' : 'Active Items'}
              </span>
            </div>

            <div className="card-body p-3">
              {currentlyRentedList.length === 0 ? (
                <div className="text-center py-3 text-muted">
                  <i className="bi bi-check2-circle text-success fs-3 mb-1 d-block"></i>
                  <h6 className="fw-bold text-dark mb-1">
                    {language === 'th' ? 'ขณะนี้คุณไม่มีทรัพย์สินที่อยู่ในสถานะกำลังเช่า' : 'You have no items currently in active rental'}
                  </h6>
                  <p className="small mb-2 text-muted">
                    {language === 'th'
                      ? 'เมื่อคุณทำสัญญาเช่าอุปกรณ์ ข้อมูลสัญญา วันที่เริ่ม-สิ้นสุด และเวลานับถอยหลังจะแสดงที่นี่'
                      : 'When you rent an item, its active status, specs, countdown, and controls will appear right here.'}
                  </p>
                  <Link href="/rentals" className="btn btn-outline-primary btn-sm rounded-pill px-3">
                    <i className="bi bi-grid me-1"></i> {language === 'th' ? 'ค้นหาทรัพย์สินเพื่อเริ่มเช่า' : 'Browse Available Items'}
                  </Link>
                </div>
              ) : (
                <div className="row g-3">
                  {currentlyRentedList.map((rental) => {
                    const item = itemsMap[rental.itemId];
                    const isCancelRequested = rental.status === RENTAL_STATUS.CANCEL_REQUESTED;

                    return (
                      <div key={`active-${rental.rentalId}`} className="col-12 col-lg-6">
                        <div className={`p-3 rounded-3 border h-100 ${isCancelRequested ? 'bg-warning-subtle border-warning' : 'bg-light border-primary-subtle'}`}>
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                              <span className="badge bg-dark font-monospace me-1.5">
                                #{rental.rentalId}
                              </span>
                              <span className="badge bg-secondary-subtle text-secondary small">
                                {language === 'th' ? `อุปกรณ์ #${rental.itemId}` : `Item #${rental.itemId}`}
                              </span>
                            </div>
                            <RentalStatus status={rental.status} />
                          </div>

                          <h6 className="fw-bold text-dark mb-1 text-truncate" title={item?.name}>
                            {item?.name || `Item #${rental.itemId}`}
                          </h6>

                          {/* Countdown Timer */}
                          <div className="d-flex align-items-center justify-content-between bg-white p-2 rounded border mb-2 small">
                            <span className="text-muted fw-semibold">
                              <i className="bi bi-broadcast text-primary me-1"></i>
                              {language === 'th' ? 'นับถอยหลังสัญญา:' : 'Live Timer:'}
                            </span>
                            <RentalCountdown
                              startTime={rental.startTime}
                              endTime={rental.endTime}
                              status={rental.status}
                            />
                          </div>

                          {/* Schedule info */}
                          <div className="bg-white p-2 rounded border mb-2 small font-monospace">
                            <div className="d-flex justify-content-between text-muted">
                              <span>{language === 'th' ? 'เริ่มต้น:' : 'Start:'}</span>
                              <span className="text-dark">
                                {rental.status === RENTAL_STATUS.PENDING
                                  ? (language === 'th' ? 'รอเจ้าของอนุมัติการเช่า' : 'Pending Owner Approval')
                                  : formatDateTime(rental.startTime, language, true)}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between text-muted">
                              <span>{language === 'th' ? 'กำหนดส่งคืน:' : 'Due Date:'}</span>
                              <span className={rental.status === RENTAL_STATUS.PENDING ? 'text-muted' : 'text-danger fw-bold'}>
                                {rental.status === RENTAL_STATUS.PENDING
                                  ? `${rental.durationValue || 1} ${rental.durationUnit || 'days'}`
                                  : formatDateTime(rental.endTime, language, true)}
                              </span>
                            </div>
                          </div>

                          {/* Payment details */}
                          <div className="d-flex justify-content-between small text-muted mb-2 px-1">
                            <span>{language === 'th' ? 'ยอดชำระรวม:' : 'Total Paid:'} <strong className="text-primary font-monospace">{rental.totalPaidEth} ETH</strong></span>
                            <span>{language === 'th' ? 'มัดจำที่รอคืน:' : 'Deposit:'} <strong className="text-success font-monospace">+{rental.depositEth} ETH</strong></span>
                          </div>

                          {/* Owner Address */}
                          <div className="small text-muted mb-3 px-1 d-flex justify-content-between">
                            <span>{language === 'th' ? 'เจ้าของ:' : 'Owner:'}</span>
                            <a
                              href={`${explorerBase}/address/${rental.owner}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-monospace text-secondary text-decoration-none"
                            >
                              {formatAddress(rental.owner)} <i className="bi bi-box-arrow-up-right small"></i>
                            </a>
                          </div>

                          {/* Action Buttons for active rental */}
                          <div className="d-flex flex-wrap gap-2 pt-2 border-top">
                            <Link
                              href={`/rentals/${rental.itemId}`}
                              className="btn btn-outline-secondary btn-sm"
                            >
                              <i className="bi bi-eye"></i> {language === 'th' ? 'ดูของ' : 'Specs'}
                            </Link>

                            {rental.status === RENTAL_STATUS.PENDING ? (
                              <div className="alert alert-warning py-1.5 px-2.5 small mb-0 w-100 d-flex align-items-center justify-content-between">
                                <span>
                                  <i className="bi bi-clock-history me-1 text-warning"></i>
                                  {language === 'th'
                                    ? 'รอเจ้าของอนุมัติการเช่า (เวลานับเมื่ออนุมัติ)'
                                    : 'Awaiting owner approval (Timer starts once approved)'}
                                </span>
                              </div>
                            ) : !isCancelRequested ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenExtendModal(rental)}
                                  className="btn btn-primary btn-sm flex-grow-1"
                                >
                                  <i className="bi bi-clock-history me-1"></i>
                                  {language === 'th' ? 'ต่อเวลา' : 'Extend'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(rental, 'RETURN')}
                                  className="btn btn-success btn-sm flex-grow-1"
                                >
                                  <i className="bi bi-arrow-return-left me-1"></i>
                                  {language === 'th' ? 'ส่งคืนของ' : 'Return'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(rental, 'CANCEL')}
                                  className="btn btn-outline-danger btn-sm"
                                  title={language === 'th' ? 'ส่งคำขอยกเลิกสัญญาให้เจ้าของอนุมัติ' : 'Request cancellation'}
                                >
                                  <i className="bi bi-x-circle me-1"></i>
                                  {language === 'th' ? 'ขอยกเลิก' : 'Cancel'}
                                </button>
                              </>
                            ) : (
                              <div className="alert alert-warning py-1.5 px-2.5 small mb-0 w-100 d-flex align-items-center justify-content-between">
                                <span>
                                  <i className="bi bi-hourglass-split me-1 text-warning"></i>
                                  {language === 'th'
                                    ? `ส่งคำขอยกเลิกแล้ว รอเจ้าของอนุมัติ & โอนคืน ${rental.totalPaidEth || rental.depositEth} ETH`
                                    : `Cancellation requested, awaiting owner refund`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

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
                className={`btn btn-sm rounded-pill px-3 fw-medium ${statusFilter === 'PENDING' ? 'btn-warning text-dark shadow-sm' : 'btn-light'}`}
                onClick={() => setStatusFilter('PENDING')}
              >
                <i className="bi bi-clock-history me-1"></i>
                {language === 'th' ? 'รอเจ้าของอนุมัติการเช่า' : 'Pending Approval'} ({pendingRentals.length})
              </button>
              <button
                className={`btn btn-sm rounded-pill px-3 fw-medium ${statusFilter === 'CANCEL_REQUESTED' ? 'btn-warning text-dark shadow-sm' : 'btn-light'}`}
                onClick={() => setStatusFilter('CANCEL_REQUESTED')}
              >
                <i className="bi bi-hourglass-split me-1"></i>
                {language === 'th' ? 'รอเจ้าของอนุมัติยกเลิก' : 'Awaiting Approval'} ({cancelRequestedRentals.length})
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
                      <p className="text-dark mb-2">
                        {language === 'th'
                          ? 'คุณกำลังจะส่งคำขอยกเลิกสัญญาเช่าหมายเลข'
                          : 'You are submitting a cancellation request for'}{' '}
                        <strong>#{actionRental.rentalId}</strong> (
                        {itemsMap[actionRental.itemId]?.name || (language === 'th' ? `ทรัพย์สิน #${actionRental.itemId}` : `Item #${actionRental.itemId}`)})
                      </p>

                      <div className="border border-warning-subtle bg-warning-subtle p-3 rounded-3 mb-3 small">
                        <div className="d-flex justify-content-between mb-1.5">
                          <span className="text-dark fw-medium">
                            {language === 'th' ? 'ยอดเงินที่จะได้รับคืนเมื่อเจ้าของอนุมัติ:' : 'Refund Amount upon Owner Approval:'}
                          </span>
                          <span className="fw-bold font-monospace text-success fs-6">
                            +{actionRental.totalPaidEth || actionRental.depositEth} ETH
                          </span>
                        </div>
                        <div className="text-secondary small mt-2">
                          <i className="bi bi-info-circle-fill text-warning me-1"></i>
                          {language === 'th'
                            ? 'ระบบการยกเลิก: เมื่อคุณกดยืนยัน คำขอจะถูกส่งไปยังเจ้าของทรัพย์สิน และรอให้เจ้าของกดอนุมัติการยกเลิกพร้อมทำธุรกรรมโอนคืนยอดค่าเช่า/มัดจำเข้ากระเป๋าของคุณ'
                            : 'Cancellation Policy: Upon submitting this request, it will be forwarded to the asset owner for review. Once approved, the owner will execute the refund back to your wallet.'}
                        </div>
                      </div>

                      {/* Optional reason */}
                      <div className="mb-2">
                        <label className="form-label small fw-bold text-dark">
                          {language === 'th' ? 'ระบุเหตุผลในการขอยกเลิก (ถ้ามี):' : 'Cancellation Reason (Optional):'}
                        </label>
                        <textarea
                          className="form-control form-control-sm"
                          rows="2"
                          placeholder={language === 'th' ? 'เช่น ส่งของคืนแล้ว, เปลี่ยนใจ, ไม่สะดวกใช้งาน...' : 'e.g. Returned early, changed schedule, etc.'}
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          disabled={isProcessing}
                        ></textarea>
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
                        {language === 'th' ? 'กำลังส่งคำขอใน MetaMask...' : 'Submitting in MetaMask...'}
                      </>
                    ) : txState === 'confirmed' ? (
                      <>
                        <i className="bi bi-check-circle me-1"></i> {language === 'th' ? 'ส่งคำขอสำเร็จแล้ว' : 'Request Submitted'}
                      </>
                    ) : actionType === 'RETURN' ? (
                      <>
                        <i className="bi bi-arrow-return-left me-1"></i> {t('myRentals.btnConfirmReturn')}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send me-1"></i> {language === 'th' ? 'ยืนยันส่งคำขอยกเลิกถึงเจ้าของ' : 'Submit Cancellation Request'}
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
