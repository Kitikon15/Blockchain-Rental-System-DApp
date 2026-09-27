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
  isContractConfigured,
  parseContractError,
} from '../../../lib/contract';
import { formatAddress } from '../../../lib/wallet';
import { DEFAULT_EXPLORER_URL, CATEGORY_ICONS } from '../../../lib/constants';
import RentalStatus from '../../../components/RentalStatus';
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

  const loadItemDetails = useCallback(async () => {
    if (!contractConfigured || !itemId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
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
  }, [loadItemDetails]);

  // Check ownership
  const isOwner =
    account && item?.owner && account.toLowerCase() === item.owner.toLowerCase();

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
                <h5 className="fw-bold text-dark mb-0">
                  <i className="bi bi-clock-history text-secondary me-2"></i>
                  {t('rentalDetails.historyTitle')}
                </h5>
                <span className="badge bg-secondary-subtle text-secondary small">
                  {itemRentals.length} {language === 'th' ? 'รายการ' : 'Total Records'}
                </span>
              </div>
              <div className="card-body p-0">
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
                          <th>{t('dashboard.tableTotalPaid')}</th>
                          <th>{t('common.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemRentals.map((r) => (
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
                            <td>{new Date(r.startTime * 1000).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')}</td>
                            <td>{new Date(r.endTime * 1000).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')}</td>
                            <td className="font-monospace text-primary fw-medium">{r.totalPaidEth} ETH</td>
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
    </div>
  );
}
