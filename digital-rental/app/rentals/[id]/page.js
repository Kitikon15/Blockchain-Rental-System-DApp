'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useWallet } from '../../../context/WalletContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
  fetchItemById,
  fetchAllRentals,
  updateItemAvailabilityOnChain,
  returnItemOnChain,
  cancelRentalOnChain,
  requestRentalCancellationOnChain,
  isContractConfigured,
  parseContractError,
} from '../../../lib/contract';
import { formatAddress, formatDateTime } from '../../../lib/wallet';
import { DEFAULT_EXPLORER_URL, CATEGORY_ICONS, RENTAL_STATUS } from '../../../lib/constants';
import RentalStatus from '../../../components/RentalStatus';
import RentalCountdown from '../../../components/RentalCountdown';
import RentalModal from '../../../components/RentalModal';
import Loading from '../../../components/Loading';
import ErrorMessage from '../../../components/ErrorMessage';
import TransactionStatus from '../../../components/TransactionStatus';

/**
 * Rental Details Page (app/rentals/[id]/page.js)
 * Displays deep on-chain specs for an asset, owner verification, duration calculator,
 * previous rental history on Sepolia, and rental execution with bilingual support.
 */
export default function ItemDetailsPage() {
  const params = useParams();
  const itemId = params.id;

  const { account, isSepolia, connect, switchNetwork } = useWallet();
  const { t, language } = useLanguage();

  const [item, setItem] = useState(null);
  const [itemRentals, setItemRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal checkout
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Owner toggle availability state
  const [toggleTxState, setToggleTxState] = useState(null);
  const [toggleTxHash, setToggleTxHash] = useState(null);
  const [toggleError, setToggleError] = useState(null);
  const [isToggling, setIsToggling] = useState(false);

  const contractConfigured = isContractConfigured();
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  // Live action state (Return or Cancel Request)
  const [actionTxState, setActionTxState] = useState(null);
  const [actionTxHash, setActionTxHash] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Cancellation request modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelModalRentalId, setCancelModalRentalId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadItemDetails = useCallback(async () => {
    if (!contractConfigured || !itemId) {
      setLoading(false);
      return;
    }

    try {
      const fetchedItem = await fetchItemById(Number(itemId), account);
      setItem(fetchedItem);

      // Fetch rental history for this item
      try {
        const allRentals = await fetchAllRentals(account);
        const relatedRentals = (allRentals || []).filter(
          (r) => Number(r.itemId) === Number(itemId)
        );
        setItemRentals(relatedRentals);
      } catch (rErr) {
        console.warn('Could not load item rental history:', rErr.message);
      }
    } catch (err) {
      console.error('Error fetching item details:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [contractConfigured, itemId, account]);

  useEffect(() => {
    loadItemDetails();
    // Real-time live auto-refresh polling
    const interval = setInterval(() => {
      loadItemDetails();
    }, 6000);
    return () => clearInterval(interval);
  }, [loadItemDetails]);

  // Check ownership
  const isOwner =
    account && item?.owner && account.toLowerCase() === item.owner.toLowerCase();

  // Check if current user is active renter of this item (including waiting for cancellation approval)
  const activeRentalForUser = itemRentals.find(
    (r) =>
      (r.status === RENTAL_STATUS.ACTIVE || r.status === RENTAL_STATUS.CANCEL_REQUESTED) &&
      r.renter &&
      account &&
      r.renter.toLowerCase() === account.toLowerCase()
  );

  const handleToggleAvailability = async () => {
    if (!isOwner) return;
    setIsToggling(true);
    setToggleTxState('waiting_approval');
    setToggleError(null);

    try {
      const newStatus = !item.available;
      const { hash } = await updateItemAvailabilityOnChain(item.itemId, newStatus);
      setToggleTxHash(hash);
      setToggleTxState('confirmed');
      await loadItemDetails();
    } catch (err) {
      console.error('Toggle availability error:', err);
      setToggleError(parseContractError(err));
      setToggleTxState('failed');
    } finally {
      setIsToggling(false);
    }
  };

  const handleReturnAction = async (rentalId) => {
    setIsProcessingAction(true);
    setActionTxState('waiting_approval');
    setActionError(null);
    try {
      const { hash } = await returnItemOnChain(rentalId);
      setActionTxHash(hash);
      setActionTxState('confirmed');
      await loadItemDetails();
    } catch (err) {
      console.error('Return item error:', err);
      setActionError(parseContractError(err));
      setActionTxState('failed');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const openCancelModal = (rentalId) => {
    setCancelModalRentalId(rentalId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleConfirmCancelRequest = async () => {
    if (!cancelModalRentalId) return;
    setIsProcessingAction(true);
    setActionTxState('waiting_approval');
    setActionError(null);
    try {
      const { hash } = await requestRentalCancellationOnChain(cancelModalRentalId, cancelReason);
      setActionTxHash(hash);
      setActionTxState('confirmed');
      setShowCancelModal(false);
      await loadItemDetails();
    } catch (err) {
      console.error('Cancel rental request error:', err);
      setActionError(parseContractError(err));
      setActionTxState('failed');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const categoryIcon = item ? CATEGORY_ICONS[item.category] || 'bi-box-seam' : 'bi-box-seam';
  const categoryLabel = item ? t(`categories.${item.category}`) || item.category : '';

  return (
    <div className="container py-4">
      {/* Breadcrumb Navigation */}
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item">
            <Link href="/" className="text-decoration-none">
              {t('rentalDetails.breadcrumbHome')}
            </Link>
          </li>
          <li className="breadcrumb-item">
            <Link href="/rentals" className="text-decoration-none">
              {t('rentalDetails.breadcrumbBrowse')}
            </Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            {t('rentalDetails.itemPrefix')}{itemId}
          </li>
        </ol>
      </nav>

      {/* Error Banner */}
      {error && <ErrorMessage error={error} onRetry={loadItemDetails} />}

      {/* Loading Banner */}
      {loading ? (
        <Loading message={language === 'th' ? `กำลังโหลดข้อมูลทรัพย์สิน #${itemId} จาก Ethereum Sepolia...` : `Loading Item #${itemId} from Ethereum Sepolia...`} />
      ) : !item ? (
        <div className="card shadow-sm border text-center py-5 bg-white">
          <div className="card-body">
            <i className="bi bi-question-circle text-muted fs-1 mb-3"></i>
            <h5 className="fw-bold">{language === 'th' ? 'ไม่พบทรัพย์สิน' : 'Item Not Found'}</h5>
            <p className="text-muted small mb-4">
              {language === 'th'
                ? `ทรัพย์สิน #${itemId} ไม่ปรากฏบน Smart Contract หรือไม่สามารถโหลดได้`
                : `Item #${itemId} does not exist on this smart contract or could not be loaded.`}
            </p>
            <Link href="/rentals" className="btn btn-primary btn-sm">
              <i className="bi bi-arrow-left me-1"></i> {t('rentalDetails.breadcrumbBrowse')}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Active Rental Status & Info Banner if current user is renting this item */}
          {activeRentalForUser && (
            <div
              className={`card border-0 mb-4 shadow-sm overflow-hidden ${
                activeRentalForUser.status === RENTAL_STATUS.CANCEL_REQUESTED
                  ? 'bg-warning-subtle border-start border-4 border-warning'
                  : 'bg-primary-subtle border-start border-4 border-primary'
              }`}
            >
              <div className="card-body p-4">
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span
                        className={`badge ${
                          activeRentalForUser.status === RENTAL_STATUS.CANCEL_REQUESTED
                            ? 'bg-warning text-dark'
                            : 'bg-primary'
                        } fw-bold px-2.5 py-1.5`}
                      >
                        <i
                          className={`bi ${
                            activeRentalForUser.status === RENTAL_STATUS.CANCEL_REQUESTED
                              ? 'bi-hourglass-split'
                              : 'bi-patch-check-fill'
                          } me-1`}
                        ></i>
                        {activeRentalForUser.status === RENTAL_STATUS.CANCEL_REQUESTED
                          ? (language === 'th' ? 'สถานะ: ส่งคำขอยกเลิกแล้ว (รอเจ้าของอนุมัติ)' : 'Status: Cancellation Requested')
                          : (language === 'th' ? 'สถานะ: คุณกำลังเช่าอุปกรณ์ชิ้นนี้อยู่' : 'Status: You Are Currently Renting This')}
                      </span>
                      <span className="badge bg-white text-secondary border font-monospace">
                        Rental #{activeRentalForUser.rentalId}
                      </span>
                    </div>
                    <h5 className="fw-bold mb-1 text-dark">
                      {language === 'th'
                        ? `ข้อมูลการเช่าของคุณ: ${item.name}`
                        : `Your Active Rental Information: ${item.name}`}
                    </h5>
                    <div className="small text-secondary mt-1 d-flex flex-wrap gap-3">
                      <span>
                        <i className="bi bi-calendar3 me-1 text-primary"></i>
                        {language === 'th' ? 'เริ่มต้นเช่า:' : 'Start:'} <strong>{formatDateTime(activeRentalForUser.startTime, language)}</strong>
                      </span>
                      <span>
                        <i className="bi bi-calendar-check me-1 text-danger"></i>
                        {language === 'th' ? 'กำหนดส่งคืน:' : 'Due Date:'} <strong>{formatDateTime(activeRentalForUser.endTime, language)}</strong>
                      </span>
                      <span>
                        <i className="bi bi-cash-stack me-1 text-success"></i>
                        {language === 'th' ? 'ยอดเงินที่ชำระแล้ว:' : 'Total Paid:'} <strong>{activeRentalForUser.totalPaidEth} ETH</strong>
                      </span>
                    </div>

                    {activeRentalForUser.status === RENTAL_STATUS.CANCEL_REQUESTED ? (
                      <div className="alert alert-warning py-2 px-3 small mt-3 mb-0 border-warning">
                        <i className="bi bi-info-circle-fill me-1"></i>
                        {language === 'th'
                          ? 'คุณได้ส่งคำขอยกเลิกการเช่าแล้ว กรุณารอเจ้าของทรัพย์สินกดอนุมัติการยกเลิกและโอนยอดค่าเช่า/มัดจำคืนเข้าวอลเล็ตของคุณ'
                          : 'You have submitted a cancellation request. Please wait for the owner to approve and refund your ETH back to your wallet.'}
                      </div>
                    ) : (
                      <div className="text-muted small mt-2">
                        <i className="bi bi-shield-check text-success me-1"></i>
                        {language === 'th'
                          ? 'สัญญาเช่ามีผลบน Smart Contract เรียบร้อย ระบบจะแจ้งเตือนอัตโนมัติก่อนหมดเวลาเช่า'
                          : 'Rental contract is active on the Smart Contract. The system will alert you before the rental period expires.'}
                      </div>
                    )}
                  </div>

                  <div className="d-flex flex-column align-items-md-end gap-2 text-md-end">
                    <span className="small text-muted fw-semibold d-block">
                      {language === 'th' ? 'เวลานับถอยหลัง Real-time:' : 'Live Rental Countdown:'}
                    </span>
                    <RentalCountdown
                      endTime={activeRentalForUser.endTime}
                      startTime={activeRentalForUser.startTime}
                      status={activeRentalForUser.status}
                    />
                    <Link
                      href="/my-rentals"
                      className="btn btn-outline-dark btn-sm rounded-pill mt-2"
                    >
                      <i className="bi bi-collection-play me-1"></i>
                      {language === 'th' ? 'ไปยังศูนย์ข้อมูลการเช่าของฉัน' : 'View My Rentals Hub'}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="row g-4">
          {/* Left Column: Item Specifications */}
          <div className="col-lg-8">
            <div className="card shadow-sm border bg-white mb-4">
              <div className="card-header bg-light d-flex justify-content-between align-items-center py-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1.5">
                    <i className={`bi ${categoryIcon} me-1`}></i>
                    {categoryLabel}
                  </span>
                  <span className="badge bg-secondary font-monospace">Item #{item.itemId}</span>
                </div>
                <RentalStatus available={item.available} />
              </div>

              <div className="card-body p-4">
                <h3 className="fw-bold text-dark mb-3">{item.name}</h3>

                <h6 className="fw-bold text-secondary text-uppercase small mb-2">
                  {t('rentalDetails.descriptionHeader')}
                </h6>
                <p className="text-dark mb-4 leading-relaxed" style={{ whiteSpace: 'pre-line' }}>
                  {item.description || t('rentalDetails.noDescription')}
                </p>

                <hr className="my-4 text-muted" />

                <h6 className="fw-bold text-secondary text-uppercase small mb-3">
                  {t('rentalDetails.blockchainMetadata')}
                </h6>
                <div className="row g-3 small">
                  <div className="col-sm-6">
                    <div className="border rounded p-3 bg-light">
                      <span className="text-muted d-block mb-1">{t('rentalDetails.ownerAddress')}</span>
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="font-monospace text-dark fw-medium">
                          {formatAddress(item.owner)}
                        </span>
                        <a
                          href={`${explorerBase}/address/${item.owner}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-xs btn-outline-secondary py-0 px-1 text-decoration-none"
                        >
                          <i className="bi bi-box-arrow-up-right"></i> Etherscan
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="col-sm-6">
                    <div className="border rounded p-3 bg-light">
                      <span className="text-muted d-block mb-1">{t('rentalDetails.ledgerVerification')}</span>
                      <span className="badge bg-success-subtle text-success border border-success-subtle">
                        {language === 'th' ? 'ตรวจสอบบน Ethereum Sepolia สำเร็จ' : 'Ethereum Sepolia Verified'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Owner controls if user is owner */}
                {isOwner && (
                  <div className="mt-4 p-3 bg-light border border-info-subtle rounded-3">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <div>
                        <h6 className="fw-bold text-primary mb-0">
                          <i className="bi bi-shield-check me-1"></i> {t('rentalDetails.ownerControls')}
                        </h6>
                        <span className="text-muted small">
                          {t('rentalDetails.ownerNotice')}
                        </span>
                      </div>
                      <button
                        onClick={handleToggleAvailability}
                        disabled={isToggling}
                        className={`btn btn-sm ${item.available ? 'btn-outline-danger' : 'btn-outline-success'} fw-medium`}
                      >
                        {isToggling ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1"></span>
                            Updating...
                          </>
                        ) : item.available ? (
                          <>
                            <i className="bi bi-pause-circle me-1"></i> {t('rentalDetails.markUnavailable')}
                          </>
                        ) : (
                          <>
                            <i className="bi bi-play-circle me-1"></i> {t('rentalDetails.markAvailable')}
                          </>
                        )}
                      </button>
                    </div>

                    {toggleTxState && (
                      <div className="mt-3">
                        <TransactionStatus
                          status={toggleTxState}
                          txHash={toggleTxHash}
                          errorMessage={toggleError}
                          onReset={() => setToggleTxState(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Previous Rental History for this Item */}
            <div className="card shadow-sm border bg-white">
              <div className="card-header bg-light d-flex justify-content-between align-items-center py-3">
                <div className="d-flex align-items-center gap-2">
                  <h5 className="fw-bold text-dark mb-0">
                    <i className="bi bi-clock-history text-secondary me-2"></i>
                    {t('rentalDetails.historyTitle')}
                  </h5>
                  <span className="badge bg-success-subtle text-success border border-success-subtle small">
                    <i className="bi bi-broadcast me-1"></i>
                    {language === 'th' ? 'อัปเดตสด Real-Time' : 'Live Real-Time'}
                  </span>
                </div>
                <span className="badge bg-secondary-subtle text-secondary small">
                  {itemRentals.length} {language === 'th' ? 'รายการ' : 'Total Records'}
                </span>
              </div>
              <div className="card-body p-0">
                {actionTxState && (
                  <div className="p-3 border-bottom">
                    <TransactionStatus
                      status={actionTxState}
                      txHash={actionTxHash}
                      errorMessage={actionError}
                      onReset={() => setActionTxState(null)}
                    />
                  </div>
                )}

                {itemRentals.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    {t('rentalDetails.noHistory')}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 small">
                      <thead className="table-light">
                        <tr>
                          <th>{t('dashboard.tableRentalId')}</th>
                          <th>{t('common.renter')}</th>
                          <th>{language === 'th' ? 'เริ่มต้น' : 'Start'}</th>
                          <th>{language === 'th' ? 'สิ้นสุด' : 'End'}</th>
                          <th>{language === 'th' ? 'นับถอยหลัง Real-time' : 'Live Countdown'}</th>
                          <th>{t('dashboard.tableTotalPaid')}</th>
                          <th>{t('common.status')}</th>
                          <th className="text-end">{language === 'th' ? 'จัดการ' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemRentals.map((r) => {
                          const isRenter = account && r.renter && r.renter.toLowerCase() === account.toLowerCase();
                          const isRentalOwner = account && r.owner && r.owner.toLowerCase() === account.toLowerCase();
                          const canAct = (isRenter || isRentalOwner) && r.status === RENTAL_STATUS.ACTIVE;

                          return (
                            <tr key={r.rentalId}>
                              <td className="fw-bold font-monospace">#{r.rentalId}</td>
                              <td className="font-monospace">
                                <a
                                  href={`${explorerBase}/address/${r.renter}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-decoration-none text-secondary"
                                >
                                  {formatAddress(r.renter)}
                                </a>
                              </td>
                              <td className="font-monospace text-dark">{formatDateTime(r.startTime, language)}</td>
                              <td className="font-monospace text-dark">{formatDateTime(r.endTime, language)}</td>
                              <td>
                                <RentalCountdown
                                  endTime={r.endTime}
                                  startTime={r.startTime}
                                  status={r.status}
                                  compact={true}
                                />
                              </td>
                              <td className="font-monospace text-primary fw-medium">{r.totalPaidEth} ETH</td>
                              <td>
                                <RentalStatus status={r.status} />
                              </td>
                              <td className="text-end">
                                {canAct ? (
                                  <div className="d-flex justify-content-end gap-1">
                                    {isRenter && (
                                      <button
                                        onClick={() => handleReturnAction(r.rentalId)}
                                        disabled={isProcessingAction}
                                        className="btn btn-xs btn-outline-success py-0 px-2 rounded-pill"
                                        title={language === 'th' ? 'ส่งคืนทรัพย์สิน & รับเงินมัดจำคืน' : 'Return item & refund deposit'}
                                      >
                                        <i className="bi bi-arrow-return-left me-1"></i>
                                        {language === 'th' ? 'ส่งคืน' : 'Return'}
                                      </button>
                                    )}
                                    {isRenter && (
                                      <button
                                        onClick={() => openCancelModal(r.rentalId)}
                                        disabled={isProcessingAction}
                                        className="btn btn-xs btn-outline-danger py-0 px-2 rounded-pill"
                                        title={language === 'th' ? 'ส่งคำขอยกเลิกการเช่าไปยังเจ้าของ' : 'Request cancellation from owner'}
                                      >
                                        <i className="bi bi-x-circle me-1"></i>
                                        {language === 'th' ? 'ขอยกเลิก' : 'Cancel'}
                                      </button>
                                    )}
                                  </div>
                                ) : r.status === RENTAL_STATUS.CANCEL_REQUESTED ? (
                                  <span className="badge bg-warning-subtle text-warning border border-warning small">
                                    <i className="bi bi-hourglass-split me-1"></i>
                                    {language === 'th' ? 'รออนุมัติยกเลิก' : 'Cancel Pending'}
                                  </span>
                                ) : (
                                  <Link
                                    href={`/claims?id=${r.rentalId}`}
                                    className="btn btn-xs btn-outline-secondary py-0 px-2 rounded-pill text-decoration-none"
                                    title={language === 'th' ? 'ตรวจสอบสัญญา' : 'Audit'}
                                  >
                                    <i className="bi bi-search me-1"></i>
                                    {language === 'th' ? 'ตรวจสัญญา' : 'Audit'}
                                  </Link>
                                )}
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

          {/* Right Column: Pricing & Checkout Action */}
          <div className="col-lg-4">
            <div className="card shadow-sm border bg-white sticky-top" style={{ top: '80px' }}>
              <div className="card-header bg-dark text-white py-3">
                <h5 className="fw-bold mb-0">{t('rentalDetails.rateCheckout')}</h5>
              </div>

              <div className="card-body p-4">
                <div className="mb-4">
                  <span className="text-muted small d-block">{t('common.dailyRate')}:</span>
                  <div className="d-flex align-items-baseline gap-1">
                    <span className="display-6 fw-bold text-primary font-monospace">
                      {item.rentalPriceEth}
                    </span>
                    <span className="text-muted fw-semibold">{t('rentalDetails.perDay')}</span>
                  </div>
                </div>

                <div className="bg-light p-3 rounded-3 border mb-4">
                  <div className="d-flex justify-content-between small mb-2">
                    <span className="text-muted">{t('common.securityDeposit')}:</span>
                    <span className="fw-bold text-dark font-monospace">{item.depositEth} ETH</span>
                  </div>
                  <div className="d-flex justify-content-between small mb-2">
                    <span className="text-muted">{language === 'th' ? 'ความพร้อม:' : 'Availability:'}</span>
                    <RentalStatus available={item.available} />
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span className="text-muted">{language === 'th' ? 'เครือข่ายชำระเงิน:' : 'Settlement Network:'}</span>
                    <span className="badge bg-secondary-subtle text-secondary">Sepolia</span>
                  </div>
                </div>

                {/* Rental Rules Box */}
                <div className="border border-info-subtle bg-info-subtle p-3 rounded-3 mb-4 small text-secondary">
                  <h6 className="fw-bold text-dark mb-2">
                    <i className="bi bi-info-circle text-primary me-1"></i> {t('rentalDetails.termsHeader')}
                  </h6>
                  <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                    <li>&bull; {t('rentalDetails.term1')}</li>
                    <li>&bull; {t('rentalDetails.term2')}</li>
                    <li>&bull; {t('rentalDetails.term3')}</li>
                  </ul>
                </div>

                {/* Action Button */}
                <div className="d-grid gap-2">
                  {!account ? (
                    <button
                      onClick={connect}
                      className="btn btn-primary fw-bold py-2.5 d-flex align-items-center justify-content-center"
                    >
                      <i className="bi bi-wallet2 me-2"></i> {t('rentalDetails.btnConnectToRent')}
                    </button>
                  ) : !isSepolia ? (
                    <button
                      onClick={switchNetwork}
                      className="btn btn-warning fw-bold py-2.5 d-flex align-items-center justify-content-center"
                    >
                      <i className="bi bi-arrow-repeat me-2"></i> {t('rentalDetails.btnSwitchToRent')}
                    </button>
                  ) : isOwner ? (
                    <button className="btn btn-secondary py-2.5" disabled>
                      <i className="bi bi-person-check me-2"></i> {t('rentalDetails.youOwnThis')}
                    </button>
                  ) : activeRentalForUser ? (
                    <div className="d-flex flex-column gap-2">
                      {activeRentalForUser.status === RENTAL_STATUS.CANCEL_REQUESTED ? (
                        <div className="alert alert-warning py-2 px-3 small mb-1 border-warning">
                          <div className="fw-bold mb-1">
                            <i className="bi bi-hourglass-split me-1"></i>
                            {language === 'th' ? 'ส่งคำขอยกเลิกแล้ว' : 'Cancellation Requested'}
                          </div>
                          <p className="mb-0 text-muted small">
                            {language === 'th'
                              ? 'รอเจ้าของทรัพย์สินกดอนุมัติการยกเลิกและโอนยอดค่าเช่าคืนเข้าวอลเล็ต'
                              : 'Waiting for asset owner to approve cancellation and refund rental fees.'}
                          </p>
                        </div>
                      ) : (
                        <div className="alert alert-success py-2 px-3 small mb-1 border-success-subtle">
                          <div className="fw-bold mb-1">
                            <i className="bi bi-check-circle-fill text-success me-1"></i>
                            {language === 'th' ? 'คุณกำลังเช่าทรัพย์สินนี้อยู่' : 'You are currently renting this item'}
                          </div>
                          <div className="d-flex align-items-center justify-content-between mt-1">
                            <span className="text-muted small">{language === 'th' ? 'เวลานับถอยหลัง:' : 'Countdown:'}</span>
                            <RentalCountdown
                              endTime={activeRentalForUser.endTime}
                              startTime={activeRentalForUser.startTime}
                              status={activeRentalForUser.status}
                              compact={true}
                            />
                          </div>
                        </div>
                      )}

                      {activeRentalForUser.status === RENTAL_STATUS.CANCEL_REQUESTED ? (
                        <button className="btn btn-warning fw-bold py-2" disabled>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          {language === 'th' ? 'รอเจ้าของอนุมัติ & คืนเงิน' : 'Waiting Owner Approval & Refund'}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleReturnAction(activeRentalForUser.rentalId)}
                            disabled={isProcessingAction}
                            className="btn btn-success fw-bold py-2 shadow-sm"
                            title={language === 'th' ? 'ส่งคืนทรัพย์สินและรับเงินมัดจำคืน' : 'Return item and receive deposit refund'}
                          >
                            <i className="bi bi-arrow-return-left me-1"></i>
                            {language === 'th' ? 'ส่งคืนทรัพย์สิน (รับมัดจำคืน)' : 'Return Item & Refund Deposit'}
                          </button>
                          <button
                            onClick={() => openCancelModal(activeRentalForUser.rentalId)}
                            disabled={isProcessingAction}
                            className="btn btn-outline-danger fw-bold py-2"
                            title={language === 'th' ? 'ส่งคำขอยกเลิกการเช่าไปยังเจ้าของเพื่อรออนุมัติและคืนเงิน' : 'Request cancellation and await owner approval & refund'}
                          >
                            <i className="bi bi-x-circle me-1"></i>
                            {language === 'th' ? 'ขอยกเลิก (รอเจ้าของคืนเงิน)' : 'Request Cancel (Wait Owner Refund)'}
                          </button>
                        </>
                      )}
                    </div>
                  ) : !item.available ? (
                    <button className="btn btn-danger py-2.5" disabled>
                      <i className="bi bi-lock me-2"></i> {t('rentalDetails.currentlyUnavailable')}
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="btn btn-primary btn-lg fw-bold py-2.5 shadow-sm d-flex align-items-center justify-content-center"
                    >
                      <i className="bi bi-cart-plus me-2"></i> {t('rentalDetails.btnRentNow')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Checkout Modal */}
      {item && (
        <RentalModal
          item={item}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRentalSuccess={loadItemDetails}
        />
      )}

      {/* Cancellation Request Modal */}
      {showCancelModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {language === 'th' ? 'ขอยกเลิกการเช่า' : 'Request Rental Cancellation'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowCancelModal(false)}
                  disabled={isProcessingAction}
                ></button>
              </div>

              <div className="modal-body p-4">
                <div className="alert alert-warning border-warning small mb-3">
                  <div className="fw-bold mb-1">
                    <i className="bi bi-shield-lock me-1"></i>
                    {language === 'th' ? 'เงื่อนไขการยกเลิกตามระบบ:' : 'System Cancellation Policy:'}
                  </div>
                  {language === 'th'
                    ? 'เมื่อกดยืนยันคำขอ สถานะจะเปลี่ยนเป็น "รอเจ้าของอนุมัติยกเลิก" และรอทางเจ้าของทรัพย์สินกดอนุมัติเพื่อโอนเงินค่าเช่าและเงินมัดจำคืนเข้าวอลเล็ตของคุณ'
                    : 'Once submitted, the status changes to "Cancel Requested (Waiting Approval)". You must wait for the owner to approve and issue a full/partial refund back to your wallet.'}
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold text-secondary">
                    {language === 'th' ? 'สัญญาเช่าหมายเลข' : 'Rental ID'}
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm font-monospace bg-light"
                    value={`#${cancelModalRentalId}`}
                    readOnly
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold text-secondary">
                    {language === 'th' ? 'เหตุผลในการขอยกเลิก (ระบุเพื่อแจ้งเจ้าของ):' : 'Reason for Cancellation (Optional):'}
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder={
                      language === 'th'
                        ? 'เช่น เปลี่ยนแผนการใช้งาน, อุปกรณ์ไม่ตรงตามต้องการ, ต้องการขอคืนเงิน'
                        : 'e.g., Change of plans, item not as expected, requesting fee refund'
                    }
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    disabled={isProcessingAction}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCancelModal(false)}
                  disabled={isProcessingAction}
                >
                  {language === 'th' ? 'ปิด / ยกเลิกคำขอ' : 'Close'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm fw-bold px-3"
                  onClick={handleConfirmCancelRequest}
                  disabled={isProcessingAction}
                >
                  {isProcessingAction ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1"></span>
                      {language === 'th' ? 'กำลังส่งคำขอ...' : 'Submitting...'}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-check me-1"></i>
                      {language === 'th' ? 'ยืนยันส่งคำขอยกเลิก' : 'Confirm Cancellation Request'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
