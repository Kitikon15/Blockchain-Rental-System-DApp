'use client';

import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { useLanguage } from '../context/LanguageContext';
import { createRentalOnChain, parseContractError } from '../lib/contract';
import TransactionStatus from './TransactionStatus';
import ErrorMessage from './ErrorMessage';

/**
 * RentalModal component
 * Interactive checkout modal for renting an item via MetaMask and Smart Contract with i18n support:
 * - Calculates duration, rental fees, and security deposit
 * - Checks wallet balance and Sepolia connection
 * - Calls createRental on-chain with exact payable ETH value
 * - Provides live transaction status and error handling in Thai and English
 */
export default function RentalModal({
  item,
  isOpen,
  onClose,
  onRentalSuccess,
}) {
  const { account, isSepolia, balance, connect, switchNetwork } = useWallet();
  const { t, language } = useLanguage();

  const [durationDays, setDurationDays] = useState(1);
  const [txState, setTxState] = useState(null); // 'waiting_approval' | 'pending' | 'confirmed' | 'failed'
  const [txHash, setTxHash] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !item) return null;

  // Pricing calculations
  const pricePerDay = parseFloat(item.rentalPriceEth || '0');
  const deposit = parseFloat(item.depositEth || '0');
  const subtotalRental = pricePerDay * Number(durationDays || 1);
  const totalEthRequired = (subtotalRental + deposit).toFixed(6);

  // Projected end date
  const now = new Date();
  const projectedEndDate = new Date(now.getTime() + Number(durationDays || 1) * 24 * 60 * 60 * 1000);
  const locale = language === 'th' ? 'th-TH' : 'en-US';

  // Check if connected user is owner
  const isOwner = account && item.owner && account.toLowerCase() === item.owner.toLowerCase();
  const userBalance = parseFloat(balance || '0');
  const hasInsufficientBalance = account && item.isOnChain && userBalance < parseFloat(totalEthRequired);
  const hasZeroBalance = account && userBalance <= 0.00001;

  const handleDurationChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 365) {
      setDurationDays(val);
    } else if (e.target.value === '') {
      setDurationDays('');
    }
  };

  const handleConfirmRental = async (forceDemo = false) => {
    if (!account) {
      await connect();
      return;
    }
    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    if (isOwner && !forceDemo) {
      setErrorMsg(language === 'th' ? 'คุณเป็นเจ้าของทรัพย์สินนี้ จึงไม่สามารถเช่าของตนเองได้' : 'You cannot rent your own item.');
      return;
    }

    const days = parseInt(durationDays, 10);
    if (!days || days < 1) {
      setErrorMsg(language === 'th' ? 'กรุณาระบุระยะเวลาเช่าอย่างน้อย 1 วัน' : 'Please enter a valid rental duration of at least 1 day.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setTxState('waiting_approval');

    try {
      // Send transaction to Sepolia blockchain
      const { hash } = await createRentalOnChain({
        itemId: item.itemId,
        durationInDays: days,
        totalEthToPay: totalEthRequired,
        forceDemo,
      });

      setTxHash(hash);
      setTxState('pending');

      // Transaction successfully confirmed on-chain
      setTxState('confirmed');
      if (onRentalSuccess) {
        onRentalSuccess(hash);
      }
    } catch (err) {
      console.error('Rental transaction error:', err);
      const friendlyErr = parseContractError(err);
      setErrorMsg(friendlyErr);
      setTxState('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setTxState(null);
    setTxHash(null);
    setErrorMsg(null);
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content shadow-lg border-0">
            {/* Modal Header */}
            <div className="modal-header bg-dark text-white border-bottom border-secondary">
              <h5 className="modal-title fw-bold d-flex align-items-center">
                <i className="bi bi-cart-check text-info me-2"></i>
                {t('modal.title')}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="Close"
              ></button>
            </div>

            {/* Modal Body */}
            <div className="modal-body p-4">
              {/* Transaction State Banner if active */}
              {txState && (
                <TransactionStatus
                  status={txState}
                  txHash={txHash}
                  errorMessage={errorMsg}
                  onReset={handleReset}
                />
              )}

              {errorMsg && !txState && (
                <ErrorMessage error={errorMsg} onDismiss={() => setErrorMsg(null)} dismissible />
              )}

              {/* Item Info Summary */}
              <div className="card bg-light border mb-4">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <span className="badge bg-primary-subtle text-primary border small mb-1">
                        {t(`categories.${item.category}`) || item.category}
                      </span>
                      <h5 className="fw-bold text-dark mb-0">{item.name}</h5>
                    </div>
                    <span className="badge bg-secondary font-monospace">Item #{item.itemId}</span>
                  </div>
                  <p className="text-muted small mb-0">{item.description}</p>
                </div>
              </div>

              {/* Rent Duration Selector */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label htmlFor="durationDays" className="form-label fw-bold small text-dark">
                    {t('modal.durationLabel')}
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <i className="bi bi-calendar3"></i>
                    </span>
                    <input
                      type="number"
                      id="durationDays"
                      min="1"
                      max="365"
                      className="form-control"
                      value={durationDays}
                      onChange={handleDurationChange}
                      disabled={isSubmitting}
                    />
                    <span className="input-group-text bg-white">{t('common.days')}</span>
                  </div>
                  <div className="form-text small">{t('modal.durationHelp')}</div>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold small text-dark">{t('modal.scheduleLabel')}</label>
                  <div className="bg-white border rounded p-2 small">
                    <div className="text-muted">{t('modal.scheduleStart')} <span className="text-dark fw-medium">{now.toLocaleDateString(locale)}</span></div>
                    <div className="text-muted">{t('modal.scheduleEnd')} <span className="text-dark fw-medium">{projectedEndDate.toLocaleDateString(locale)}</span></div>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="card border-info-subtle bg-info-subtle mb-4">
                <div className="card-body py-3">
                  <h6 className="fw-bold text-dark mb-3">{t('modal.paymentBreakdown')}</h6>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-muted">
                      {t('modal.rentalFee')} ({item.rentalPriceEth} ETH x {durationDays || 0} {t('common.days')}):
                    </span>
                    <span className="font-monospace text-dark">{subtotalRental.toFixed(6)} ETH</span>
                  </div>
                  <div className="d-flex justify-content-between small mb-2">
                    <span className="text-muted">{t('modal.refundableDeposit')}</span>
                    <span className="font-monospace text-dark">{item.depositEth} ETH</span>
                  </div>
                  <div className="d-flex justify-content-between border-top border-secondary-subtle pt-2 fw-bold">
                    <span className="text-dark">{t('modal.totalEth')}</span>
                    <span className="font-monospace fs-5 text-primary">{totalEthRequired} ETH</span>
                  </div>
                  <div className="small text-muted mt-2">
                    <i className="bi bi-shield-check text-success me-1"></i>
                    {t('modal.depositDisclaimer')}
                  </div>
                </div>
              </div>

              {/* Warnings and Status checks */}
              {isOwner && (
                <div className="alert alert-warning small mb-0 py-2">
                  <div className="fw-bold mb-1">
                    <i className="bi bi-person-badge me-1"></i>
                    {language === 'th' ? 'คุณเป็นเจ้าของทรัพย์สินนี้' : 'You own this item'}
                  </div>
                  <div className="text-secondary mb-2">
                    {language === 'th'
                      ? 'ตามกฎของ Smart Contract เจ้าของจะไม่สามารถเช่าของตนเองบนบล็อกเชนได้ (สามารถสลับไปที่ Account 2 ใน MetaMask เพื่อเช่าจริง หรือกดปุ่มด้านล่างเพื่อทดสอบจำลองได้ทันที)'
                      : 'By smart contract rules, owners cannot rent their own item on-chain. Switch to Account 2 in MetaMask or click below to test in demo mode.'}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary fw-bold"
                    onClick={() => handleConfirmRental(true)}
                    disabled={isSubmitting}
                  >
                    <i className="bi bi-play-circle me-1"></i>
                    {language === 'th' ? 'ทดสอบเช่ารายการนี้ (Demo Rental)' : 'Test Rent in Demo Mode'}
                  </button>
                </div>
              )}

              {hasInsufficientBalance && !isOwner && (
                <div className="alert alert-warning small mb-0 py-2">
                  <div className="fw-bold mb-1">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {t('modal.insufficientBalance')}
                  </div>
                  <div className="text-secondary mb-2">
                    {language === 'th'
                      ? 'ยอดเหรียญในกระเป๋าของคุณน้อยกว่าค่าเช่า แต่คุณสามารถกดทดสอบเช่าแบบจำลองได้ครับ'
                      : 'Wallet balance is lower than total price, but you can test rent in demo mode.'}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary fw-bold"
                    onClick={() => handleConfirmRental(true)}
                    disabled={isSubmitting}
                  >
                    <i className="bi bi-play-circle me-1"></i>
                    {language === 'th' ? 'ทดสอบเช่า (Demo Rental)' : 'Test Rent in Demo Mode'}
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer bg-light border-top">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {t('common.close')}
              </button>

              {!account ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={connect}
                >
                  <i className="bi bi-wallet2 me-1"></i> {t('rentalDetails.btnConnectToRent')}
                </button>
              ) : !isSepolia ? (
                <button
                  type="button"
                  className="btn btn-warning fw-bold"
                  onClick={switchNetwork}
                >
                  <i className="bi bi-arrow-repeat me-1"></i> {t('rentalDetails.btnSwitchToRent')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary fw-bold px-4"
                  onClick={() => handleConfirmRental(false)}
                  disabled={isSubmitting || isOwner || hasInsufficientBalance || txState === 'confirmed'}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      {t('common.submitting')}
                    </>
                  ) : txState === 'confirmed' ? (
                    <>
                      <i className="bi bi-check-circle me-1"></i> {t('modal.btnRentalConfirmed')}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-shield-lock me-1"></i> {t('modal.btnConfirmPay')} {totalEthRequired} ETH
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}
