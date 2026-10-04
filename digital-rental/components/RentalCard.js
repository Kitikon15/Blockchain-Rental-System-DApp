'use client';

import Link from 'next/link';
import RentalStatus from './RentalStatus';
import RentalCountdown from './RentalCountdown';
import { formatAddress, formatDateTime } from '../lib/wallet';
import { RENTAL_STATUS, DEFAULT_EXPLORER_URL } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';

/**
 * RentalCard component
 * Displays active or historical rental agreement with real-time countdown, timeline, financials,
 * and smart contract actions (Return Item & Cancel Rental with Deposit Refund) with i18n support.
 */
export default function RentalCard({
  rental,
  itemName = null,
  isCurrentUserRenter = false,
  onReturn = null,
  onCancel = null,
  onExtend = null,
}) {
  const { t, language } = useLanguage();

  if (!rental) return null;

  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  // Format Unix timestamps safely in real-time
  const startDateStr = formatDateTime(rental.startTime, language);
  const endDateStr = formatDateTime(rental.endTime, language);

  return (
    <div className="card h-100 shadow-sm border bg-white card-hover">
      {/* Header: Agreement ID & Status */}
      <div className="card-header bg-light d-flex justify-content-between align-items-center py-2.5">
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-dark font-monospace">
            {language === 'th' ? `สัญญา #${rental.rentalId}` : `Rental #${rental.rentalId}`}
          </span>
          <span className="text-muted small">
            {language === 'th' ? `ของ #${rental.itemId}` : `Item #${rental.itemId}`}
          </span>
        </div>
        <RentalStatus status={rental.status} />
      </div>

      {/* Body: Details */}
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h5 className="card-title fw-bold text-dark mb-0">
            {itemName ? itemName : language === 'th' ? `สัญญาเช่า #${rental.rentalId}` : `Rental Agreement #${rental.rentalId}`}
          </h5>
        </div>

        {/* Real-time Countdown Banner */}
        <div className="mb-3 d-flex align-items-center justify-content-between bg-light p-2 rounded border">
          <span className="small text-muted fw-semibold">
            <i className="bi bi-broadcast text-primary me-1"></i>
            {language === 'th' ? 'สถานะ Real-time:' : 'Live Status:'}
          </span>
          <RentalCountdown
            endTime={rental.endTime}
            startTime={rental.startTime}
            status={rental.status}
            compact={false}
          />
        </div>

        {/* Timeline with exact Date and Time */}
        <div className="border rounded p-2.5 bg-light mb-3">
          <div className="row g-2 small">
            <div className="col-6">
              <span className="text-muted d-block">{language === 'th' ? 'เริ่มต้น:' : 'Start Time:'}</span>
              <span className="fw-medium font-monospace text-dark">
                {rental.status === RENTAL_STATUS.PENDING
                  ? (language === 'th' ? 'รอเจ้าของอนุมัติ' : 'Awaiting Approval')
                  : (rental.startTime ? startDateStr : '-')}
              </span>
            </div>
            <div className="col-6">
              <span className="text-muted d-block">{language === 'th' ? 'สิ้นสุด:' : 'End Time:'}</span>
              <span className="fw-medium font-monospace text-dark">
                {rental.status === RENTAL_STATUS.PENDING
                  ? `${rental.durationValue || 1} ${rental.durationUnit || 'days'}`
                  : (rental.endTime ? endDateStr : '-')}
              </span>
            </div>
          </div>
        </div>

        {/* Financials Breakdown */}
        <div className="bg-light p-2.5 rounded mb-3 border">
          <div className="d-flex justify-content-between small mb-1">
            <span className="text-muted">
              {language === 'th' ? 'ยอดชำระรวม (ค่าเช่า+มัดจำ):' : 'Total Paid (Fee + Deposit):'}
            </span>
            <span className="fw-bold text-primary font-monospace">{rental.totalPaidEth} ETH</span>
          </div>
          <div className="d-flex justify-content-between small">
            <span className="text-muted">
              {rental.status === RENTAL_STATUS.CANCELLED || rental.status === RENTAL_STATUS.RETURNED
                ? (language === 'th' ? 'เงินมัดจำที่ได้คืนแล้ว:' : 'Refunded Deposit:')
                : (language === 'th' ? 'เงินมัดจำ (ได้คืนเมื่อส่งของ/ยกเลิก):' : 'Refundable Deposit:')}
            </span>
            <span className="text-success font-monospace fw-bold">+{rental.depositEth} ETH</span>
          </div>
        </div>

        {/* Addresses */}
        <div className="small text-muted mb-3 flex-grow-1">
          <div className="d-flex justify-content-between mb-1">
            <span>{t('common.owner')}:</span>
            <a
              href={`${explorerBase}/address/${rental.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none font-monospace text-secondary"
            >
              {formatAddress(rental.owner)} <i className="bi bi-box-arrow-up-right small"></i>
            </a>
          </div>
          <div className="d-flex justify-content-between">
            <span>{t('common.renter')}:</span>
            <a
              href={`${explorerBase}/address/${rental.renter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none font-monospace text-secondary"
            >
              {formatAddress(rental.renter)} <i className="bi bi-box-arrow-up-right small"></i>
            </a>
          </div>
        </div>

        {/* Pending Approval Notice */}
        {rental.status === RENTAL_STATUS.PENDING && (
          <div className="alert alert-warning py-2 px-2.5 small mb-3 border-warning">
            <div className="d-flex align-items-center mb-1">
              <i className="bi bi-clock-history text-warning me-1.5 fs-6"></i>
              <strong className="text-dark">
                {language === 'th' ? 'คำขอเช่าอยู่ระหว่างรอเจ้าของอนุมัติ' : 'Rental Request Pending Owner Approval'}
              </strong>
            </div>
            <p className="mb-0 text-muted" style={{ fontSize: '0.82rem' }}>
              {language === 'th'
                ? `คำขอเช่าได้ถูกส่งไปยังเจ้าของอุปกรณ์ (${formatAddress(rental.owner)}) เรียบร้อยแล้ว ยอดชำระ ${rental.totalPaidEth} ETH ถูกพักไว้ในระบบอย่างปลอดภัย เมื่อเจ้าของกดอนุมัติ ระบบจะเริ่มนับเวลาการเช่าทันที`
                : `Rental request submitted to owner (${formatAddress(rental.owner)}). ${rental.totalPaidEth} ETH is held safely in escrow. Timer starts automatically once approved.`}
            </p>
          </div>
        )}

        {/* Cancellation Request Notice */}
        {rental.status === RENTAL_STATUS.CANCEL_REQUESTED && (
          <div className="alert alert-warning py-2 px-2.5 small mb-3 border-warning">
            <div className="d-flex align-items-center mb-1">
              <i className="bi bi-hourglass-split text-warning me-1.5 fs-6"></i>
              <strong className="text-dark">
                {language === 'th' ? 'ส่งคำขอยกเลิกสัญญาแล้ว' : 'Cancellation Request Submitted'}
              </strong>
            </div>
            <p className="mb-0 text-muted" style={{ fontSize: '0.82rem' }}>
              {language === 'th'
                ? `กำลังรอเจ้าของทรัพย์สิน (${formatAddress(rental.owner)}) กดอนุมัติการยกเลิกและโอนคืนเงินค่าเช่า/มัดจำ (${rental.totalPaidEth || rental.depositEth} ETH) กลับเข้ากระเป๋าของคุณ`
                : `Awaiting owner (${formatAddress(rental.owner)}) approval to confirm cancellation and refund ${rental.totalPaidEth || rental.depositEth} ETH to your wallet.`}
            </p>
          </div>
        )}

        {/* Cancelled & Refunded Notice */}
        {rental.status === RENTAL_STATUS.CANCELLED && (
          <div className="alert alert-secondary py-2 px-2.5 small mb-3 bg-light border">
            <div className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold text-dark">
                <i className="bi bi-check-circle-fill text-success me-1"></i>
                {language === 'th' ? 'ยกเลิกสัญญาและคืนเงินแล้ว' : 'Cancelled & Refunded'}
              </span>
              <span className="fw-bold font-monospace text-success">
                +{rental.refundAmountEth || rental.totalPaidEth || rental.depositEth} ETH
              </span>
            </div>
            {rental.refundTxHash && (
              <div className="mt-1 pt-1 border-top border-secondary-subtle">
                <a
                  href={`${explorerBase}/tx/${rental.refundTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-none small font-monospace text-primary"
                >
                  <i className="bi bi-receipt me-1"></i>
                  {language === 'th' ? 'ดูหลักฐานการโอนคืนบน Etherscan' : 'View refund transaction on Etherscan'} <i className="bi bi-box-arrow-up-right small"></i>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="d-flex flex-wrap gap-2 pt-2 border-top">
          <Link
            href={`/rentals/${rental.itemId}`}
            className="btn btn-outline-secondary btn-sm"
          >
            <i className="bi bi-info-circle me-1"></i> {language === 'th' ? 'สเปก' : 'Specs'}
          </Link>

          <Link
            href={`/claims?id=${rental.rentalId}`}
            className="btn btn-outline-info btn-sm"
            title={language === 'th' ? 'ตรวจสอบสัญญาบนบล็อกเชน' : 'Audit Agreement on Sepolia'}
          >
            <i className="bi bi-search me-1"></i> {language === 'th' ? 'ตรวจสัญญา' : 'Audit'}
          </Link>

          {isCurrentUserRenter && rental.status === RENTAL_STATUS.ACTIVE && (
            <>
              {onExtend && (
                <button
                  onClick={() => onExtend(rental)}
                  className="btn btn-primary btn-sm flex-grow-1 fw-medium"
                  title={language === 'th' ? 'ต่ออายุระยะเวลาสัญญาเช่า' : 'Extend rental duration'}
                >
                  <i className="bi bi-clock-history me-1"></i> {language === 'th' ? 'ต่ออายุเช่า' : 'Extend'}
                </button>
              )}

              {onReturn && (
                <button
                  onClick={() => onReturn(rental)}
                  className="btn btn-success btn-sm flex-grow-1 fw-medium"
                  title={language === 'th' ? 'ส่งคืนทรัพย์สินและรับเงินมัดจำคืน' : 'Return item and receive deposit refund'}
                >
                  <i className="bi bi-arrow-return-left me-1"></i> {language === 'th' ? 'ส่งคืนของ' : 'Return'}
                </button>
              )}

              {onCancel && (
                <button
                  onClick={() => onCancel(rental)}
                  className="btn btn-outline-danger btn-sm flex-grow-1 fw-medium"
                  title={language === 'th' ? 'ส่งคำขอยกเลิกสัญญาเช่าและรอเจ้าของอนุมัติคืนเงิน' : 'Request cancellation and await owner approval & refund'}
                >
                  <i className="bi bi-x-circle me-1"></i> {language === 'th' ? 'ขอยกเลิก (รอเจ้าของอนุมัติ)' : 'Request Cancel'}
                </button>
              )}
            </>
          )}

          {isCurrentUserRenter && rental.status === RENTAL_STATUS.CANCEL_REQUESTED && (
            <button
              disabled
              className="btn btn-warning-subtle text-warning-emphasis border border-warning-subtle btn-sm flex-grow-1 fw-medium"
              title={language === 'th' ? 'ส่งคำขอแล้ว รอเจ้าของอนุมัติและโอนเงินคืน' : 'Cancellation requested, awaiting owner refund'}
            >
              <i className="bi bi-hourglass-split me-1"></i>
              {language === 'th' ? 'รอเจ้าของอนุมัติ & คืนเงิน' : 'Awaiting Approval & Refund'}
            </button>
          )}

          {rental.status === RENTAL_STATUS.PENDING && onCancel && (
            <button
              onClick={() => onCancel(rental)}
              className="btn btn-outline-danger btn-sm flex-grow-1"
              title="Cancel pending rental agreement"
            >
              <i className="bi bi-x-circle me-1"></i> {language === 'th' ? 'ยกเลิกการเช่า' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
