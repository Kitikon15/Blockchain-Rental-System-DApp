'use client';

import Link from 'next/link';
import RentalStatus from './RentalStatus';
import { formatAddress } from '../lib/wallet';
import { CATEGORY_ICONS, DEFAULT_EXPLORER_URL, RENTAL_STATUS } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';

/**
 * ItemCard component
 * Renders individual rentable item with pricing, availability, owner details,
 * and navigation to the detailed rental page with i18n support.
 */
export default function ItemCard({ item, onRentClick = null, userRental = null }) {
  const { t, language } = useLanguage();

  if (!item) return null;

  const categoryIcon = CATEGORY_ICONS[item.category] || 'bi-box-seam';
  const categoryLabel = t(`categories.${item.category}`) || item.category || (language === 'th' ? 'ทั่วไป' : 'General');
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  const isRentedByCurrentUser = Boolean(userRental);
  const isPendingCancel = userRental && userRental.status === RENTAL_STATUS.CANCEL_REQUESTED;

  return (
    <div
      className={`card h-100 card-hover shadow-sm bg-white ${
        isPendingCancel
          ? 'border-warning border-2'
          : isRentedByCurrentUser
          ? 'border-success border-2'
          : 'border'
      }`}
    >
      {/* Card Header with Category and Item ID */}
      <div className="card-header bg-transparent border-bottom-0 pt-3 pb-0 d-flex justify-content-between align-items-center">
        <span className="badge bg-light text-primary border small text-truncate" style={{ maxWidth: '65%' }}>
          <i className={`bi ${categoryIcon} me-1`}></i>
          {categoryLabel}
        </span>
        <div className="d-flex align-items-center gap-1">
          {isRentedByCurrentUser && (
            <span
              className={`badge ${
                isPendingCancel ? 'bg-warning text-dark' : 'bg-success text-white'
              } small`}
              title={
                isPendingCancel
                  ? language === 'th' ? 'ส่งคำขอยกเลิกแล้ว รอเจ้าของอนุมัติและคืนเงิน' : 'Cancellation pending owner approval'
                  : language === 'th' ? 'คุณกำลังเช่าทรัพย์สินชิ้นนี้อยู่' : 'You are currently renting this'
              }
            >
              <i
                className={`bi ${
                  isPendingCancel ? 'bi-hourglass-split' : 'bi-check-circle-fill'
                } me-1`}
              ></i>
              {isPendingCancel
                ? (language === 'th' ? 'รออนุมัติยกเลิก' : 'Cancel Pending')
                : (language === 'th' ? 'คุณเช่าอยู่นี้' : 'Rented by You')}
            </span>
          )}
          <span className="badge bg-secondary-subtle text-secondary font-monospace small">
            #{item.itemId}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="card-body d-flex flex-column pt-2">
        <div className="mb-2">
          <RentalStatus available={item.available} />
        </div>

        <h5 className="card-title fw-bold text-dark text-truncate mb-2" title={item.name}>
          {item.name}
        </h5>

        <p className="card-text text-muted small flex-grow-1 mb-3" style={{ minHeight: '40px' }}>
          {item.description && item.description.length > 95
            ? `${item.description.substring(0, 95)}...`
            : item.description || (language === 'th' ? 'ไม่มีคำอธิบายเพิ่มเติม' : 'No detailed description provided.')}
        </p>

        {/* Pricing Highlight */}
        <div className="bg-light p-2.5 rounded-3 mb-3 border">
          <div className="d-flex justify-content-between align-items-baseline mb-1">
            <span className="text-muted small">{t('common.dailyRate')}:</span>
            <span className="fw-bold text-primary fs-6 font-monospace">
              {item.rentalPriceEth} ETH
            </span>
          </div>
          <div className="d-flex justify-content-between align-items-baseline">
            <span className="text-muted small">{t('common.securityDeposit')}:</span>
            <span className="text-secondary small font-monospace">
              {item.depositEth} ETH
            </span>
          </div>
        </div>

        {/* Owner Info */}
        <div className="d-flex justify-content-between align-items-center text-muted small mb-3">
          <span>{t('common.owner')}:</span>
          <a
            href={`${explorerBase}/address/${item.owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none font-monospace text-secondary"
            title="View owner on Sepolia Etherscan"
          >
            {formatAddress(item.owner)} <i className="bi bi-box-arrow-up-right small"></i>
          </a>
        </div>

        {/* Actions */}
        <div className="d-grid gap-2">
          {isRentedByCurrentUser ? (
            <Link
              href={`/rentals/${item.itemId}`}
              className={`btn ${
                isPendingCancel ? 'btn-outline-warning text-dark' : 'btn-outline-success'
              } btn-sm fw-bold d-flex align-items-center justify-content-center`}
            >
              <i
                className={`bi ${
                  isPendingCancel ? 'bi-hourglass-split' : 'bi-patch-check-fill'
                } me-1.5`}
              ></i>
              {isPendingCancel
                ? (language === 'th' ? 'ดูสถานะการขอยกเลิก' : 'View Cancel Status')
                : (language === 'th' ? 'ดูข้อมูลการเช่าของคุณ' : 'View Your Rental Info')}
            </Link>
          ) : (
            <>
              <Link
                href={`/rentals/${item.itemId}`}
                className="btn btn-outline-primary btn-sm fw-medium d-flex align-items-center justify-content-center"
              >
                <i className="bi bi-eye me-1.5"></i> {t('rentals.viewDetailsRent')}
              </Link>
              {onRentClick && item.available && (
                <button
                  onClick={() => onRentClick(item)}
                  className="btn btn-primary btn-sm fw-medium d-flex align-items-center justify-content-center"
                >
                  <i className="bi bi-cart-plus me-1.5"></i> {t('rentals.rentNow')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
