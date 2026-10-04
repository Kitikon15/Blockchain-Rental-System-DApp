'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '../context/WalletContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchAllRentals, fetchAllItems, isContractConfigured } from '../lib/contract';
import { RENTAL_STATUS } from '../lib/constants';

/**
 * RentalExpiryAlert Component
 * Proactive Real-Time Notification & Countdown Alert System:
 * - Detects active rentals nearing expiration (< 2 hours or overdue)
 * - Renders a prominent dismissible alert banner at the top of the interface
 * - Integrates HTML5 Web Notifications API for desktop background alerts
 * - Provides direct one-click actions: Extend, Return, or View Agreement
 */
export default function RentalExpiryAlert() {
  const { account } = useWallet();
  const { language } = useLanguage();

  const [activeRentals, setActiveRentals] = useState([]);
  const [itemsMap, setItemsMap] = useState({});
  const [nowUnix, setNowUnix] = useState(() => Math.floor(Date.now() / 1000));
  const [dismissedRentals, setDismissedRentals] = useState(new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifiedSet, setNotifiedSet] = useState(new Set());

  // Check Web Notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationsEnabled(perm === 'granted');
    } catch (_) {}
  };

  // Load user rentals
  const loadRentals = useCallback(async () => {
    if (!account || !isContractConfigured()) {
      setActiveRentals([]);
      return;
    }
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

      const userActive = (allRentals || []).filter(
        (r) =>
          r.renter &&
          r.renter.toLowerCase() === account.toLowerCase() &&
          r.status === RENTAL_STATUS.ACTIVE
      );
      setActiveRentals(userActive);
    } catch (e) {
      console.warn('RentalExpiryAlert sync notice:', e.message);
    }
  }, [account]);

  // Reset immediately on account switch
  useEffect(() => {
    setActiveRentals([]);
  }, [account]);

  // Initial load and periodic sync
  useEffect(() => {
    loadRentals();
    const interval = setInterval(loadRentals, 10000);
    return () => clearInterval(interval);
  }, [loadRentals]);

  // Real-time second clock
  useEffect(() => {
    const clock = setInterval(() => {
      setNowUnix(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(clock);
  }, []);

  // Compute urgent and expiring rentals
  // Urgent: diff <= 7200 (within 2 hours) or overdue (diff <= 0)
  const expiringRentals = useMemo(() => {
    return activeRentals
      .map((r) => {
        const diff = Number(r.endTime) - nowUnix;
        return {
          ...r,
          diff,
          isOverdue: diff <= 0,
          isUrgent: diff > 0 && diff <= 7200, // less than 2 hours
          isVeryUrgent: diff > 0 && diff <= 1800, // less than 30 minutes
        };
      })
      .filter((r) => (r.isOverdue || r.isUrgent) && !dismissedRentals.has(r.rentalId));
  }, [activeRentals, nowUnix, dismissedRentals]);

  // Trigger Browser Notifications when nearing expiration
  useEffect(() => {
    if (!notificationsEnabled || typeof window === 'undefined' || !('Notification' in window)) return;

    expiringRentals.forEach((r) => {
      const key = `${r.rentalId}-${r.isOverdue ? 'overdue' : r.isVeryUrgent ? '30m' : '2h'}`;
      if (!notifiedSet.has(key)) {
        const itemName = itemsMap[r.itemId]?.name || `ทรัพย์สิน #${r.itemId}`;
        const title = r.isOverdue
          ? (language === 'th' ? '🚨 สัญญาเช่าเกินกำหนดเวลาแล้ว!' : '🚨 Rental Agreement Overdue!')
          : (language === 'th' ? '⚠️ เตือนก่อนหมดเวลาเช่า!' : '⚠️ Rental Expiration Warning!');

        const minutesLeft = Math.max(1, Math.round(r.diff / 60));
        const body = r.isOverdue
          ? (language === 'th'
              ? `สัญญา #${r.rentalId} (${itemName}) หมดเวลาแล้ว กรุณาส่งคืนทรัพย์สินหรือต่อเวลาเช่า`
              : `Rental #${r.rentalId} (${itemName}) is overdue. Please return or extend immediately.`)
          : (language === 'th'
              ? `สัญญา #${r.rentalId} (${itemName}) จะหมดเวลาในอีก ${minutesLeft} นาที!`
              : `Rental #${r.rentalId} (${itemName}) will expire in ${minutesLeft} minutes!`);

        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
          setNotifiedSet((prev) => new Set([...prev, key]));
        } catch (_) {}
      }
    });
  }, [expiringRentals, notificationsEnabled, notifiedSet, itemsMap, language]);

  const handleDismiss = (rentalId) => {
    setDismissedRentals((prev) => new Set([...prev, rentalId]));
  };

  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) {
      return language === 'th'
        ? `${h} ชั่วโมง ${pad(m)} นาที ${pad(s)} วินาที`
        : `${h}h ${pad(m)}m ${pad(s)}s`;
    }
    return language === 'th'
      ? `${pad(m)} นาที ${pad(s)} วินาที`
      : `${pad(m)}m ${pad(s)}s`;
  };

  if (expiringRentals.length === 0) return null;

  return (
    <aside
      aria-label="Rental Expiration Notifications"
      className="bg-warning-subtle border-bottom border-warning py-2.5 px-3 shadow-sm sticky-top"
      style={{ zIndex: 1020, top: '56px' }}
    >
      <div className="container-fluid px-2 px-lg-4">
        <div className="d-flex flex-column gap-2">
          {expiringRentals.map((r) => {
            const item = itemsMap[r.itemId];
            const itemName = item?.name || (language === 'th' ? `ทรัพย์สิน #${r.itemId}` : `Item #${r.itemId}`);

            return (
              <div
                key={r.rentalId}
                className={`d-flex flex-wrap align-items-center justify-content-between p-2 rounded border ${
                  r.isOverdue
                    ? 'bg-danger text-white border-danger'
                    : 'bg-white text-dark border-warning'
                }`}
              >
                {/* Alert Icon & Info */}
                <div className="d-flex align-items-center gap-2.5 flex-grow-1 me-3 mb-1 mb-md-0">
                  <div
                    className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${
                      r.isOverdue ? 'bg-white text-danger' : 'bg-warning text-dark'
                    }`}
                    style={{ width: '32px', height: '32px' }}
                  >
                    <i
                      className={`bi ${
                        r.isOverdue
                          ? 'bi-exclamation-triangle-fill fs-6 animate__animated animate__pulse animate__infinite'
                          : 'bi-bell-fill fs-6'
                      }`}
                    ></i>
                  </div>

                  <div className="small">
                    <span className="fw-bold me-1">
                      {r.isOverdue
                        ? (language === 'th' ? '🚨 เกินกำหนดเวลาเช่า:' : '🚨 Rental Overdue:')
                        : (language === 'th' ? '⏰ แจ้งเตือนก่อนหมดเวลาเช่า:' : '⏰ Expiration Notice:')}
                    </span>
                    <span className="font-monospace fw-bold">#{r.rentalId}</span>
                    <span className="mx-1">•</span>
                    <span className="fw-semibold text-truncate d-inline-block" style={{ maxWidth: '320px', verticalAlign: 'bottom' }}>
                      {itemName}
                    </span>
                    <span className="mx-1">•</span>
                    {r.isOverdue ? (
                      <span className="badge bg-white text-danger font-monospace fw-bold">
                        {language === 'th' ? 'หมดเวลาแล้ว กรุณาส่งคืนทันที' : 'Expired - Please Return'}
                      </span>
                    ) : (
                      <span className="badge bg-warning text-dark font-monospace fw-bold">
                        {language === 'th' ? 'เหลือเวลาอีก: ' : 'Time remaining: '}
                        {formatTimeRemaining(r.diff)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
                  {!notificationsEnabled && typeof window !== 'undefined' && 'Notification' in window && (
                    <button
                      type="button"
                      onClick={requestNotificationPermission}
                      className="btn btn-outline-secondary btn-xs small py-1 px-2 d-none d-lg-inline-flex align-items-center gap-1"
                      title={language === 'th' ? 'เปิดแจ้งเตือนบนเบราว์เซอร์' : 'Enable browser alerts'}
                    >
                      <i className="bi bi-bell"></i>
                      <span>{language === 'th' ? 'เปิดแจ้งเตือนบนหน้าจอ' : 'Desktop Alerts'}</span>
                    </button>
                  )}

                  <Link
                    href={`/my-rentals?status=ACTIVE`}
                    className={`btn btn-sm fw-bold px-2.5 py-1 ${
                      r.isOverdue ? 'btn-light text-danger' : 'btn-outline-primary'
                    }`}
                  >
                    <i className="bi bi-clock-history me-1"></i>
                    {language === 'th' ? 'ต่อเวลา / ส่งคืน' : 'Extend / Return'}
                  </Link>

                  <Link
                    href={`/rentals/${r.itemId}`}
                    className={`btn btn-sm px-2 py-1 ${
                      r.isOverdue ? 'btn-outline-light' : 'btn-outline-secondary'
                    }`}
                    title={language === 'th' ? 'ดูรายละเอียดทรัพย์สิน' : 'View item specs'}
                  >
                    <i className="bi bi-eye"></i>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDismiss(r.rentalId)}
                    className={`btn btn-sm btn-link p-1 text-decoration-none ${
                      r.isOverdue ? 'text-white' : 'text-muted'
                    }`}
                    title={language === 'th' ? 'ซ่อนการแจ้งเตือนชั่วคราว' : 'Dismiss notice'}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
