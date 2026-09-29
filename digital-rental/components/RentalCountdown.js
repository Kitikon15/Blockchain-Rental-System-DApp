'use client';

import { useState, useEffect } from 'react';
import { RENTAL_STATUS } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';

/**
 * RentalCountdown Component
 * Displays real-time ticking countdown timer (days, hours, minutes, seconds)
 * for active rentals, and accurate status indicator when expired, returned, or cancelled.
 */
export default function RentalCountdown({
  endTime,
  startTime,
  status = RENTAL_STATUS.ACTIVE,
  compact = false,
  showLabel = true,
}) {
  const { language } = useLanguage();
  const [nowUnix, setNowUnix] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    // Update every second in real-time
    const interval = setInterval(() => {
      setNowUnix(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const end = Number(endTime || 0);
  const diff = end - nowUnix;
  const isOverdue = status === RENTAL_STATUS.ACTIVE && diff <= 0;

  // Format remaining time
  const formatRemaining = (seconds) => {
    if (seconds <= 0) return '00:00:00';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const pad = (n) => String(n).padStart(2, '0');

    if (d > 0) {
      return language === 'th'
        ? `${d} วัน ${pad(h)}:${pad(m)}:${pad(s)}`
        : `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  // Returned status
  if (status === RENTAL_STATUS.RETURNED || status === RENTAL_STATUS.COMPLETED) {
    return (
      <span className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1">
        <i className="bi bi-check2-circle"></i>
        <span>{language === 'th' ? 'คืนของ & คืนมัดจำแล้ว' : 'Returned & Refunded'}</span>
      </span>
    );
  }

  // Cancelled status
  if (status === RENTAL_STATUS.CANCELLED) {
    return (
      <span className="badge bg-danger-subtle text-danger border border-danger-subtle d-inline-flex align-items-center gap-1">
        <i className="bi bi-x-circle"></i>
        <span>{language === 'th' ? 'ยกเลิกแล้ว (คืนมัดจำแล้ว)' : 'Cancelled (Refunded)'}</span>
      </span>
    );
  }

  // Active but Overdue
  if (isOverdue) {
    const overdueSecs = Math.abs(diff);
    const overdueFormatted = formatRemaining(overdueSecs);
    return (
      <span className="badge bg-danger text-white d-inline-flex align-items-center gap-1 animate__animated animate__pulse animate__infinite">
        <i className="bi bi-exclamation-triangle-fill"></i>
        <span>
          {language === 'th'
            ? `เกินกำหนด ${overdueFormatted}`
            : `Overdue by ${overdueFormatted}`}
        </span>
      </span>
    );
  }

  // Active and Countdown Ticking
  const remainingStr = formatRemaining(diff);
  const isUrgent = diff < 3600; // Less than 1 hour remaining

  if (compact) {
    return (
      <span
        className={`badge ${isUrgent ? 'bg-warning text-dark' : 'bg-primary-subtle text-primary border border-primary-subtle'} font-monospace d-inline-flex align-items-center gap-1`}
        title={language === 'th' ? 'เวลานับถอยหลังสัญญาเช่าแบบ Real-time' : 'Real-time Rental Countdown'}
      >
        <i className={`bi ${isUrgent ? 'bi-stopwatch-fill' : 'bi-stopwatch'} ${isUrgent ? 'spin-slow' : ''}`}></i>
        <span>{remainingStr}</span>
      </span>
    );
  }

  return (
    <div className="d-inline-flex align-items-center gap-1.5">
      <span
        className={`badge ${isUrgent ? 'bg-warning text-dark' : 'bg-primary'} font-monospace px-2 py-1 shadow-sm d-inline-flex align-items-center gap-1`}
      >
        <i className={`bi bi-stopwatch-fill ${isUrgent ? 'spin-slow' : ''}`}></i>
        <span>
          {showLabel && (language === 'th' ? 'เหลือ ' : 'Left ')}
          {remainingStr}
        </span>
      </span>
    </div>
  );
}
