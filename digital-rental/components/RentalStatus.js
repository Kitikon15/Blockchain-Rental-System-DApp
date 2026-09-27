'use client';

import { RENTAL_STATUS } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';

/**
 * RentalStatus badge component
 * Renders semantic Bootstrap badge reflecting item or agreement status in Thai/English
 */
export default function RentalStatus({ status, available = null }) {
  const { t, language } = useLanguage();

  if (available !== null && status === undefined) {
    if (available) {
      return (
        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
          <i className="bi bi-check-circle-fill me-1"></i> {t('common.available')}
        </span>
      );
    }
    return (
      <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
        <i className="bi bi-x-circle-fill me-1"></i> {language === 'th' ? 'ถูกเช่าอยู่ / ไม่พร้อม' : 'Rented / Unavailable'}
      </span>
    );
  }

  const statusCode = Number(status);

  switch (statusCode) {
    case RENTAL_STATUS.AVAILABLE:
      return (
        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
          <i className="bi bi-check-circle-fill me-1"></i> {t('common.available')}
        </span>
      );
    case RENTAL_STATUS.PENDING:
      return (
        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1">
          <i className="bi bi-clock-history me-1"></i> {t('common.pending')}
        </span>
      );
    case RENTAL_STATUS.ACTIVE:
      return (
        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
          <i className="bi bi-broadcast me-1"></i> {t('common.active')}
        </span>
      );
    case RENTAL_STATUS.RETURNED:
      return (
        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-1">
          <i className="bi bi-arrow-return-left me-1"></i> {t('common.returned')}
        </span>
      );
    case RENTAL_STATUS.CANCELLED:
      return (
        <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1">
          <i className="bi bi-slash-circle me-1"></i> {t('common.cancelled')}
        </span>
      );
    case RENTAL_STATUS.COMPLETED:
      return (
        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
          <i className="bi bi-patch-check-fill me-1"></i> {t('common.completed')}
        </span>
      );
    default:
      return (
        <span className="badge bg-light text-dark border px-2 py-1">
          <i className="bi bi-question-circle me-1"></i> Unknown ({status})
        </span>
      );
  }
}
