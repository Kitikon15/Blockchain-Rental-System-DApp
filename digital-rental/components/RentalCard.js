'use client';

import Link from 'next/link';
import RentalStatus from './RentalStatus';
import { formatAddress } from '../lib/wallet';
import { RENTAL_STATUS, DEFAULT_EXPLORER_URL } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';

/**
 * RentalCard component
 * Displays active or historical rental agreement with timeline, financials,
 * and smart contract actions (e.g. Return Item) with i18n support.
 */
export default function RentalCard({
  rental,
  itemName = null,
  isCurrentUserRenter = false,
  onReturn = null,
  onCancel = null,
}) {
  const { t, language } = useLanguage();

  if (!rental) return null;

  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  // Format Unix timestamps safely based on locale
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const startDateStr = rental.startTime
    ? new Date(rental.startTime * 1000).toLocaleString(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'N/A';

  const endDateStr = rental.endTime
    ? new Date(rental.endTime * 1000).toLocaleString(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'N/A';

  // Check if expired
  const nowUnix = Math.floor(Date.now() / 1000);
  const isOverdue = rental.status === RENTAL_STATUS.ACTIVE && rental.endTime < nowUnix;

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
        <h5 className="card-title fw-bold text-dark mb-3">
          {itemName ? itemName : language === 'th' ? `สัญญาเช่า #${rental.rentalId}` : `Rental Agreement #${rental.rentalId}`}
        </h5>

        {/* Timeline */}
        <div className="border rounded p-2.5 bg-light mb-3">
          <div className="row g-2 small">
            <div className="col-6">
              <span className="text-muted d-block">{language === 'th' ? 'เริ่มเช่า:' : 'Start Time:'}</span>
              <span className="fw-medium text-dark">{startDateStr}</span>
            </div>
            <div className="col-6">
              <span className="text-muted d-block">{language === 'th' ? 'ครบกำหนด:' : 'End Time:'}</span>
              <span className={`fw-medium ${isOverdue ? 'text-danger' : 'text-dark'}`}>
                {endDateStr} {isOverdue && `(${language === 'th' ? 'เกินกำหนด' : 'Expired'})`}
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
              {language === 'th' ? 'เงินมัดจำที่จะได้คืน:' : 'Refundable Deposit:'}
            </span>
            <span className="text-success font-monospace">{rental.depositEth} ETH</span>
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

        {/* Action Controls */}
        <div className="d-flex flex-wrap gap-2 pt-2 border-top">
          <Link
            href={`/rentals/${rental.itemId}`}
            className="btn btn-outline-secondary btn-sm flex-grow-1"
          >
            <i className="bi bi-info-circle me-1"></i> {language === 'th' ? 'ดูสเปก' : 'Item Specs'}
          </Link>

          {isCurrentUserRenter && rental.status === RENTAL_STATUS.ACTIVE && onReturn && (
            <button
              onClick={() => onReturn(rental)}
              className="btn btn-success btn-sm flex-grow-1 fw-medium"
              title="Return item and trigger automatic deposit refund"
            >
              <i className="bi bi-arrow-return-left me-1"></i> {language === 'th' ? 'ส่งคืนทรัพย์สิน' : 'Return Item'}
            </button>
          )}

          {rental.status === RENTAL_STATUS.PENDING && onCancel && (
            <button
              onClick={() => onCancel(rental)}
              className="btn btn-outline-danger btn-sm"
              title="Cancel pending rental agreement"
            >
              <i className="bi bi-x-circle me-1"></i> {t('common.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
