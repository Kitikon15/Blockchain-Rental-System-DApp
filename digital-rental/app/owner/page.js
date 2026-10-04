'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '../../context/WalletContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchAllItems,
  fetchAllRentals,
  updateItemAvailabilityOnChain,
  cancelRentalOnChain,
  approveRentalCancellationAndRefund,
  rejectRentalCancellation,
  approveRentalRequestOnChain,
  rejectRentalRequestOnChain,
  isContractConfigured,
  parseContractError,
} from '../../lib/contract';
import { RENTAL_STATUS, DEFAULT_EXPLORER_URL } from '../../lib/constants';
import RentalStatus from '../../components/RentalStatus';
import RentalCountdown from '../../components/RentalCountdown';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import TransactionStatus from '../../components/TransactionStatus';
import { formatAddress, formatDateTime } from '../../lib/wallet';

/**
 * Owner Dashboard (app/owner/page.js)
 * Dedicated portal for asset owners to monitor their listed items, toggle availability,
 * track active rentals with live real-time countdown, cancel agreements, approve cancellation requests,
 * refund payments, and review earnings on Ethereum Sepolia.
 */
export default function OwnerDashboardPage() {
  const { account, isSepolia, connect, switchNetwork, switchAccount } = useWallet();
  const { t, language } = useLanguage();

  const [myItems, setMyItems] = useState([]);
  const [ownerRentals, setOwnerRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time synchronization
  const [autoSync, setAutoSync] = useState(true);

  // Availability Toggle State
  const [togglingItemId, setTogglingItemId] = useState(null);
  const [toggleTxState, setToggleTxState] = useState(null);
  const [toggleTxHash, setToggleTxHash] = useState(null);
  const [toggleError, setToggleError] = useState(null);

  // Rental Action State (Cancel Rental)
  const [actionRental, setActionRental] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionTxState, setActionTxState] = useState(null);
  const [actionTxHash, setActionTxHash] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Approve Cancellation & Refund State
  const [approveRentalItem, setApproveRentalItem] = useState(null);
  const [refundAmountEth, setRefundAmountEth] = useState('0.0500');

  // Reject Cancellation State
  const [rejectRentalItem, setRejectRentalItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Approve Pending Rental Request State
  const [approveRequestItem, setApproveRequestItem] = useState(null);
  const [isApprovingRequest, setIsApprovingRequest] = useState(false);

  // Reject Pending Rental Request State
  const [rejectRequestItem, setRejectRequestItem] = useState(null);
  const [rejectRequestReason, setRejectRequestReason] = useState('');
  const [isRejectingRequest, setIsRejectingRequest] = useState(false);

  const contractConfigured = isContractConfigured();
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  const loadOwnerData = useCallback(
    async (silent = false) => {
      if (!contractConfigured || !account) {
        if (!silent) setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const [allItems, allRentals] = await Promise.all([
          fetchAllItems(account),
          fetchAllRentals(account),
        ]);

        const owned = (allItems || []).filter(
          (i) => i.owner && i.owner.toLowerCase() === account.toLowerCase()
        );
        setMyItems(owned);

        const ownedItemIds = new Set(owned.map((i) => Number(i.itemId)));

        const relevantRentals = (allRentals || []).filter(
          (r) =>
            (r.owner && r.owner.toLowerCase() === account.toLowerCase()) ||
            (r.itemId && ownedItemIds.has(Number(r.itemId)))
        );
        setOwnerRentals(relevantRentals);
      } catch (err) {
        console.warn('Error loading owner data:', err.message);
        if (!silent) setError(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [contractConfigured, account]
  );

  useEffect(() => {
    loadOwnerData(false);
  }, [loadOwnerData]);

  // Real-time sync interval (every 6 seconds)
  useEffect(() => {
    if (!autoSync || !account) return;

    const interval = setInterval(() => {
      loadOwnerData(true);
    }, 6000);

    return () => clearInterval(interval);
  }, [autoSync, account, loadOwnerData]);

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
      await loadOwnerData(true);
    } catch (err) {
      console.error('Error toggling availability:', err);
      setToggleError(parseContractError(err));
      setToggleTxState('failed');
    } finally {
      setTogglingItemId(null);
    }
  };

  // Handle Owner Cancelling an Active Rental (Refunds deposit back to renter)
  const handleConfirmCancel = async () => {
    if (!actionRental) return;

    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    setIsProcessing(true);
    setActionTxState('waiting_approval');
    setActionError(null);

    try {
      const result = await cancelRentalOnChain(actionRental.rentalId);
      setActionTxHash(result.hash);
      setActionTxState('confirmed');
      await loadOwnerData(true);
    } catch (err) {
      console.error('Owner cancellation error:', err);
      setActionError(parseContractError(err));
      setActionTxState('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Owner Approving Cancellation and Executing Refund
  const handleOpenApproveModal = (rental) => {
    setApproveRentalItem(rental);
    setRefundAmountEth(rental.totalPaidEth || rental.depositEth || '0.0500');
    setActionTxState(null);
    setActionTxHash(null);
    setActionError(null);
  };

  const handleConfirmApproveAndRefund = async () => {
    if (!approveRentalItem) return;

    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    setIsProcessing(true);
    setActionTxState('waiting_approval');
    setActionError(null);

    const targetRentalId = approveRentalItem.rentalId;

    try {
      const result = await approveRentalCancellationAndRefund({
        rentalId: targetRentalId,
        refundAmountEth: refundAmountEth,
      });
      setActionTxHash(result.hash);
      setActionTxState('confirmed');

      // Optimistically update ownerRentals immediately so cancellation card removes it right away
      setOwnerRentals((prev) =>
        prev.map((r) =>
          String(r.rentalId) === String(targetRentalId)
            ? {
                ...r,
                status: RENTAL_STATUS.CANCELLED,
                statusText: 'ยกเลิกแล้ว (Cancelled)',
                cancelRequested: false,
                cancelApproved: true,
                refundAmountEth: refundAmountEth,
              }
            : r
        )
      );

      setApproveRentalItem(null);
      await loadOwnerData(true);
    } catch (err) {
      console.error('Owner approve refund error:', err);
      setActionError(parseContractError(err));
      setActionTxState('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Owner Rejecting Cancellation
  const handleOpenRejectModal = (rental) => {
    setRejectRentalItem(rental);
    setRejectReason('');
    setActionTxState(null);
    setActionTxHash(null);
    setActionError(null);
  };

  const handleConfirmReject = async () => {
    if (!rejectRentalItem) return;

    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    setIsProcessing(true);
    setActionTxState('waiting_approval');
    setActionError(null);

    const targetRentalId = rejectRentalItem.rentalId;

    try {
      await rejectRentalCancellation({
        rentalId: targetRentalId,
        reason: rejectReason,
      });
      setActionTxState('confirmed');

      // Optimistically update ownerRentals immediately so cancellation card removes it right away
      setOwnerRentals((prev) =>
        prev.map((r) =>
          String(r.rentalId) === String(targetRentalId)
            ? {
                ...r,
                status: RENTAL_STATUS.ACTIVE,
                statusText: 'กำลังเช่าอยู่ (Active)',
                cancelRequested: false,
                cancelRejected: true,
              }
            : r
        )
      );

      setRejectRentalItem(null);
      await loadOwnerData(true);
    } catch (err) {
      console.error('Owner reject error:', err);
      setActionError(parseContractError(err));
      setActionTxState('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Owner Approving a Pending Rental Request
  const handleOpenApproveRequestModal = (rental) => {
    setApproveRequestItem(rental);
    setActionTxState(null);
    setActionTxHash(null);
    setActionError(null);
  };

  const handleConfirmApproveRequest = async () => {
    if (!approveRequestItem) return;

    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    setIsApprovingRequest(true);
    setActionTxState('waiting_approval');
    setActionError(null);

    const targetRentalId = approveRequestItem.rentalId;

    try {
      const result = await approveRentalRequestOnChain({
        rentalId: targetRentalId,
      });
      setActionTxHash(result.hash);
      setActionTxState('confirmed');

      // Optimistically update ownerRentals immediately so pending table removes it right away
      setOwnerRentals((prev) =>
        prev.map((r) =>
          String(r.rentalId) === String(targetRentalId)
            ? {
                ...r,
                status: RENTAL_STATUS.ACTIVE,
                statusText: 'กำลังเช่าอยู่ (Active)',
                startTime: result.startTime || Math.floor(Date.now() / 1000),
                endTime:
                  result.endTime ||
                  Math.floor(Date.now() / 1000) + (Number(r.durationSeconds) || 86400),
              }
            : r
        )
      );

      setApproveRequestItem(null);
      await loadOwnerData(true);
    } catch (err) {
      console.error('Owner approve rental error:', err);
      setActionError(parseContractError(err));
      setActionTxState('failed');
    } finally {
      setIsApprovingRequest(false);
    }
  };

  // Handle Owner Rejecting a Pending Rental Request
  const handleOpenRejectRequestModal = (rental) => {
    setRejectRequestItem(rental);
    setRejectRequestReason('');
    setActionTxState(null);
    setActionTxHash(null);
    setActionError(null);
  };

  const handleConfirmRejectRequest = async () => {
    if (!rejectRequestItem) return;

    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    setIsRejectingRequest(true);
    setActionTxState('waiting_approval');
    setActionError(null);

    const targetRentalId = rejectRequestItem.rentalId;

    try {
      const result = await rejectRentalRequestOnChain({
        rentalId: targetRentalId,
        reason: rejectRequestReason,
      });
      setActionTxHash(result.hash);
      setActionTxState('confirmed');

      // Optimistically update ownerRentals immediately
      setOwnerRentals((prev) =>
        prev.map((r) =>
          String(r.rentalId) === String(targetRentalId)
            ? {
                ...r,
                status: RENTAL_STATUS.CANCELLED,
                statusText: 'ปฏิเสธ/ยกเลิกแล้ว (Cancelled)',
              }
            : r
        )
      );

      setRejectRequestItem(null);
      await loadOwnerData(true);
    } catch (err) {
      console.error('Owner reject rental error:', err);
      setActionError(parseContractError(err));
      setActionTxState('failed');
    } finally {
      setIsRejectingRequest(false);
    }
  };

  // Metrics
  const totalOwned = myItems.length;
  const availableCount = myItems.filter((i) => i.available).length;
  const rentedCount = totalOwned - availableCount;
  const activeRentalsCount = ownerRentals.filter((r) => r.status === RENTAL_STATUS.ACTIVE).length;
  const pendingRentalRequests = ownerRentals.filter((r) => r.status === RENTAL_STATUS.PENDING);
  const pendingCancellationRequests = ownerRentals.filter(
    (r) => r.status === RENTAL_STATUS.CANCEL_REQUESTED
  );
  const completedRentalsCount = ownerRentals.filter(
    (r) => r.status === RENTAL_STATUS.RETURNED || r.status === RENTAL_STATUS.COMPLETED
  ).length;

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">{t('owner.title')}</h2>
          <p className="text-muted small mb-0">{t('owner.subtitle')}</p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {account && (
            <button
              onClick={() => setAutoSync(!autoSync)}
              className={`btn btn-sm d-flex align-items-center gap-1 ${
                autoSync ? 'btn-outline-success bg-success-subtle' : 'btn-outline-secondary'
              }`}
              title={autoSync ? 'Auto-sync is ON (every 6s)' : 'Auto-sync is PAUSED'}
            >
              <span
                className={`rounded-circle d-inline-block ${autoSync ? 'bg-success' : 'bg-secondary'}`}
                style={{
                  width: '8px',
                  height: '8px',
                  boxShadow: autoSync ? '0 0 6px rgba(25, 135, 84, 0.8)' : 'none',
                }}
              ></span>
              <span className="small fw-semibold">
                {autoSync
                  ? language === 'th'
                    ? 'ซิงค์สด Real-Time'
                    : 'Live Real-Time Sync'
                  : language === 'th'
                  ? 'หยุดซิงค์ชั่วคราว'
                  : 'Sync Paused'}
              </span>
            </button>
          )}

          <button
            onClick={() => loadOwnerData(false)}
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
          {/* Active Owner Account Banner & Fast Switch */}
          <div className="card shadow-sm border bg-white rounded-3 mb-4 p-3 border-start border-success border-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center"
                  style={{ width: '44px', height: '44px', minWidth: '44px' }}
                >
                  <i className="bi bi-shield-check fs-4"></i>
                </div>
                <div>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="fw-bold text-dark">
                      {language === 'th' ? 'บัญชีเจ้าของที่กำลังเชื่อมต่อ:' : 'Active Connected Owner:'}
                    </span>
                    <span className="badge bg-success font-monospace px-2.5 py-1">
                      {account}
                    </span>
                  </div>
                  <div className="small text-muted mt-0.5">
                    {language === 'th'
                      ? 'แผงควบคุมนี้แสดงเฉพาะทรัพย์สินและคำขอเช่าที่เป็นของบัญชีนี้ หากลงทะเบียนของไว้ด้วยอีกบัญชี ให้กดสลับบัญชี'
                      : 'This panel only shows items and rental requests owned by this wallet. Switch account if needed.'}
                  </div>
                </div>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                  type="button"
                  onClick={switchAccount}
                  className="btn btn-outline-success btn-sm fw-semibold rounded-pill px-3 py-1.5 d-flex align-items-center"
                  title="เปิดหน้าต่างเลือกสลับบัญชีใน MetaMask"
                >
                  <i className="bi bi-arrow-left-right me-1.5"></i>
                  {language === 'th' ? 'สลับบัญชีใน MetaMask' : 'Switch Account'}
                </button>
              </div>
            </div>
          </div>

          {/* Owner Statistics Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statTotalAssets')}</span>
                <div className="fs-3 fw-bold text-dark">{loading ? '-' : totalOwned}</div>
                <span className="badge bg-light text-secondary border small mt-1">
                  {language === 'th' ? 'ลงทะเบียนแล้ว' : 'Registered'}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statAvailable')}</span>
                <div className="fs-3 fw-bold text-success">{loading ? '-' : availableCount}</div>
                <span className="badge bg-success-subtle text-success small mt-1">
                  {t('common.available')}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statRentedOut')}</span>
                <div className="fs-3 fw-bold text-primary">{loading ? '-' : rentedCount}</div>
                <span className="badge bg-primary-subtle text-primary small mt-1">
                  {language === 'th' ? 'ส่งมอบแล้ว' : 'In Custody'}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statActiveRentals')}</span>
                <div className="fs-3 fw-bold text-info">{loading ? '-' : activeRentalsCount}</div>
                <span className="badge bg-info-subtle text-info small mt-1">
                  {t('common.active')}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statCompleted')}</span>
                <div className="fs-3 fw-bold text-success">{loading ? '-' : completedRentalsCount}</div>
                <span className="badge bg-success-subtle text-success small mt-1">
                  {language === 'th' ? 'คืนแล้ว' : 'Returned'}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-lg-2">
              <div className="card h-100 border text-center p-3 shadow-sm bg-white">
                <span className="text-muted small mb-1">{t('owner.statTransactions')}</span>
                <div className="fs-3 fw-bold text-dark">{loading ? '-' : ownerRentals.length}</div>
                <span className="badge bg-secondary-subtle text-secondary small mt-1">
                  {language === 'th' ? 'ธุรกรรม' : 'Transactions'}
                </span>
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

          {/* Action (Cancel) Transaction Status Alert */}
          {actionTxState && (
            <TransactionStatus
              status={actionTxState}
              txHash={actionTxHash}
              errorMessage={actionError}
              onReset={() => {
                setActionTxState(null);
                setActionRental(null);
              }}
            />
          )}

          {error && <ErrorMessage error={error} onRetry={() => loadOwnerData(false)} />}

          {/* Pending Rental Requests Alert Banner */}
          {pendingRentalRequests.length > 0 && (
            <div className="alert alert-info border-info shadow-sm mb-4 p-3 rounded-3 bg-info-subtle text-dark">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2.5">
                  <div
                    className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                    style={{ width: '40px', height: '40px' }}
                  >
                    <i className="bi bi-bell-fill fs-5"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold mb-0 text-dark">
                      {language === 'th'
                        ? `มีคำขอเช่าใหม่รอการอนุมัติของคุณ (${pendingRentalRequests.length} รายการ)`
                        : `New Rental Requests Awaiting Your Approval (${pendingRentalRequests.length})`}
                    </h6>
                    <small className="text-secondary">
                      {language === 'th'
                        ? 'ผู้เช่าได้วางเงินมัดจำและชำระค่าเช่าเข้าสู่ระบบแล้ว กรุณากด "อนุมัติให้เช่า" เพื่อเริ่มสัญญาและเริ่มนับถอยหลัง'
                        : 'Renters have submitted payment to escrow. Click "Approve Rental" to start the agreement and live countdown.'}
                    </small>
                  </div>
                </div>
                <a href="#pending-rental-requests" className="btn btn-sm btn-primary fw-bold shadow-sm">
                  <i className="bi bi-arrow-down-circle me-1"></i>
                  {language === 'th' ? 'ดูคำขอเช่าใหม่' : 'View Requests'}
                </a>
              </div>
            </div>
          )}

          {/* Pending Cancellation Requests Alert Banner */}
          {pendingCancellationRequests.length > 0 && (
            <div className="alert alert-danger border-danger shadow-sm mb-4 p-3 rounded-3 bg-danger-subtle text-danger-emphasis">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2.5">
                  <div
                    className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center shadow-sm"
                    style={{ width: '38px', height: '38px', minWidth: '38px' }}
                  >
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold mb-0 text-danger">
                      {language === 'th'
                        ? `มีคำขอยกเลิกสัญญาเช่ารอการอนุมัติของคุณ (${pendingCancellationRequests.length} รายการ)`
                        : `Pending Cancellation Requests Awaiting Your Approval (${pendingCancellationRequests.length})`}
                    </h6>
                    <small className="text-secondary">
                      {language === 'th'
                        ? 'ผู้เช่าได้ส่งคำขอยกเลิกสัญญาและกำลังรอให้คุณอนุมัติพร้อมโอนเงินคืนยอดค่าเช่า/มัดจำ สามารถกด "อนุมัติ & คืนเงิน" หรือ "ปฏิเสธ" ได้ทันที'
                        : 'Renters have requested cancellation and are awaiting your approval and refund.'}
                    </small>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-danger text-white px-2.5 py-1.5 small animate__animated animate__pulse animate__infinite">
                    {language === 'th' ? 'ต้องดำเนินการอนุมัติ' : 'Action Required'}
                  </span>
                  <a href="#pending-cancellation-requests" className="btn btn-sm btn-danger fw-bold shadow-sm">
                    <i className="bi bi-arrow-down-circle me-1"></i>
                    {language === 'th' ? 'ดูคำขอยกเลิก' : 'View Cancellations'}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Section: Pending Cancellation Requests Awaiting Owner Approval */}
          {pendingCancellationRequests.length > 0 && (
            <div id="pending-cancellation-requests" className="card shadow-sm border border-danger bg-white mb-5">
              <div className="card-header bg-danger-subtle text-danger-emphasis d-flex justify-content-between align-items-center py-3">
                <h5 className="fw-bold mb-0 d-flex align-items-center gap-2 text-danger">
                  <i className="bi bi-exclamation-octagon-fill fs-5"></i>
                  <span>{language === 'th' ? 'คำขอยกเลิกสัญญาเช่าที่รอคุณอนุมัติ & คืนเงิน' : 'Cancellation Requests Awaiting Your Approval & Refund'}</span>
                  <span className="badge bg-danger text-white rounded-pill ms-1">{pendingCancellationRequests.length}</span>
                </h5>
                <span className="small text-muted">
                  {language === 'th' ? 'ผู้เช่าขอยกเลิกสัญญา' : 'Renter Cancellation Request'}
                </span>
              </div>

              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 small">
                    <thead className="table-light">
                      <tr>
                        <th>{t('dashboard.tableRentalId')}</th>
                        <th>{language === 'th' ? 'ทรัพย์สิน' : 'Item'}</th>
                        <th>{t('dashboard.tableRenter')}</th>
                        <th>{language === 'th' ? 'เหตุผลที่ขอยกเลิก' : 'Cancellation Reason'}</th>
                        <th>{language === 'th' ? 'ยอดที่ผู้เช่าชำระ' : 'Amount Paid'}</th>
                        <th>{t('common.status')}</th>
                        <th className="text-end">{language === 'th' ? 'การดำเนินการ' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCancellationRequests.map((r) => {
                        const matchedItem = myItems.find((i) => Number(i.itemId) === Number(r.itemId));
                        return (
                          <tr key={r.rentalId} className="table-danger bg-opacity-10">
                            <td className="fw-bold font-monospace">#{r.rentalId}</td>
                            <td>
                              <Link href={`/rentals/${r.itemId}`} className="fw-bold text-dark text-decoration-none">
                                {matchedItem ? matchedItem.name : (language === 'th' ? `ทรัพย์สิน #${r.itemId}` : `Item #${r.itemId}`)}
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
                              <span className="badge bg-light text-danger border border-danger-subtle fw-medium text-wrap text-start">
                                <i className="bi bi-chat-left-dots me-1"></i>
                                {r.cancelReason || (language === 'th' ? 'ผู้เช่าขอยกเลิกสัญญา' : 'Renter requested cancellation')}
                              </span>
                            </td>
                            <td className="font-monospace text-primary fw-bold">
                              {r.totalPaidEth || '0.0000'} ETH
                              <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                ({language === 'th' ? 'มัดจำ' : 'Deposit'}: {r.depositEth || '0.0000'} ETH)
                              </div>
                            </td>
                            <td>
                              <RentalStatus status={r.status} />
                            </td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <button
                                  type="button"
                                  onClick={() => handleOpenApproveModal(r)}
                                  className="btn btn-success btn-sm fw-bold px-3 shadow-sm"
                                  title={language === 'th' ? 'อนุมัติการยกเลิกและโอนเงินคืนผู้เช่า' : 'Approve cancellation & refund'}
                                >
                                  <i className="bi bi-check-circle-fill me-1"></i>
                                  {language === 'th' ? 'อนุมัติ & คืนเงิน' : 'Approve & Refund'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenRejectModal(r)}
                                  className="btn btn-outline-danger btn-sm fw-medium px-2.5"
                                  title={language === 'th' ? 'ปฏิเสธคำขอยกเลิกสัญญา' : 'Reject cancellation request'}
                                >
                                  <i className="bi bi-x-circle me-1"></i>
                                  {language === 'th' ? 'ปฏิเสธ' : 'Reject'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section 0: Pending Rental Requests Awaiting Approval */}
          {pendingRentalRequests.length > 0 && (
            <div id="pending-rental-requests" className="card shadow-sm border border-warning bg-white mb-5">
              <div className="card-header bg-warning-subtle text-warning-emphasis d-flex justify-content-between align-items-center py-3">
                <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-clock-history fs-5"></i>
                  <span>{language === 'th' ? 'คำขอเช่าใหม่ที่รอคุณอนุมัติ' : 'Pending Rental Requests Awaiting Approval'}</span>
                  <span className="badge bg-warning text-dark rounded-pill ms-1">{pendingRentalRequests.length}</span>
                </h5>
                <span className="small text-muted">
                  {language === 'th' ? 'เงินพักในระบบ Escrow ปลอดภัย' : 'Funds Safely in Escrow'}
                </span>
              </div>

              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 small">
                    <thead className="table-light">
                      <tr>
                        <th>{t('dashboard.tableRentalId')}</th>
                        <th>{language === 'th' ? 'ทรัพย์สิน' : 'Item'}</th>
                        <th>{t('dashboard.tableRenter')}</th>
                        <th>{language === 'th' ? 'ระยะเวลาที่ขอเช่า' : 'Requested Duration'}</th>
                        <th>{language === 'th' ? 'ยอดเงินที่ผู้เช่าชำระ' : 'Total Escrowed'}</th>
                        <th>{t('common.status')}</th>
                        <th className="text-end">{language === 'th' ? 'การดำเนินการ' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRentalRequests.map((r) => {
                        const matchedItem = myItems.find((i) => Number(i.itemId) === Number(r.itemId));
                        return (
                          <tr key={r.rentalId} className="table-warning bg-opacity-25">
                            <td className="fw-bold font-monospace">#{r.rentalId}</td>
                            <td>
                              <Link href={`/rentals/${r.itemId}`} className="fw-bold text-dark text-decoration-none">
                                {matchedItem ? matchedItem.name : (language === 'th' ? `ทรัพย์สิน #${r.itemId}` : `Item #${r.itemId}`)}
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
                              <span className="badge bg-light text-dark border">
                                {r.durationValue || 1} {r.durationUnit || 'days'}
                              </span>
                            </td>
                            <td className="font-monospace text-primary fw-bold">
                              {r.totalPaidEth} ETH
                              <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                ({language === 'th' ? 'ค่าเช่า' : 'Fee'}: {r.rentalPriceEth} + {language === 'th' ? 'มัดจำ' : 'Deposit'}: {r.depositEth})
                              </div>
                            </td>
                            <td>
                              <RentalStatus status={r.status} />
                            </td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <button
                                  type="button"
                                  onClick={() => handleOpenApproveRequestModal(r)}
                                  className="btn btn-success btn-sm fw-bold px-3 shadow-sm"
                                  title={language === 'th' ? 'อนุมัติให้เช่าและเริ่มนับเวลาสัญญา' : 'Approve rental and start countdown'}
                                >
                                  <i className="bi bi-check-circle-fill me-1"></i>
                                  {language === 'th' ? 'อนุมัติให้เช่า' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenRejectRequestModal(r)}
                                  className="btn btn-outline-danger btn-sm fw-medium px-2.5"
                                  title={language === 'th' ? 'ปฏิเสธคำขอและคืนเงินให้ผู้เช่า' : 'Reject rental request'}
                                >
                                  <i className="bi bi-x-circle me-1"></i>
                                  {language === 'th' ? 'ปฏิเสธ' : 'Reject'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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
                <Loading
                  message={
                    language === 'th'
                      ? 'กำลังอ่านทรัพย์สินของคุณจาก Ethereum Sepolia...'
                      : 'Reading your registered assets from Ethereum Sepolia...'
                  }
                />
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
                        <th className="text-end">
                          {language === 'th' ? 'จัดการความพร้อม' : 'Availability Action'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {myItems.map((item) => (
                        <tr key={item.itemId}>
                          <td className="fw-bold font-monospace">#{item.itemId}</td>
                          <td>
                            <Link
                              href={`/rentals/${item.itemId}`}
                              className="fw-semibold text-dark text-decoration-none"
                            >
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
                                className={`btn btn-sm ${
                                  item.available ? 'btn-outline-warning' : 'btn-outline-success'
                                }`}
                                title={item.available ? 'Pause availability' : 'Make available'}
                              >
                                {togglingItemId === item.itemId ? (
                                  <span
                                    className="spinner-border spinner-border-sm"
                                    role="status"
                                  ></span>
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
                        <th>{language === 'th' ? 'การนับถอยหลังสด' : 'Live Timer'}</th>
                        <th>{language === 'th' ? 'ระยะเวลาการเช่า (Real-Time)' : 'Rental Period'}</th>
                        <th>{t('dashboard.tableTotalPaid')}</th>
                        <th>{t('dashboard.tableDeposit')}</th>
                        <th>{t('common.status')}</th>
                        <th className="text-end">{language === 'th' ? 'การจัดการ' : 'Action'}</th>
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
                            <RentalCountdown
                              startTime={r.startTime}
                              endTime={r.endTime}
                              status={r.status}
                              language={language}
                            />
                          </td>
                          <td className="font-monospace small">
                            {r.status === RENTAL_STATUS.PENDING ? (
                              <span className="text-warning fw-semibold">
                                {language === 'th' ? 'รออนุมัติ (ยังไม่เริ่ม)' : 'Pending Approval'}
                              </span>
                            ) : (
                              <>
                                <div>{formatDateTime(r.startTime, language, true)}</div>
                                <div className="text-muted">➔ {formatDateTime(r.endTime, language, true)}</div>
                              </>
                            )}
                          </td>
                          <td className="font-monospace text-primary fw-medium">{r.totalPaidEth} ETH</td>
                          <td className="font-monospace text-success">{r.depositEth} ETH</td>
                          <td>
                            <RentalStatus status={r.status} />
                          </td>
                          <td className="text-end">
                            <div className="btn-group btn-group-sm">
                              <Link
                                href={`/claims?id=${r.rentalId}`}
                                className="btn btn-outline-info btn-xs"
                                title="Audit on Claims page"
                              >
                                <i className="bi bi-shield-check"></i>{' '}
                                {language === 'th' ? 'ตรวจสอบ' : 'Audit'}
                              </Link>
                              {r.status === RENTAL_STATUS.PENDING && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenApproveRequestModal(r)}
                                    className="btn btn-success btn-xs fw-bold"
                                    title={language === 'th' ? 'อนุมัติให้เช่าและเริ่มนับเวลา' : 'Approve rental'}
                                  >
                                    <i className="bi bi-check-circle me-1"></i>{' '}
                                    {language === 'th' ? 'อนุมัติให้เช่า' : 'Approve'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRejectRequestModal(r)}
                                    className="btn btn-outline-danger btn-xs"
                                    title={language === 'th' ? 'ปฏิเสธคำขอและคืนเงิน' : 'Reject request'}
                                  >
                                    <i className="bi bi-x-circle me-1"></i>{' '}
                                    {language === 'th' ? 'ปฏิเสธ' : 'Reject'}
                                  </button>
                                </>
                              )}
                              {r.status === RENTAL_STATUS.CANCEL_REQUESTED && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenApproveModal(r)}
                                    className="btn btn-success btn-xs fw-bold"
                                    title={language === 'th' ? 'อนุมัติการยกเลิกและโอนคืนเงินให้ผู้เช่า' : 'Approve cancellation & refund'}
                                  >
                                    <i className="bi bi-check-circle me-1"></i>{' '}
                                    {language === 'th' ? 'อนุมัติ & คืนเงิน' : 'Approve & Refund'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRejectModal(r)}
                                    className="btn btn-outline-secondary btn-xs"
                                    title={language === 'th' ? 'ปฏิเสธคำขอยกเลิก' : 'Reject cancellation request'}
                                  >
                                    <i className="bi bi-x-circle me-1"></i>{' '}
                                    {language === 'th' ? 'ปฏิเสธ' : 'Reject'}
                                  </button>
                                </>
                              )}
                              {r.status === RENTAL_STATUS.ACTIVE && (
                                <button
                                  type="button"
                                  onClick={() => setActionRental(r)}
                                  className="btn btn-outline-danger btn-xs"
                                  title="Cancel rental & refund deposit"
                                >
                                  <i className="bi bi-x-circle"></i>{' '}
                                  {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                                </button>
                              )}
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

          {/* Cancellation Confirmation Modal for Owner (Direct) */}
          {actionRental && (
            <div
              className="modal fade show d-block"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
              tabIndex="-1"
            >
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content shadow">
                  <div className="modal-header bg-danger text-white">
                    <h5 className="modal-title fw-bold">
                      <i className="bi bi-x-circle me-2"></i>
                      {language === 'th' ? 'ยกเลิกสัญญาเช่า (เจ้าของทรัพย์สิน)' : 'Cancel Rental Agreement'}
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      disabled={isProcessing}
                      onClick={() => setActionRental(null)}
                    ></button>
                  </div>

                  <div className="modal-body p-4">
                    <p className="mb-3">
                      {language === 'th'
                        ? 'คุณกำลังจะยกเลิกสัญญาเช่าหมายเลข'
                        : 'You are cancelling agreement'}{' '}
                      <strong className="font-monospace">#{actionRental.rentalId}</strong>{' '}
                      (Item #{actionRental.itemId})
                    </p>

                    <div className="p-3 bg-light rounded border mb-3 small">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">ผู้เช่า (Renter):</span>
                        <span className="font-monospace">{formatAddress(actionRental.renter)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">
                          {language === 'th' ? 'คืนเงินมัดจำเข้าผู้เช่า:' : 'Refund Deposit to Renter:'}
                        </span>
                        <span className="fw-bold font-monospace text-success">
                          +{actionRental.depositEth} ETH
                        </span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">
                          {language === 'th' ? 'สถานะทรัพย์สิน:' : 'Asset Status:'}
                        </span>
                        <span className="fw-bold text-primary">
                          {language === 'th' ? 'กลับมาพร้อมให้เช่าใหม่' : 'Available again'}
                        </span>
                      </div>
                    </div>

                    <div className="alert alert-info py-2 px-3 small mb-0">
                      <i className="bi bi-info-circle-fill me-1"></i>
                      {language === 'th'
                        ? 'เมื่อยืนยัน ระบบ Smart Contract จะคืนเงินมัดจำความเสียหายให้ผู้เช่าโดยอัตโนมัติ และปลดล็อกทรัพย์สินให้พร้อมปล่อยเช่าใหม่'
                        : 'Upon confirmation, the smart contract will immediately refund the security deposit back to the renter and make your asset available again.'}
                    </div>
                  </div>

                  <div className="modal-footer bg-light">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={isProcessing}
                      onClick={() => setActionRental(null)}
                    >
                      {language === 'th' ? 'ยกเลิก / ปิด' : 'Close'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger fw-bold"
                      disabled={isProcessing}
                      onClick={handleConfirmCancel}
                    >
                      {isProcessing ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          ></span>
                          {language === 'th' ? 'กำลังยกเลิก...' : 'Cancelling...'}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-1"></i>
                          {language === 'th' ? 'ยืนยันการยกเลิกสัญญา' : 'Confirm Cancellation'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Owner Approve Cancellation & Refund Modal */}
          {approveRentalItem && (
            <div
              className="modal fade show d-block"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
              tabIndex="-1"
            >
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
                  <div className="modal-header bg-success text-white py-3">
                    <h5 className="modal-title fw-bold d-flex align-items-center">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      {language === 'th'
                        ? 'อนุมัติการยกเลิกสัญญาเช่า & คืนเงินผู้เช่า'
                        : 'Approve Cancellation & Refund Renter'}
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      disabled={isProcessing}
                      onClick={() => setApproveRentalItem(null)}
                    ></button>
                  </div>

                  <div className="modal-body p-4 bg-white">
                    <p className="mb-2 text-dark">
                      {language === 'th'
                        ? 'คุณกำลังจะอนุมัติการยกเลิกสัญญาเช่าหมายเลข'
                        : 'You are approving the cancellation request for agreement'}{' '}
                      <strong className="font-monospace">#{approveRentalItem.rentalId}</strong>{' '}
                      (Item #{approveRentalItem.itemId})
                    </p>

                    <div className="p-3 bg-light rounded-3 border mb-3 small">
                      <div className="d-flex justify-content-between mb-1.5">
                        <span className="text-muted">{language === 'th' ? 'ผู้เช่า (Renter):' : 'Renter Address:'}</span>
                        <span className="font-monospace fw-bold text-dark">{formatAddress(approveRentalItem.renter)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1.5">
                        <span className="text-muted">{language === 'th' ? 'ยอดที่ผู้เช่าชำระไว้รวม:' : 'Total Paid by Renter:'}</span>
                        <span className="font-monospace text-primary fw-bold">{approveRentalItem.totalPaidEth} ETH</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1.5">
                        <span className="text-muted">{language === 'th' ? 'เงินมัดจำเดิม:' : 'Security Deposit:'}</span>
                        <span className="font-monospace text-success fw-bold">+{approveRentalItem.depositEth} ETH</span>
                      </div>
                      {approveRentalItem.cancelReason && (
                        <div className="d-flex justify-content-between pt-1 border-top">
                          <span className="text-muted">{language === 'th' ? 'เหตุผลที่ผู้เช่าระบุ:' : 'Renter Reason:'}</span>
                          <span className="text-dark fw-medium">{approveRentalItem.cancelReason}</span>
                        </div>
                      )}
                    </div>

                    {/* Refund Amount input */}
                    <div className="card bg-light border p-3 rounded-3 mb-3">
                      <label className="form-label fw-bold small text-dark mb-1">
                        <i className="bi bi-cash-stack text-success me-1"></i>
                        {language === 'th' ? 'ยอดเงินที่จะโอนคืนผู้เช่า (ETH):' : 'Refund Amount in ETH:'}
                      </label>
                      <input
                        type="text"
                        className="form-control font-monospace fw-bold"
                        value={refundAmountEth}
                        onChange={(e) => setRefundAmountEth(e.target.value)}
                        disabled={isProcessing}
                        placeholder="0.0500"
                      />
                      <small className="text-muted mt-1 d-block" style={{ fontSize: '0.78rem' }}>
                        {language === 'th'
                          ? 'ค่าเริ่มต้นคือยอดชำระรวม (ค่าเช่า + มัดจำ) หรือปรับเปลี่ยนตามที่ตกลงกัน'
                          : 'Defaults to total paid (rental fee + deposit), or adjust as agreed.'}
                      </small>
                    </div>

                    <div className="alert alert-info py-2 px-3 small mb-0">
                      <i className="bi bi-info-circle-fill me-1"></i>
                      {language === 'th'
                        ? 'เมื่อกดยืนยัน MetaMask จะเปิดขึ้นมาเพื่อให้คุณโอนเงินคืนผู้เช่า และระบบจะปรับสถานะสัญญาเป็น "ยกเลิกแล้ว (คืนเงินแล้ว)" พร้อมปลดล็อกทรัพย์สินของคุณให้พร้อมปล่อยเช่าใหม่อีกครั้ง'
                        : 'Upon confirmation, MetaMask will prompt you to transfer the refund back to the renter. The agreement will be marked as cancelled & refunded, and your asset will become available again.'}
                    </div>
                  </div>

                  <div className="modal-footer bg-light py-2.5">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={isProcessing}
                      onClick={() => setApproveRentalItem(null)}
                    >
                      {language === 'th' ? 'ปิด' : 'Close'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-success fw-bold px-4"
                      disabled={isProcessing}
                      onClick={handleConfirmApproveAndRefund}
                    >
                      {isProcessing ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          ></span>
                          {language === 'th' ? 'กำลังทำธุรกรรมคืนเงิน...' : 'Processing Refund...'}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle-fill me-1"></i>
                          {language === 'th' ? 'ยืนยันอนุมัติ & โอนเงินคืน' : 'Confirm & Refund via MetaMask'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Owner Reject Cancellation Modal */}
          {rejectRentalItem && (
            <div
              className="modal fade show d-block"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
              tabIndex="-1"
            >
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content shadow border-0 rounded-4 overflow-hidden">
                  <div className="modal-header bg-secondary text-white py-3">
                    <h5 className="modal-title fw-bold">
                      <i className="bi bi-x-circle me-2"></i>
                      {language === 'th' ? 'ปฏิเสธคำขอยกเลิกสัญญา' : 'Reject Cancellation Request'}
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      disabled={isProcessing}
                      onClick={() => setRejectRentalItem(null)}
                    ></button>
                  </div>

                  <div className="modal-body p-4 bg-white">
                    <p className="mb-2 text-dark">
                      {language === 'th'
                        ? 'คุณต้องการปฏิเสธคำขอยกเลิกสัญญาเช่าหมายเลข'
                        : 'Are you sure you want to decline the cancellation request for'}{' '}
                      <strong className="font-monospace">#{rejectRentalItem.rentalId}</strong>?
                    </p>
                    <p className="small text-muted mb-3">
                      {language === 'th'
                        ? 'สัญญาเช่าจะกลับสู่สถานะ "กำลังเช่าอยู่ (Active)" ตามเดิม'
                        : 'The rental agreement will remain in Active status.'}
                    </p>

                    <div className="mb-2">
                      <label className="form-label small fw-bold text-dark">
                        {language === 'th' ? 'ระบุเหตุผลในการปฏิเสธ (ถ้ามี):' : 'Rejection Reason (Optional):'}
                      </label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="2"
                        placeholder={language === 'th' ? 'เช่น ทรัพย์สินอยู่ระหว่างจัดส่ง, ไม่ตรงตามข้อตกลง...' : 'e.g. Asset already in transit, etc.'}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        disabled={isProcessing}
                      ></textarea>
                    </div>
                  </div>

                  <div className="modal-footer bg-light py-2.5">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={isProcessing}
                      onClick={() => setRejectRentalItem(null)}
                    >
                      {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger fw-bold"
                      disabled={isProcessing}
                      onClick={handleConfirmReject}
                    >
                      {language === 'th' ? 'ยืนยันปฏิเสธคำขอ' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Owner Approve Rental Request Modal */}
          {approveRequestItem && (
            <div
              className="modal fade show d-block"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
              tabIndex="-1"
            >
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content shadow border-0 rounded-4 overflow-hidden">
                  <div className="modal-header bg-success text-white py-3">
                    <h5 className="modal-title fw-bold">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      {language === 'th' ? 'อนุมัติคำขอเช่าอุปกรณ์' : 'Approve Rental Request'}
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      disabled={isApprovingRequest}
                      onClick={() => setApproveRequestItem(null)}
                    ></button>
                  </div>

                  <div className="modal-body p-4 bg-white">
                    <p className="mb-3 text-dark">
                      {language === 'th'
                        ? 'คุณต้องการอนุมัติคำขอเช่าหมายเลข'
                        : 'Are you sure you want to approve Rental'}{' '}
                      <strong className="font-monospace">#{approveRequestItem.rentalId}</strong>?
                    </p>

                    <div className="p-3 bg-light rounded-3 border mb-3 small">
                      <div className="d-flex justify-content-between mb-1.5">
                        <span className="text-muted">{language === 'th' ? 'ผู้ขอเช่า:' : 'Renter:'}</span>
                        <span className="font-monospace fw-medium text-dark">
                          {formatAddress(approveRequestItem.renter)}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between mb-1.5">
                        <span className="text-muted">{language === 'th' ? 'ระยะเวลาเช่า:' : 'Duration:'}</span>
                        <span className="fw-bold text-dark">
                          {approveRequestItem.durationValue || 1} {approveRequestItem.durationUnit || 'days'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">{language === 'th' ? 'ยอดเงินที่พักไว้ในระบบ:' : 'Escrow Amount:'}</span>
                        <span className="fw-bold font-monospace text-primary">
                          {approveRequestItem.totalPaidEth} ETH
                        </span>
                      </div>
                    </div>

                    <div className="alert alert-info py-2 px-3 small mb-0">
                      <i className="bi bi-info-circle-fill me-1"></i>
                      {language === 'th'
                        ? 'เมื่อคุณกดอนุมัติ ระบบจะเริ่มนับเวลาการเช่าถอยหลังทันที และสัญญาจะมีสถานะเป็น "กำลังเช่าอยู่ (Active)"'
                        : 'Once approved, the rental timer will start ticking immediately in real-time.'}
                    </div>

                    {actionError && (
                      <div className="alert alert-danger py-2 px-3 small mt-3 mb-0">
                        <i className="bi bi-exclamation-triangle-fill me-1.5"></i>
                        {actionError}
                      </div>
                    )}
                  </div>

                  <div className="modal-footer bg-light py-2.5">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={isApprovingRequest}
                      onClick={() => setApproveRequestItem(null)}
                    >
                      {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-success fw-bold px-4"
                      disabled={isApprovingRequest}
                      onClick={handleConfirmApproveRequest}
                    >
                      {isApprovingRequest ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          {language === 'th' ? 'กำลังอนุมัติ...' : 'Approving...'}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check2-circle me-1.5"></i>
                          {language === 'th' ? 'ยืนยันอนุมัติให้เช่า' : 'Confirm Approval'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Owner Reject Rental Request Modal */}
          {rejectRequestItem && (
            <div
              className="modal fade show d-block"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
              tabIndex="-1"
            >
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content shadow border-0 rounded-4 overflow-hidden">
                  <div className="modal-header bg-danger text-white py-3">
                    <h5 className="modal-title fw-bold">
                      <i className="bi bi-x-circle-fill me-2"></i>
                      {language === 'th' ? 'ปฏิเสธคำขอเช่าและคืนเงิน' : 'Reject Rental Request & Refund'}
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      disabled={isRejectingRequest}
                      onClick={() => setRejectRequestItem(null)}
                    ></button>
                  </div>

                  <div className="modal-body p-4 bg-white">
                    <p className="mb-3 text-dark">
                      {language === 'th'
                        ? 'คุณกำลังจะปฏิเสธคำขอเช่าหมายเลข'
                        : 'You are declining Rental'}{' '}
                      <strong className="font-monospace">#{rejectRequestItem.rentalId}</strong>
                    </p>

                    <div className="p-3 bg-light rounded-3 border mb-3 small">
                      <div className="d-flex justify-content-between mb-1.5">
                        <span className="text-muted">{language === 'th' ? 'ผู้ขอเช่า:' : 'Renter:'}</span>
                        <span className="font-monospace text-dark">{formatAddress(rejectRequestItem.renter)}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">{language === 'th' ? 'ยอดเงินที่จะคืนผู้เช่า:' : 'Refund to Renter:'}</span>
                        <span className="fw-bold font-monospace text-success">+{rejectRequestItem.totalPaidEth} ETH</span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold text-dark">
                        {language === 'th' ? 'ระบุเหตุผลในการปฏิเสธ (ถ้ามี):' : 'Rejection Reason (Optional):'}
                      </label>
                      <input
                        type="text"
                        value={rejectRequestReason}
                        onChange={(e) => setRejectRequestReason(e.target.value)}
                        placeholder={language === 'th' ? 'เช่น อุปกรณ์ส่งซ่อมด่วน, ติดภารกิจ' : 'e.g. Item under maintenance'}
                        className="form-control form-control-sm"
                        maxLength={120}
                        disabled={isRejectingRequest}
                      />
                    </div>

                    <div className="alert alert-warning py-2 px-3 small mb-0">
                      <i className="bi bi-exclamation-triangle-fill me-1"></i>
                      {language === 'th'
                        ? 'เมื่อยืนยัน ระบบจะคืนเงินค่าเช่าและค่ามัดจำเต็มจำนวนให้แก่ผู้เช่า และอุปกรณ์จะกลับมาพร้อมให้เช่าใหม่อีกครั้ง'
                        : 'Upon confirmation, all escrowed funds will be returned to the renter, and your asset will be made available again.'}
                    </div>

                    {actionError && (
                      <div className="alert alert-danger py-2 px-3 small mt-3 mb-0">
                        <i className="bi bi-exclamation-triangle-fill me-1.5"></i>
                        {actionError}
                      </div>
                    )}
                  </div>

                  <div className="modal-footer bg-light py-2.5">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={isRejectingRequest}
                      onClick={() => setRejectRequestItem(null)}
                    >
                      {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger fw-bold px-4"
                      disabled={isRejectingRequest}
                      onClick={handleConfirmRejectRequest}
                    >
                      {isRejectingRequest ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          {language === 'th' ? 'กำลังปฏิเสธ & คืนเงิน...' : 'Rejecting & Refunding...'}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-x-circle me-1.5"></i>
                          {language === 'th' ? 'ยืนยันปฏิเสธ & คืนเงิน' : 'Confirm Reject & Refund'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
