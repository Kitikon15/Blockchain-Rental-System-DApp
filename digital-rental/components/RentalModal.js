'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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

  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState('days'); // 'days' | 'hours' | 'minutes'
  const [currentNow, setCurrentNow] = useState(() => new Date());
  const [txState, setTxState] = useState(null); // 'waiting_approval' | 'pending' | 'confirmed' | 'failed'
  const [txHash, setTxHash] = useState(null);
  const [confirmedRentalId, setConfirmedRentalId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live timer for real-time schedule preview
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen || !item) return null;

  // Pricing calculations - Starts with minimum 0.05 Sepolia ETH deduction as requested
  const MIN_STARTING_ETH = 0.05;
  const pricePerDay = Math.max(0.05, parseFloat(item.rentalPriceEth || '0.05'));
  const deposit = parseFloat(item.depositEth || '0.05');
  const val = Number(durationValue || 1);

  let subtotalRental = 0;
  let durationInSeconds = 86400;

  if (durationUnit === 'minutes') {
    durationInSeconds = Math.max(10, val * 60);
    // Real-time minutes rate starting at 0.05 Sepolia ETH
    subtotalRental = Math.max(0.05, (pricePerDay / 1440) * val);
  } else if (durationUnit === 'hours') {
    durationInSeconds = Math.max(60, val * 3600);
    subtotalRental = Math.max(0.05, (pricePerDay / 24) * val);
  } else {
    durationInSeconds = Math.max(86400, val * 86400);
    subtotalRental = Math.max(0.05, pricePerDay * val);
  }

  // Ensure total ETH deducted on Sepolia is at least 0.05 Sepolia ETH
  const totalEthRequired = Math.max(MIN_STARTING_ETH, subtotalRental + deposit).toFixed(4);

  // Real-time projected end date
  const projectedEndDate = new Date(currentNow.getTime() + durationInSeconds * 1000);
  const locale = language === 'th' ? 'th-TH' : 'en-GB';

  const formatScheduleTime = (d) => {
    return d.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Check if connected user is owner
  const isOwner = account && item.owner && account.toLowerCase() === item.owner.toLowerCase();
  const userBalance = parseFloat(balance || '0');
  const hasInsufficientBalance = account && item.isOnChain && userBalance < parseFloat(totalEthRequired);
  const hasZeroBalance = account && userBalance <= 0.00001;

  const handleDurationChange = (e) => {
    const parsed = parseInt(e.target.value, 10);
    const maxVal = durationUnit === 'minutes' ? 720 : durationUnit === 'hours' ? 168 : 365;
    if (!isNaN(parsed) && parsed >= 1 && parsed <= maxVal) {
      setDurationValue(parsed);
    } else if (e.target.value === '') {
      setDurationValue('');
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

    const durationNum = parseInt(durationValue, 10);
    if (!durationNum || durationNum < 1) {
      setErrorMsg(language === 'th' ? 'กรุณาระบุระยะเวลาเช่าที่ถูกต้อง' : 'Please enter a valid rental duration.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setTxState('waiting_approval');

    try {
      // Send transaction to Sepolia blockchain with real-time seconds calculation
      const { hash, rentalId } = await createRentalOnChain({
        itemId: item.itemId,
        durationInDays: Math.max(1, Math.ceil(durationInSeconds / 86400)),
        durationValue: durationNum,
        durationUnit: durationUnit,
        durationInSeconds: durationInSeconds,
        totalEthToPay: totalEthRequired,
        forceDemo,
      });

      setTxHash(hash);
      if (rentalId) setConfirmedRentalId(rentalId);
      setTxState('pending');

      // Transaction successfully confirmed on-chain
      setTxState('confirmed');
      if (onRentalSuccess) {
        onRentalSuccess(hash, rentalId);
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
    setConfirmedRentalId(null);
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
              {/* Transaction Confirmed Rich Completion Card */}
              {txState === 'confirmed' && (
                <div className="card border-success bg-success-subtle mb-4 shadow-sm rounded-4 overflow-hidden animate__animated animate__fadeIn">
                  <div className="card-body p-4 text-center">
                    <div
                      className="rounded-circle bg-success text-white mx-auto mb-3 d-flex align-items-center justify-content-center shadow"
                      style={{ width: '56px', height: '56px' }}
                    >
                      <i className="bi bi-check-lg fs-2"></i>
                    </div>

                    <h4 className="fw-bold text-success-emphasis mb-1">
                      {language === 'th' ? '🎉 ทำสัญญาเช่าบนบล็อกเชนสำเร็จ!' : '🎉 Rental Agreement Confirmed!'}
                    </h4>

                    <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
                      <span className="badge bg-dark font-monospace px-2.5 py-1.5 fs-6">
                        {language === 'th'
                          ? `สัญญาเช่า #${confirmedRentalId || item.itemId}`
                          : `Agreement #${confirmedRentalId || item.itemId}`}
                      </span>
                      <span className="badge bg-success font-monospace px-2.5 py-1.5 fs-6">
                        {language === 'th' ? 'บันทึกบน Sepolia แล้ว' : 'Recorded on Sepolia'}
                      </span>
                    </div>

                    <p className="text-secondary small mb-4" style={{ maxWidth: '520px', margin: '0 auto' }}>
                      {language === 'th'
                        ? 'สัญญาเช่าและเงินมัดจำความเสียหายของคุณได้รับการบันทึกบน Smart Contract เรียบร้อยแล้ว ระบบเริ่มนับเวลาเช่าแบบ Real-time ทันที คุณสามารถตรวจสอบสัญญาเช่าหรือเข้าดูรายการที่กำลังเช่าอยู่ได้ทันที:'
                        : 'Your lease agreement and escrow deposit are confirmed on Ethereum Sepolia. Real-time timer is ticking. You can inspect the contract or manage your active lease immediately:'}
                    </p>

                    <div className="d-flex flex-column flex-sm-row justify-content-center gap-2">
                      <Link
                        href={`/claims?id=${confirmedRentalId || item.itemId}`}
                        className="btn btn-info text-white fw-bold px-3 py-2 rounded-3 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                        onClick={onClose}
                      >
                        <i className="bi bi-search"></i>
                        {language === 'th'
                          ? '🔍 ตรวจสอบสัญญาเช่าทันที (Audit Claims)'
                          : '🔍 Audit Agreement Now'}
                      </Link>

                      <Link
                        href="/my-rentals?status=ACTIVE"
                        className="btn btn-primary fw-bold px-3 py-2 rounded-3 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                        onClick={onClose}
                      >
                        <i className="bi bi-box-seam"></i>
                        {language === 'th'
                          ? '📦 ดูรายการที่กำลังเช่าอยู่ (My Rentals)'
                          : '📦 View Active Rentals'}
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction State Banner if active */}
              {txState && txState !== 'confirmed' && (
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

              {/* Rent Duration Selector (Real-Time Mode Selection) */}
              <div className="card border mb-4 p-3 bg-light rounded-3">
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">
                  <label className="form-label fw-bold small text-dark mb-0">
                    <i className="bi bi-clock-history text-primary me-1"></i>
                    {language === 'th' ? 'เลือกระยะเวลาเช่า (รองรับ Real-time Demo)' : 'Rental Duration (Real-time Supported)'}
                  </label>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                    <i className="bi bi-broadcast me-1"></i>
                    {language === 'th' ? 'คำนวณสด Real-time' : 'Live Real-time'}
                  </span>
                </div>

                {/* Duration Unit Selector Buttons */}
                <div className="btn-group w-100 mb-3" role="group">
                  <button
                    type="button"
                    className={`btn btn-sm ${durationUnit === 'minutes' ? 'btn-primary fw-bold' : 'btn-outline-secondary bg-white'}`}
                    onClick={() => {
                      setDurationUnit('minutes');
                      if (durationValue > 60) setDurationValue(5);
                    }}
                    disabled={isSubmitting}
                  >
                    <i className="bi bi-lightning-charge-fill me-1 text-warning"></i>
                    {language === 'th' ? 'นาที (ทดสอบ Real-time Demo)' : 'Minutes (Demo Real-time)'}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${durationUnit === 'hours' ? 'btn-primary fw-bold' : 'btn-outline-secondary bg-white'}`}
                    onClick={() => {
                      setDurationUnit('hours');
                      if (durationValue > 48) setDurationValue(2);
                    }}
                    disabled={isSubmitting}
                  >
                    <i className="bi bi-hourglass-split me-1"></i>
                    {language === 'th' ? 'ชั่วโมง' : 'Hours'}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${durationUnit === 'days' ? 'btn-primary fw-bold' : 'btn-outline-secondary bg-white'}`}
                    onClick={() => setDurationUnit('days')}
                    disabled={isSubmitting}
                  >
                    <i className="bi bi-calendar3 me-1"></i>
                    {language === 'th' ? 'วัน' : 'Days'}
                  </button>
                </div>

                <div className="row g-3">
                  <div className="col-md-5">
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <i className="bi bi-stopwatch"></i>
                      </span>
                      <input
                        type="number"
                        id="durationValue"
                        min="1"
                        max={durationUnit === 'minutes' ? 720 : durationUnit === 'hours' ? 168 : 365}
                        className="form-control fw-bold"
                        value={durationValue}
                        onChange={handleDurationChange}
                        disabled={isSubmitting}
                      />
                      <span className="input-group-text bg-white fw-medium">
                        {durationUnit === 'minutes'
                          ? language === 'th' ? 'นาที' : 'mins'
                          : durationUnit === 'hours'
                          ? language === 'th' ? 'ชั่วโมง' : 'hrs'
                          : language === 'th' ? 'วัน' : 'days'}
                      </span>
                    </div>

                    {/* Quick Demo Presets */}
                    <div className="d-flex flex-wrap gap-1 mt-2">
                      <span className="small text-muted me-1">{language === 'th' ? 'ลัด:' : 'Quick:'}</span>
                      {durationUnit === 'minutes' ? (
                        <>
                          <button type="button" onClick={() => setDurationValue(2)} className="btn btn-xs btn-outline-secondary py-0 px-1.5 rounded">2 นาที</button>
                          <button type="button" onClick={() => setDurationValue(5)} className="btn btn-xs btn-outline-secondary py-0 px-1.5 rounded">5 นาที</button>
                          <button type="button" onClick={() => setDurationValue(15)} className="btn btn-xs btn-outline-secondary py-0 px-1.5 rounded">15 นาที</button>
                        </>
                      ) : durationUnit === 'hours' ? (
                        <>
                          <button type="button" onClick={() => setDurationValue(1)} className="btn btn-xs btn-outline-secondary py-0 px-1.5 rounded">1 ชม.</button>
                          <button type="button" onClick={() => setDurationValue(4)} className="btn btn-xs btn-outline-secondary py-0 px-1.5 rounded">4 ชม.</button>
                          <button type="button" onClick={() => setDurationValue(12)} className="btn btn-xs btn-outline-secondary py-0 px-1.5 rounded">12 ชม.</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => setDurationValue(1)} className="btn btn-xs btn-outline-secondary py-0 px-1.5 rounded">1 วัน</button>
                          <button type="button" onClick={() => setDurationValue(3)} className="btn btn-xs btn-outline-secondary py-0 px-1.5 rounded">3 วัน</button>
                          <button type="button" onClick={() => setDurationValue(7)} className="btn btn-xs btn-outline-secondary py-0 px-1.5 rounded">7 วัน</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Real-time projected start and end times */}
                  <div className="col-md-7">
                    <div className="bg-white border rounded p-2.5 small shadow-xs">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="text-muted">
                          <i className="bi bi-play-circle text-success me-1"></i>
                          {language === 'th' ? 'เวลาเริ่มต้น (ปัจจุบัน):' : 'Start Timestamp:'}
                        </span>
                        <span className="font-monospace fw-semibold text-dark">
                          {formatScheduleTime(currentNow)}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">
                          <i className="bi bi-flag-fill text-danger me-1"></i>
                          {language === 'th' ? 'เวลาสิ้นสุดสัญญาเช่า:' : 'End Timestamp:'}
                        </span>
                        <span className="font-monospace fw-bold text-primary">
                          {formatScheduleTime(projectedEndDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="card border-info-subtle bg-info-subtle mb-4">
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold text-dark mb-0">{t('modal.paymentBreakdown')}</h6>
                    <span className="badge bg-primary text-white small">
                      ⚡ {language === 'th' ? 'หัก Sepolia เริ่มต้น 0.05 ETH' : 'Starting 0.05 Sepolia ETH'}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-muted">
                      {t('modal.rentalFee')} ({durationValue || 0}{' '}
                      {durationUnit === 'minutes'
                        ? language === 'th' ? 'นาที' : 'minutes'
                        : durationUnit === 'hours'
                        ? language === 'th' ? 'ชั่วโมง' : 'hours'
                        : language === 'th' ? 'วัน' : 'days'}):
                    </span>
                    <span className="font-monospace text-dark fw-semibold">{subtotalRental.toFixed(4)} ETH</span>
                  </div>
                  <div className="d-flex justify-content-between small mb-2">
                    <span className="text-muted">{t('modal.refundableDeposit')}</span>
                    <span className="font-monospace text-success fw-bold">+{item.depositEth || '0.0500'} ETH</span>
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
                      ? `ยอด Sepolia ETH ในกระเป๋าคุณมี ${userBalance.toFixed(4)} ETH ซึ่งน้อยกว่ายอดที่ต้องหักเริ่มต้น (${totalEthRequired} ETH) คุณสามารถขอเหรียญฟรีจาก Sepolia Faucet หรือกดปุ่มด้านล่างเพื่อทดสอบเช่าได้ทันที`
                      : `Your balance is ${userBalance.toFixed(4)} ETH, less than the required ${totalEthRequired} ETH. You can request testnet ETH from a Sepolia Faucet or test rent in demo mode below.`}
                  </div>
                  <div className="d-flex gap-2">
                    <a
                      href="https://sepoliafaucet.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-secondary"
                    >
                      <i className="bi bi-box-arrow-up-right me-1"></i>
                      {language === 'th' ? 'ขอเหรียญฟรี Sepolia Faucet' : 'Sepolia Faucet'}
                    </a>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary fw-bold"
                      onClick={() => handleConfirmRental(true)}
                      disabled={isSubmitting}
                    >
                      <i className="bi bi-play-circle me-1"></i>
                      {language === 'th' ? 'ทดสอบเช่า (Demo Mode)' : 'Test Rent in Demo Mode'}
                    </button>
                  </div>
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
