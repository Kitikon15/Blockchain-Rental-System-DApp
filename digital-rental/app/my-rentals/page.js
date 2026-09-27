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
  isContractConfigured,
  parseContractError,
} from '../../lib/contract';
import { RENTAL_STATUS, DEFAULT_EXPLORER_URL } from '../../lib/constants';
import RentalCard from '../../components/RentalCard';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import TransactionStatus from '../../components/TransactionStatus';
import RentalStatus from '../../components/RentalStatus';
import { formatAddress } from '../../lib/wallet';

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

  useEffect(() => {
    loadUserRentals();
  }, [loadUserRentals]);

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

        <button
          onClick={loadUserRentals}
          disabled={loading || !account}
          className="btn btn-outline-secondary btn-sm d-flex align-items-center"
        >
          <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>
          {t('myRentals.refreshBtn')}
        </button>
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
                      />
                    </div>
                  );
                })}
              </div>

              {/* Completed / History Table Ledger */}
              {(statusFilter === 'RETURNED' || statusFilter === 'ALL') && completedRentals.length > 0 && (
                <div className="card shadow-sm border bg-white rounded-4 mb-4 overflow-hidden">
                  <div className="card-header bg-light py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                      <h6 className="fw-bold text-dark mb-0 d-flex align-items-center">
                        <i className="bi bi-clock-history text-success me-2 fs-5"></i>
                        {language === 'th'
                          ? 'ประวัติการเช่าและการคืนเงินมัดจำที่เสร็จสิ้นแล้ว (Settled Rental History)'
                          : 'Settled Rental & Deposit Refund Ledger'}
                      </h6>
                      <span className="text-muted small">
                        {language === 'th'
                          ? 'บันทึกสัญญาเช่าที่ส่งคืนของและได้รับเงินมัดจำคืนกลับเข้ากระเป๋าเรียบร้อยแล้วบน Sepolia'
                          : 'Rental agreements returned and deposits refunded to your wallet on Sepolia'}
                      </span>
                    </div>
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1.5 rounded-pill small">
                      <i className="bi bi-shield-check me-1"></i>
                      {language === 'th' ? `เสร็จสมบูรณ์ ${completedRentals.length} รายการ` : `${completedRentals.length} Settled Records`}
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 small">
                      <thead className="table-light">
                        <tr>
                          <th>{language === 'th' ? 'รหัสสัญญา' : 'Rental ID'}</th>
                          <th>{language === 'th' ? 'ทรัพย์สิน' : 'Asset'}</th>
                          <th>{language === 'th' ? 'เจ้าของ' : 'Owner'}</th>
                          <th>{language === 'th' ? 'ระยะเวลาเช่า' : 'Rental Period'}</th>
                          <th>{language === 'th' ? 'ค่าเช่าที่จ่าย' : 'Fee Paid'}</th>
                          <th>{language === 'th' ? 'เงินมัดจำที่ได้คืน' : 'Deposit Refunded'}</th>
                          <th>{language === 'th' ? 'สถานะ' : 'Status'}</th>
                          <th className="text-end">{language === 'th' ? 'ตรวจสอบ' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completedRentals.map((r) => {
                          const item = itemsMap[r.itemId];
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
                              <td className="text-muted">
                                {new Date(r.startTime * 1000).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')} -{' '}
                                {new Date(r.endTime * 1000).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')}
                              </td>
                              <td className="font-monospace text-primary fw-medium">
                                {r.rentalPriceEth} ETH
                              </td>
                              <td className="font-monospace text-success fw-bold">
                                +{r.depositEth} ETH
                              </td>
                              <td>
                                <span className="badge bg-success-subtle text-success border border-success-subtle py-1 px-2">
                                  <i className="bi bi-check2-circle me-1"></i>
                                  {language === 'th' ? 'คืนของ & คืนมัดจำแล้ว' : 'Returned & Refunded'}
                                </span>
                              </td>
                              <td className="text-end">
                                <Link href={`/rentals/${r.itemId}`} className="btn btn-xs btn-outline-secondary py-1 px-2.5 rounded-pill">
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
                        {language === 'th' ? 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกสัญญาเช่า' : 'Are you sure you want to cancel'}{' '}
                        <strong>#{actionRental.rentalId}</strong>?
                      </p>
                      <div className="alert alert-warning small">
                        {language === 'th'
                          ? 'การยกเลิกสัญญาจะต้องได้รับการเซ็นยินยอมผ่าน MetaMask ตามเงื่อนไข Smart Contract'
                          : 'Cancellation triggers smart contract settlement logic. Please confirm in MetaMask.'}
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
                        <i className="bi bi-x-circle me-1"></i> {t('myRentals.btnConfirmCancel')}
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
