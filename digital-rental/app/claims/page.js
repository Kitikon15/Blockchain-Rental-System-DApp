'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '../../context/WalletContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchRentalById,
  fetchItemById,
  fetchAllRentals,
  fetchAllItems,
  returnItemOnChain,
  cancelRentalOnChain,
  extendRentalOnChain,
  isContractConfigured,
  parseContractError,
} from '../../lib/contract';
import { formatAddress, formatDateTime } from '../../lib/wallet';
import { DEFAULT_EXPLORER_URL, RENTAL_STATUS } from '../../lib/constants';
import RentalStatus from '../../components/RentalStatus';
import RentalCountdown from '../../components/RentalCountdown';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import TransactionStatus from '../../components/TransactionStatus';

/**
 * Claims & On-Chain Audit Page (app/claims/page.js)
 * Transparent verification tool for renters, owners, and auditors to inspect
 * blockchain rental agreements, live countdown timers, escrow deposit state,
 * and dispute proof with interactive agreement selection (dropdown & card picker).
 */
export default function ClaimsPage() {
  const { account } = useWallet();
  const { t, language } = useLanguage();

  const [searchId, setSearchId] = useState('');
  const [inspectedRental, setInspectedRental] = useState(null);
  const [inspectedItem, setInspectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // List of all rentals and items for interactive selection
  const [availableRentals, setAvailableRentals] = useState([]);
  const [itemMap, setItemMap] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Real-time synchronization
  const [autoSync, setAutoSync] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Direct Action Modals State in Claims
  const [actionType, setActionType] = useState(null); // 'RETURN' | 'CANCEL'
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [extendDurationValue, setExtendDurationValue] = useState(2);
  const [extendDurationUnit, setExtendDurationUnit] = useState('minutes');
  const [actionTxState, setActionTxState] = useState(null);
  const [actionTxHash, setActionTxHash] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const contractConfigured = isContractConfigured();
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  // Helper function to resolve localized status string
  const getStatusLabel = useCallback(
    (status) => {
      switch (Number(status)) {
        case RENTAL_STATUS.PENDING:
          return language === 'th' ? 'รอดำเนินการ' : 'Pending';
        case RENTAL_STATUS.ACTIVE:
          return language === 'th' ? 'กำลังเช่าอยู่' : 'Active';
        case RENTAL_STATUS.RETURNED:
        case RENTAL_STATUS.COMPLETED:
          return language === 'th' ? 'คืนแล้ว' : 'Returned';
        case RENTAL_STATUS.CANCELLED:
          return language === 'th' ? 'ยกเลิกแล้ว' : 'Cancelled';
        default:
          return language === 'th' ? 'ไม่ระบุ' : 'Unknown';
      }
    },
    [language]
  );

  // Core inspection logic
  const inspectAgreementId = useCallback(
    async (rawId, silent = false) => {
      const cleaned = String(rawId || '').replace(/^#/, '').trim();
      setSearchId(cleaned);

      if (!cleaned) {
        if (!silent) {
          setError(
            language === 'th'
              ? 'กรุณาเลือกสัญญาเช่าหรือกรอกรหัสตัวเลขให้ถูกต้อง'
              : 'Please select an agreement or enter a valid numeric Agreement ID.'
          );
        }
        return;
      }

      // Check if user entered an address or hash instead of numeric ID
      if (cleaned.startsWith('0x') || (cleaned.length >= 15 && isNaN(Number(cleaned)))) {
        setError(
          language === 'th'
            ? 'ข้อความที่คุณกรอกคือ Wallet Address หรือ Tx Hash กรุณาเลือกสัญญาจากเมนูด้านบน หรือกรอก "รหัสสัญญาเช่า" ที่เป็นตัวเลข (เช่น 101, 102, 1)'
            : 'You entered an address or hash. Please select an agreement from the list above or enter a numeric ID (e.g. 101, 102, 1).'
        );
        return;
      }

      const id = parseInt(cleaned, 10);
      if (!id || id <= 0) {
        if (!silent) {
          setError(
            language === 'th'
              ? 'กรุณากรอกรหัสสัญญาเช่าที่เป็นตัวเลขให้ถูกต้อง (เช่น 101, 102)'
              : 'Please enter a valid numeric Rental Agreement ID (e.g. 101, 102).'
          );
        }
        return;
      }

      if (!contractConfigured) {
        setError(
          language === 'th'
            ? 'ยังไม่ได้ระบุ Contract Address ใน .env.local'
            : 'Contract address not configured in .env.local.'
        );
        return;
      }

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const rental = await fetchRentalById(id, account);
        if (!rental || rental.rentalId === 0) {
          if (!silent) {
            setError(
              language === 'th'
                ? `ไม่พบสัญญาเช่าหมายเลข #${id} บนระบบบล็อกเชน (กรุณาเลือกสัญญาจากรายการที่มีอยู่)`
                : `No rental agreement found with ID #${id}. Please select from available agreements.`
            );
            setInspectedRental(null);
            setInspectedItem(null);
          }
          return;
        }

        setInspectedRental(rental);

        try {
          const item = await fetchItemById(rental.itemId, account);
          setInspectedItem(item);
        } catch (iErr) {
          console.warn('Could not load associated item:', iErr.message);
        }
      } catch (err) {
        console.error('Audit query error:', err);
        if (!silent) {
          setError(err);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [contractConfigured, language, account]
  );

  // Load all rentals and items for selection
  const loadAgreementsList = useCallback(
    async (silent = false) => {
      try {
        const [rentalsList, itemsList] = await Promise.all([
          fetchAllRentals(account),
          fetchAllItems(account),
        ]);

        if (Array.isArray(rentalsList)) {
          setAvailableRentals(rentalsList);
        }

        if (Array.isArray(itemsList)) {
          const mapping = {};
          itemsList.forEach((it) => {
            mapping[it.itemId] = it;
          });
          setItemMap(mapping);
        }

        setLastSyncTime(new Date());

        // Refresh currently inspected rental if active
        if (searchId) {
          inspectAgreementId(searchId, true);
        }
      } catch (e) {
        console.warn('Silent sync error in claims audit:', e.message);
      }
    },
    [account, searchId, inspectAgreementId]
  );

  // Initial load and URL param check
  useEffect(() => {
    let isMounted = true;

    async function init() {
      await loadAgreementsList(false);

      // Check for query param ?id=101
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const qId = params.get('id');
          if (qId && isMounted) {
            inspectAgreementId(qId);
          }
        }
      } catch (e) {}
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [account, loadAgreementsList, inspectAgreementId]);

  // Real-time polling interval (every 6 seconds)
  useEffect(() => {
    if (!autoSync) return;

    const interval = setInterval(() => {
      loadAgreementsList(true);
    }, 6000);

    return () => clearInterval(interval);
  }, [autoSync, loadAgreementsList]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    inspectAgreementId(searchId);
  };

  const handleOpenAction = (type) => {
    setActionType(type);
    setActionTxState(null);
    setActionTxHash(null);
    setActionError(null);
    setIsActionModalOpen(true);
  };

  const handleOpenExtend = () => {
    setExtendDurationValue(2);
    setExtendDurationUnit('minutes');
    setActionTxState(null);
    setActionTxHash(null);
    setActionError(null);
    setIsExtendModalOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!inspectedRental) return;
    setIsProcessingAction(true);
    setActionError(null);
    setActionTxState('waiting_approval');

    try {
      let res;
      if (actionType === 'RETURN') {
        res = await returnItemOnChain(inspectedRental.rentalId);
      } else if (actionType === 'CANCEL') {
        res = await cancelRentalOnChain(inspectedRental.rentalId);
      }
      setActionTxHash(res?.hash);
      setActionTxState('confirmed');
      await loadAgreementsList(true);
      await inspectAgreementId(inspectedRental.rentalId, true);
    } catch (err) {
      console.error('Audit action failed:', err);
      setActionError(parseContractError(err));
      setActionTxState('failed');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleExecuteExtend = async (forceDemo = false) => {
    if (!inspectedRental) return;
    setIsProcessingAction(true);
    setActionError(null);
    setActionTxState('waiting_approval');

    try {
      const num = Number(extendDurationValue || 1);
      const additionalSeconds =
        extendDurationUnit === 'minutes' ? num * 60 : extendDurationUnit === 'hours' ? num * 3600 : num * 86400;
      const pricePerDay = parseFloat(inspectedRental.rentalPriceEth || '0.05');
      let fee = 0;
      if (extendDurationUnit === 'minutes') {
        fee = Math.max(0.005, (pricePerDay / 1440) * num);
      } else if (extendDurationUnit === 'hours') {
        fee = Math.max(0.01, (pricePerDay / 24) * num);
      } else {
        fee = Math.max(pricePerDay, pricePerDay * num);
      }
      const additionalFeeEth = fee.toFixed(4);

      const res = await extendRentalOnChain({
        rentalId: inspectedRental.rentalId,
        additionalSeconds,
        additionalFeeEth,
        forceDemo,
      });

      setActionTxHash(res?.hash);
      setActionTxState('confirmed');
      await loadAgreementsList(true);
      await inspectAgreementId(inspectedRental.rentalId, true);
    } catch (err) {
      console.error('Audit extension failed:', err);
      setActionError(parseContractError(err));
      setActionTxState('failed');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Group rentals into "My Rentals" and "All System Rentals"
  const { myRentals, otherRentals } = useMemo(() => {
    const mine = [];
    const others = [];

    availableRentals.forEach((r) => {
      const isMine =
        account &&
        ((r.renter && r.renter.toLowerCase() === account.toLowerCase()) ||
          (r.owner && r.owner.toLowerCase() === account.toLowerCase()));

      if (isMine) {
        mine.push(r);
      } else {
        others.push(r);
      }
    });

    return { myRentals: mine, otherRentals: others };
  }, [availableRentals, account]);

  // Filtered list for the interactive visual card picker
  const filteredRentals = useMemo(() => {
    return availableRentals.filter((r) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ACTIVE') return Number(r.status) === RENTAL_STATUS.ACTIVE;
      if (statusFilter === 'RETURNED')
        return (
          Number(r.status) === RENTAL_STATUS.RETURNED || Number(r.status) === RENTAL_STATUS.COMPLETED
        );
      if (statusFilter === 'CANCELLED') return Number(r.status) === RENTAL_STATUS.CANCELLED;
      return true;
    });
  }, [availableRentals, statusFilter]);

  // Check if input looks like an address/hash
  const isAddressOrHash =
    searchId.startsWith('0x') || (searchId.length >= 15 && isNaN(Number(searchId)));

  const nowUnix = Math.floor(Date.now() / 1000);
  const isOverdue =
    inspectedRental &&
    inspectedRental.status === RENTAL_STATUS.ACTIVE &&
    inspectedRental.endTime < nowUnix;

  return (
    <div className="container py-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-shield-check text-primary"></i>
            {t('claims.title')}
          </h2>
          <p className="text-muted small mb-0">{t('claims.subtitle')}</p>
        </div>

        {/* Real-time sync badge & controls */}
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`btn btn-sm d-flex align-items-center gap-1 ${
              autoSync ? 'btn-outline-success bg-success-subtle' : 'btn-outline-secondary'
            }`}
            title={autoSync ? 'Auto-sync is ON (every 6s)' : 'Auto-sync is PAUSED'}
          >
            <span
              className={`rounded-circle d-inline-block ${autoSync ? 'bg-success' : 'bg-secondary'}`}
              style={{
                width: '8px',
                height: '8px',
                boxShadow: autoSync ? '0 0 6px rgba(25, 135, 84, 0.8)' : 'none',
              }}
            ></span>
            <span className="small fw-semibold">
              {autoSync
                ? language === 'th'
                  ? 'ซิงค์สด Real-Time'
                  : 'Live Real-Time Sync'
                : language === 'th'
                ? 'หยุดซิงค์ชั่วคราว'
                : 'Sync Paused'}
            </span>
          </button>

          <button
            onClick={() => loadAgreementsList(false)}
            disabled={loading}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center"
            title="Refresh on-chain data"
          >
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>
            {language === 'th' ? 'รีเฟรช' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Main Selector & Dispute Architecture */}
      <div className="row g-4 mb-4">
        {/* Left Column: Interactive Selector */}
        <div className="col-lg-7">
          <div className="card shadow-sm border bg-white h-100 p-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="fw-bold text-dark mb-0">
                <i className="bi bi-ui-checks text-primary me-2"></i>
                {language === 'th' ? 'เลือกสัญญาเช่าที่ต้องการตรวจสอบ' : t('claims.queryCardTitle')}
              </h5>
              <span className="badge bg-light text-primary border small">
                {language === 'th'
                  ? `พบทั้งหมด ${availableRentals.length} สัญญา`
                  : `${availableRentals.length} Agreements`}
              </span>
            </div>

            <p className="text-muted small mb-3">
              {language === 'th'
                ? 'เลือกสัญญาเช่าจากเมนูดรอปดาวน์ หรือคลิกเลือกการ์ดสัญญาด้านล่าง เพื่อดึงข้อมูลสดจาก Smart Contract บน Sepolia'
                : t('claims.queryCardDesc')}
            </p>

            {/* 1. Interactive Dropdown Selector */}
            <div className="mb-4">
              <label className="form-label small fw-bold text-secondary mb-1">
                <i className="bi bi-menu-button-wide text-primary me-1"></i>
                {language === 'th'
                  ? '1. เลือกจากดรอปดาวน์ (Dropdown Selector):'
                  : '1. Select from Dropdown:'}
              </label>
              <select
                className="form-select border-primary-subtle shadow-sm font-monospace"
                value={searchId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchId(val);
                  if (val) {
                    inspectAgreementId(val);
                  }
                }}
              >
                <option value="">
                  {language === 'th'
                    ? '-- กรุณาคลิกเลือกสัญญาเช่าที่ต้องการตรวจสอบ --'
                    : '-- Select a rental agreement to inspect --'}
                </option>

                {/* Group 1: My Rentals */}
                {myRentals.length > 0 && (
                  <optgroup
                    label={
                      language === 'th'
                        ? `⭐ สัญญาของคุณ (${myRentals.length} รายการ)`
                        : `⭐ Your Rentals (${myRentals.length})`
                    }
                  >
                    {myRentals.map((r) => {
                      const item = itemMap[r.itemId];
                      const name = item ? item.name : `Item #${r.itemId}`;
                      const statusTxt = getStatusLabel(r.status);
                      return (
                        <option key={`my-${r.rentalId}`} value={r.rentalId}>
                          #{r.rentalId} - {name} [{statusTxt}] | มัดจำ: {r.depositEth} ETH
                        </option>
                      );
                    })}
                  </optgroup>
                )}

                {/* Group 2: All Other System Contracts */}
                <optgroup
                  label={
                    language === 'th'
                      ? `📋 สัญญาเช่าทั้งหมดบนระบบ (${otherRentals.length} รายการ)`
                      : `📋 All System Agreements (${otherRentals.length})`
                  }
                >
                  {otherRentals.map((r) => {
                    const item = itemMap[r.itemId];
                    const name = item ? item.name : `Item #${r.itemId}`;
                    const statusTxt = getStatusLabel(r.status);
                    return (
                      <option key={`all-${r.rentalId}`} value={r.rentalId}>
                        #{r.rentalId} - {name} [{statusTxt}] | มัดจำ: {r.depositEth} ETH
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>

            {/* 2. Visual Card / Filter Selector */}
            <div className="mb-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <label className="form-label small fw-bold text-secondary mb-0">
                  <i className="bi bi-grid text-primary me-1"></i>
                  {language === 'th'
                    ? '2. หรือคลิกเลือกจากการ์ดสัญญา (Quick Card Picker):'
                    : '2. Or Click to Inspect Agreement:'}
                </label>

                {/* Status Filter Buttons */}
                <div className="btn-group btn-group-sm" role="group">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className={`btn btn-xs ${
                      statusFilter === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'
                    }`}
                  >
                    {language === 'th' ? 'ทั้งหมด' : 'All'} ({availableRentals.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ACTIVE')}
                    className={`btn btn-xs ${
                      statusFilter === 'ACTIVE' ? 'btn-primary' : 'btn-outline-secondary'
                    }`}
                  >
                    {language === 'th' ? 'กำลังเช่า' : 'Active'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('RETURNED')}
                    className={`btn btn-xs ${
                      statusFilter === 'RETURNED' ? 'btn-primary' : 'btn-outline-secondary'
                    }`}
                  >
                    {language === 'th' ? 'คืนแล้ว' : 'Returned'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('CANCELLED')}
                    className={`btn btn-xs ${
                      statusFilter === 'CANCELLED' ? 'btn-primary' : 'btn-outline-secondary'
                    }`}
                  >
                    {language === 'th' ? 'ยกเลิก' : 'Cancelled'}
                  </button>
                </div>
              </div>

              {/* Scrollable grid of agreement pills */}
              <div
                className="d-flex flex-wrap gap-2 p-2 rounded bg-light border"
                style={{ maxHeight: '180px', overflowY: 'auto' }}
              >
                {filteredRentals.length === 0 ? (
                  <div className="w-100 text-center py-3 text-muted small">
                    {language === 'th'
                      ? 'ไม่มีสัญญาเช่าในหมวดหมู่นี้'
                      : 'No agreements matching this filter'}
                  </div>
                ) : (
                  filteredRentals.map((r) => {
                    const isSelected = String(searchId) === String(r.rentalId);
                    const item = itemMap[r.itemId];
                    const itemName = item ? item.name : `Item #${r.itemId}`;

                    let badgeColor = 'bg-secondary';
                    if (Number(r.status) === RENTAL_STATUS.ACTIVE) badgeColor = 'bg-success';
                    if (Number(r.status) === RENTAL_STATUS.RETURNED) badgeColor = 'bg-secondary';
                    if (Number(r.status) === RENTAL_STATUS.CANCELLED) badgeColor = 'bg-danger';

                    return (
                      <button
                        key={`pill-${r.rentalId}`}
                        type="button"
                        onClick={() => inspectAgreementId(r.rentalId)}
                        className={`btn btn-sm d-flex align-items-center gap-2 text-start transition-all ${
                          isSelected
                            ? 'btn-primary text-white shadow-sm border-primary'
                            : 'btn-outline-secondary bg-white text-dark'
                        }`}
                        style={{ borderRadius: '8px' }}
                      >
                        <span className={`badge ${badgeColor} text-white`}>#{r.rentalId}</span>
                        <span
                          className="small fw-semibold text-truncate"
                          style={{ maxWidth: '140px' }}
                        >
                          {itemName}
                        </span>
                        <span className="small opacity-75">
                          {getStatusLabel(r.status)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Manual ID Input */}
            <div className="pt-3 border-top">
              <label className="form-label small fw-bold text-secondary mb-1">
                <i className="bi bi-hash text-primary me-1"></i>
                {language === 'th'
                  ? '3. หรือระบุรหัสสัญญาเช่า (Numeric ID) ด้วยตนเอง:'
                  : '3. Or enter numeric ID manually:'}
              </label>

              <form onSubmit={handleManualSubmit}>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light text-muted fw-bold">#</span>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    placeholder={
                      language === 'th' ? 'กรอกรหัสสัญญา เช่น 101, 102' : t('claims.inputPlaceholder')
                    }
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={loading || !searchId.trim()}
                    className="btn btn-primary fw-medium px-3"
                  >
                    {loading ? (
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                    ) : (
                      t('claims.btnVerify')
                    )}
                  </button>
                </div>
              </form>

              {isAddressOrHash && (
                <div className="alert alert-warning py-2 px-3 small mt-2 mb-0 d-flex align-items-start">
                  <i className="bi bi-exclamation-triangle-fill text-warning me-2 mt-1 fs-6 flex-shrink-0"></i>
                  <div>
                    {language === 'th' ? (
                      <>
                        <strong>แจ้งเตือน:</strong> คุณกำลังกรอก Wallet Address หรือ Hash กรุณา
                        <strong>เลือกสัญญาจากดรอปดาวน์ด้านบน</strong> หรือกรอก{' '}
                        <strong>รหัสสัญญาเช่าที่เป็นตัวเลข</strong> เช่น <code>101</code>, <code>102</code>
                      </>
                    ) : (
                      <>
                        <strong>Notice:</strong> You entered an address/hash. Please select an agreement
                        from the dropdown above or enter a numeric ID (e.g. <code>101</code>, <code>102</code>).
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Dispute Resolution Architecture */}
        <div className="col-lg-5">
          <div className="card shadow-sm border bg-white h-100 p-4">
            <h5 className="fw-bold text-dark mb-3">
              <i className="bi bi-diagram-3 text-info me-2"></i>
              {t('claims.archTitle')}
            </h5>
            <ul className="list-unstyled d-flex flex-column gap-3 small text-secondary mb-0">
              <li className="d-flex align-items-start">
                <i className="bi bi-check2-circle text-primary me-2 mt-0.5 fs-6"></i>
                <span>{t('claims.arch1')}</span>
              </li>
              <li className="d-flex align-items-start">
                <i className="bi bi-check2-circle text-primary me-2 mt-0.5 fs-6"></i>
                <span>{t('claims.arch2')}</span>
              </li>
              <li className="d-flex align-items-start">
                <i className="bi bi-check2-circle text-primary me-2 mt-0.5 fs-6"></i>
                <span>{t('claims.arch3')}</span>
              </li>
            </ul>

            {/* Quick Helper Tip */}
            <div className="mt-auto pt-3 border-top">
              <div className="p-3 rounded bg-light border small text-muted">
                <i className="bi bi-info-circle-fill text-primary me-2"></i>
                {language === 'th'
                  ? 'ข้อมูลที่แสดงในหน้านี้ดึงจากบล็อกเชน Sepolia โดยตรง เป็นหลักฐานที่เปลี่ยนแปลงไม่ได้ (Immutable) สามารถนำไปอ้างอิงเพื่อตรวจสอบสิทธิ์และการคืนเงินมัดจำ'
                  : 'Audit records are queried directly from Ethereum Sepolia bytecode and represent immutable evidence of rental terms, escrow deposits, and return states.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error / Loading */}
      {error && <ErrorMessage error={error} />}
      {loading && (
        <Loading
          message={
            language === 'th'
              ? 'กำลังตรวจสอบข้อมูลสัญญาเช่าบนบล็อกเชน Sepolia...'
              : 'Querying Ethereum Sepolia ledger...'
          }
        />
      )}

      {/* Inspected Record Display */}
      {inspectedRental && !loading && (
        <div className="card shadow-sm border bg-white mb-4 animate__animated animate__fadeIn">
          <div className="card-header bg-dark text-white d-flex flex-wrap justify-content-between align-items-center py-3 gap-2">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-file-earmark-check-fill text-info fs-5"></i>
              <span className="fw-bold fs-5">
                {t('claims.agreementHeader')}
                {inspectedRental.rentalId}
              </span>
              <span className="badge bg-secondary font-monospace small">
                Item #{inspectedRental.itemId}
              </span>
            </div>

            <div className="d-flex align-items-center gap-2">
              <RentalStatus status={inspectedRental.status} />
              <RentalCountdown
                startTime={inspectedRental.startTime}
                endTime={inspectedRental.endTime}
                status={inspectedRental.status}
                language={language}
              />
            </div>
          </div>

          <div className="card-body p-4">
            <div className="row g-4">
              {/* Left Details */}
              <div className="col-md-6">
                <h6 className="fw-bold text-secondary text-uppercase small mb-3">
                  <i className="bi bi-info-circle me-1 text-primary"></i>
                  {t('claims.agreementDetails')}
                </h6>

                <table className="table table-sm table-borderless small mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted" style={{ width: '40%' }}>
                        {language === 'th' ? 'ทรัพย์สิน:' : 'Item:'}
                      </td>
                      <td className="fw-bold">
                        <Link
                          href={`/rentals/${inspectedRental.itemId}`}
                          className="text-decoration-none text-primary"
                        >
                          {inspectedItem ? inspectedItem.name : `Item #${inspectedRental.itemId}`}
                          <i className="bi bi-box-arrow-up-right small ms-1"></i>
                        </Link>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">
                        {language === 'th' ? 'สถานะการนับเวลา:' : 'Live Status / Timer:'}
                      </td>
                      <td>
                        <RentalCountdown
                          startTime={inspectedRental.startTime}
                          endTime={inspectedRental.endTime}
                          status={inspectedRental.status}
                          language={language}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">
                        {language === 'th' ? 'เวลาเริ่มสัญญา:' : 'Start Timestamp:'}
                      </td>
                      <td className="font-monospace">
                        {formatDateTime(inspectedRental.startTime, language, true)}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">
                        {language === 'th' ? 'เวลาครบกำหนด:' : 'End Timestamp:'}
                      </td>
                      <td className="font-monospace">
                        {formatDateTime(inspectedRental.endTime, language, true)}{' '}
                        {isOverdue && (
                          <span className="badge bg-danger ms-1">{t('claims.overdueBadge')}</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">{t('common.dailyRate')}:</td>
                      <td className="font-monospace text-primary fw-bold">
                        {inspectedRental.rentalPriceEth} ETH
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">{t('common.securityDeposit')}:</td>
                      <td className="font-monospace text-success fw-bold">
                        {inspectedRental.depositEth} ETH
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">
                        {language === 'th' ? 'ยอดส่งเข้าสัญญา (Escrow):' : 'Total Paid to Escrow:'}
                      </td>
                      <td className="font-monospace fw-bold text-dark">
                        {inspectedRental.totalPaidEth} ETH
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Escrow deposit status badge */}
                <div className="mt-3 p-3 rounded bg-light border">
                  <div className="small fw-semibold text-secondary mb-1">
                    <i className="bi bi-shield-lock-fill text-primary me-1"></i>
                    {language === 'th'
                      ? 'สถานะเงินมัดจำความเสียหาย (Escrow Deposit):'
                      : 'Security Deposit Escrow State:'}
                  </div>
                  {inspectedRental.status === RENTAL_STATUS.ACTIVE ? (
                    <div className="d-flex flex-column gap-1">
                      <span className="badge bg-warning text-dark align-self-start">
                        <i className="bi bi-lock-fill me-1"></i>
                        {language === 'th'
                          ? 'กำลังล็อกอยู่ใน Smart Contract (จะคืนเมื่อส่งมอบหรือยกเลิก)'
                          : 'Locked in Smart Contract Bytecode'}
                      </span>
                      <span className="small text-muted">
                        {language === 'th'
                          ? `ยอดเงินมัดจำ ${inspectedRental.depositEth} ETH จะถูกโอนคืนกระเป๋าผู้เช่าทันทีเมื่อส่งคืนหรือยกเลิก`
                          : `The ${inspectedRental.depositEth} ETH deposit will be refunded automatically upon return or cancellation.`}
                      </span>
                    </div>
                  ) : inspectedRental.status === RENTAL_STATUS.RETURNED ||
                    inspectedRental.status === RENTAL_STATUS.COMPLETED ? (
                    <div className="d-flex flex-column gap-1">
                      <span className="badge bg-success align-self-start">
                        <i className="bi bi-check-circle-fill me-1"></i>
                        {language === 'th'
                          ? 'ปลดล็อกและโอนคืนกระเป๋าผู้เช่าเรียบร้อยแล้ว 100%'
                          : 'Refunded to Renter Wallet 100%'}
                      </span>
                      <span className="small text-muted">
                        {language === 'th'
                          ? `โอนคืน ${inspectedRental.depositEth} ETH กลับสู่ผู้เช่าแล้ว`
                          : `Successfully returned ${inspectedRental.depositEth} ETH deposit.`}
                      </span>
                    </div>
                  ) : inspectedRental.status === RENTAL_STATUS.CANCELLED ? (
                    <div className="d-flex flex-column gap-1">
                      <span className="badge bg-danger align-self-start">
                        <i className="bi bi-x-circle-fill me-1"></i>
                        {language === 'th'
                          ? 'ยกเลิกสัญญาแล้ว - คืนเงินมัดจำเข้ากระเป๋าผู้เช่าเรียบร้อย 100%'
                          : 'Agreement Cancelled - Deposit 100% Refunded'}
                      </span>
                      <span className="small text-muted">
                        {language === 'th'
                          ? `ยกเลิกสัญญาแล้ว ยอดมัดจำ ${inspectedRental.depositEth} ETH ถูกโอนคืนเข้ากระเป๋าผู้เช่าทันที`
                          : `Deposit of ${inspectedRental.depositEth} ETH refunded to renter.`}
                      </span>
                    </div>
                  ) : (
                    <span className="badge bg-secondary">
                      {language === 'th' ? 'สิ้นสุดสัญญาแล้ว' : 'Terminated'}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Details: Parties & Hashes */}
              <div className="col-md-6">
                <h6 className="fw-bold text-secondary text-uppercase small mb-3">
                  <i className="bi bi-people me-1 text-primary"></i>
                  {t('claims.partiesHeader')}
                </h6>

                <div className="border rounded p-3 bg-light mb-3 small">
                  <div className="text-muted mb-1 fw-semibold">{t('common.owner')}:</div>
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="font-monospace text-dark text-break">
                      {inspectedRental.owner}
                    </span>
                    <a
                      href={`${explorerBase}/address/${inspectedRental.owner}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-decoration-none ms-2"
                      title="View on Etherscan"
                    >
                      <i className="bi bi-box-arrow-up-right"></i>
                    </a>
                  </div>
                </div>

                <div className="border rounded p-3 bg-light mb-3 small">
                  <div className="text-muted mb-1 fw-semibold">{t('common.renter')}:</div>
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="font-monospace text-dark text-break">
                      {inspectedRental.renter}
                    </span>
                    <a
                      href={`${explorerBase}/address/${inspectedRental.renter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-decoration-none ms-2"
                      title="View on Etherscan"
                    >
                      <i className="bi bi-box-arrow-up-right"></i>
                    </a>
                  </div>
                </div>

                {inspectedRental.txHash && (
                  <div className="border rounded p-3 bg-light small mb-3">
                    <div className="text-muted mb-1 fw-semibold">
                      {language === 'th' ? 'หลักฐานการทำธุรกรรม (Tx Hash):' : 'Transaction Hash:'}
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="font-monospace text-primary text-break">
                        {inspectedRental.txHash}
                      </span>
                      {inspectedRental.txHash.startsWith('0x') && inspectedRental.txHash.length > 20 && (
                        <a
                          href={`${explorerBase}/tx/${inspectedRental.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-decoration-none ms-2"
                          title="View on Etherscan"
                        >
                          <i className="bi bi-box-arrow-up-right"></i>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Real-time Direct Contract Management Actions */}
                <div className="border rounded p-3 bg-white mt-3 shadow-xs">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small fw-bold text-dark">
                      <i className="bi bi-gear-wide-connected text-primary me-1"></i>
                      {language === 'th' ? 'การจัดการสัญญาเช่าสด (Real-Time Actions):' : 'Direct Agreement Actions:'}
                    </span>
                    <span className="badge bg-success-subtle text-success small">
                      <i className="bi bi-broadcast me-1"></i>
                      {language === 'th' ? 'ทำรายการบนบล็อกเชนสด' : 'Live On-Chain'}
                    </span>
                  </div>

                  {inspectedRental.status === RENTAL_STATUS.ACTIVE ? (
                    <div className="d-flex flex-column gap-2">
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleOpenExtend}
                          className="btn btn-sm btn-primary fw-medium flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 shadow-xs"
                          title={language === 'th' ? 'ต่ออายุระยะเวลาสัญญาเช่า' : 'Extend Rental Duration'}
                        >
                          <i className="bi bi-clock-history"></i>
                          {language === 'th' ? '⏳ ต่ออายุสัญญาเช่า' : 'Extend Lease'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenAction('RETURN')}
                          className="btn btn-sm btn-success fw-medium flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 shadow-xs"
                          title={language === 'th' ? 'ส่งคืนทรัพย์สินและรับเงินมัดจำคืน' : 'Return item and refund deposit'}
                        >
                          <i className="bi bi-arrow-return-left"></i>
                          {language === 'th' ? '📦 ส่งคืนของ (คืนมัดจำ)' : 'Return Item'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenAction('CANCEL')}
                          className="btn btn-sm btn-outline-danger fw-medium flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 shadow-xs"
                          title={language === 'th' ? 'ยกเลิกสัญญาเช่าและรับเงินมัดจำคืนทันที' : 'Cancel rental and refund deposit'}
                        >
                          <i className="bi bi-x-circle"></i>
                          {language === 'th' ? '❌ ยกเลิกสัญญา (คืนมัดจำ)' : 'Cancel & Refund'}
                        </button>
                      </div>

                      <Link
                        href="/my-rentals?status=ACTIVE"
                        className="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-1.5 mt-1"
                      >
                        <i className="bi bi-box-seam"></i>
                        {language === 'th' ? '📦 ดูรายการที่กำลังเช่าทั้งหมด (My Rentals)' : 'View All Active Rentals'}
                      </Link>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      <div className="alert alert-secondary py-2 px-3 small mb-0 d-flex align-items-center gap-2">
                        <i className="bi bi-info-circle text-secondary"></i>
                        <span>
                          {inspectedRental.status === RENTAL_STATUS.CANCELLED
                            ? language === 'th'
                              ? 'สัญญานี้ถูกยกเลิกแล้ว เงินมัดจำโอนคืนกระเป๋าผู้เช่าเรียบร้อยแล้ว'
                              : 'Agreement has been cancelled. Security deposit was refunded.'
                            : language === 'th'
                            ? 'สัญญานี้ส่งคืนทรัพย์สินเรียบร้อยแล้ว เงินมัดจำโอนคืนกระเป๋าผู้เช่าแล้ว'
                            : 'Asset returned and security deposit refunded to renter.'}
                        </span>
                      </div>
                      <Link
                        href="/my-rentals"
                        className="btn btn-sm btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-1.5"
                      >
                        <i className="bi bi-wallet2"></i>
                        {language === 'th' ? 'ไปที่หน้า "การเช่าของฉัน" (My Rentals)' : 'Go to My Rentals'}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Action Modal in Claims (Return / Cancel) */}
      {isActionModalOpen && inspectedRental && (
        <>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
                <div className="modal-header bg-dark text-white py-3">
                  <h5 className="modal-title fw-bold">
                    {actionType === 'RETURN' ? (
                      <>
                        <i className="bi bi-arrow-return-left text-success me-2"></i>
                        {language === 'th' ? 'ยืนยันการส่งคืนทรัพย์สิน' : 'Confirm Asset Return'}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle text-danger me-2"></i>
                        {language === 'th' ? 'ยืนยันการยกเลิกสัญญาเช่า & คืนมัดจำ' : 'Cancel Agreement & Refund Deposit'}
                      </>
                    )}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setIsActionModalOpen(false)}
                    disabled={isProcessingAction}
                  ></button>
                </div>

                <div className="modal-body p-4 bg-white">
                  {actionTxState && (
                    <TransactionStatus
                      status={actionTxState}
                      txHash={actionTxHash}
                      errorMessage={actionError}
                      onReset={() => setActionTxState(null)}
                    />
                  )}

                  {actionError && !actionTxState && (
                    <ErrorMessage error={actionError} onDismiss={() => setActionError(null)} dismissible />
                  )}

                  <p className="text-dark mb-3">
                    {actionType === 'RETURN'
                      ? language === 'th'
                        ? `คุณต้องการส่งคืนทรัพย์สินสำหรับสัญญา #${inspectedRental.rentalId} ใช่หรือไม่?`
                        : `Are you sure you want to return item for agreement #${inspectedRental.rentalId}?`
                      : language === 'th'
                      ? `คุณต้องการยกเลิกสัญญา #${inspectedRental.rentalId} และขอรับเงินมัดจำคืนทันทีใช่หรือไม่?`
                      : `Are you sure you want to cancel agreement #${inspectedRental.rentalId} and refund deposit?`}
                  </p>

                  <div className={`border p-3 rounded-3 mb-3 small ${actionType === 'RETURN' ? 'border-success-subtle bg-success-subtle' : 'border-danger-subtle bg-danger-subtle'}`}>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-dark fw-medium">
                        {language === 'th' ? 'ยอดเงินมัดจำที่จะโอนคืนเข้ากระเป๋า:' : 'Deposit Refund to Wallet:'}
                      </span>
                      <span className="fw-bold font-monospace text-success fs-6">
                        +{inspectedRental.depositEth} ETH
                      </span>
                    </div>
                    <div className="text-secondary small mt-2">
                      <i className="bi bi-shield-check text-success me-1"></i>
                      {language === 'th'
                        ? 'เมื่อยืนยันใน MetaMask ระบบจะสั่งให้ Smart Contract โอนเงินมัดจำความเสียหายคืนเข้ากระเป๋าของคุณทันที'
                        : 'Upon confirmation, the smart contract refunds your locked security deposit back to your wallet.'}
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2.5">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-3"
                    onClick={() => setIsActionModalOpen(false)}
                    disabled={isProcessingAction}
                  >
                    {t('common.close')}
                  </button>
                  <button
                    type="button"
                    className={`btn fw-bold px-4 rounded-3 ${actionType === 'RETURN' ? 'btn-success' : 'btn-danger'}`}
                    onClick={handleExecuteAction}
                    disabled={isProcessingAction || actionTxState === 'confirmed'}
                  >
                    {isProcessingAction ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {language === 'th' ? 'กำลังเซ็นใน MetaMask...' : 'Signing in MetaMask...'}
                      </>
                    ) : actionTxState === 'confirmed' ? (
                      <>
                        <i className="bi bi-check-circle me-1"></i> {language === 'th' ? 'ดำเนินการสำเร็จ' : 'Processed'}
                      </>
                    ) : actionType === 'RETURN' ? (
                      <>
                        <i className="bi bi-arrow-return-left me-1"></i> {language === 'th' ? 'ยืนยันการส่งคืน' : 'Confirm Return'}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle me-1"></i> {language === 'th' ? 'ยืนยันยกเลิก & คืนเงินมัดจำ' : 'Confirm Cancel & Refund'}
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

      {/* Direct Extension Modal in Claims */}
      {isExtendModalOpen && inspectedRental && (
        <>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
                <div className="modal-header bg-dark text-white py-3">
                  <h5 className="modal-title fw-bold d-flex align-items-center">
                    <i className="bi bi-clock-history text-primary me-2"></i>
                    {language === 'th' ? 'ต่ออายุระยะเวลาสัญญาเช่า' : 'Extend Rental Duration'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setIsExtendModalOpen(false)}
                    disabled={isProcessingAction}
                  ></button>
                </div>

                <div className="modal-body p-4 bg-white">
                  {actionTxState && (
                    <TransactionStatus
                      status={actionTxState}
                      txHash={actionTxHash}
                      errorMessage={actionError}
                      onReset={() => setActionTxState(null)}
                    />
                  )}

                  {actionError && !actionTxState && (
                    <ErrorMessage error={actionError} onDismiss={() => setActionError(null)} dismissible />
                  )}

                  <div className="mb-3">
                    <span className="badge bg-secondary font-monospace mb-1">
                      #{inspectedRental.rentalId}
                    </span>
                    <h6 className="fw-bold text-dark mb-1">
                      {inspectedItem?.name || `Item #${inspectedRental.itemId}`}
                    </h6>
                    <div className="text-muted small">
                      {language === 'th' ? 'เวลาสิ้นสุดสัญญาเดิม:' : 'Current End Time:'}{' '}
                      <span className="font-monospace fw-semibold text-dark">
                        {formatDateTime(inspectedRental.endTime, language, true)}
                      </span>
                    </div>
                  </div>

                  {/* Extension Unit and Value */}
                  <div className="card bg-light border p-3 rounded-3 mb-3">
                    <label className="form-label fw-bold small text-dark mb-2">
                      <i className="bi bi-stopwatch text-primary me-1"></i>
                      {language === 'th' ? 'เลือกระยะเวลาที่ต้องการต่อเพิ่ม:' : 'Select Additional Duration:'}
                    </label>

                    {/* Presets */}
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        className={`btn btn-sm ${extendDurationUnit === 'minutes' && extendDurationValue === 2 ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => { setExtendDurationUnit('minutes'); setExtendDurationValue(2); }}
                        disabled={isProcessingAction}
                      >
                        ⚡ +2 {language === 'th' ? 'นาที (Demo)' : 'mins (Demo)'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${extendDurationUnit === 'minutes' && extendDurationValue === 5 ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => { setExtendDurationUnit('minutes'); setExtendDurationValue(5); }}
                        disabled={isProcessingAction}
                      >
                        ⚡ +5 {language === 'th' ? 'นาที (Demo)' : 'mins (Demo)'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${extendDurationUnit === 'hours' && extendDurationValue === 1 ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => { setExtendDurationUnit('hours'); setExtendDurationValue(1); }}
                        disabled={isProcessingAction}
                      >
                        +1 {language === 'th' ? 'ชม.' : 'hr'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${extendDurationUnit === 'days' && extendDurationValue === 1 ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => { setExtendDurationUnit('days'); setExtendDurationValue(1); }}
                        disabled={isProcessingAction}
                      >
                        +1 {language === 'th' ? 'วัน' : 'day'}
                      </button>
                    </div>

                    {/* Input */}
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        min="1"
                        max={extendDurationUnit === 'minutes' ? 720 : 365}
                        className="form-control font-monospace fw-bold"
                        value={extendDurationValue}
                        onChange={(e) => setExtendDurationValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        disabled={isProcessingAction}
                      />
                      <select
                        className="form-select form-select-sm"
                        value={extendDurationUnit}
                        onChange={(e) => setExtendDurationUnit(e.target.value)}
                        disabled={isProcessingAction}
                      >
                        <option value="minutes">{language === 'th' ? 'นาที (Real-time Demo)' : 'Minutes'}</option>
                        <option value="hours">{language === 'th' ? 'ชั่วโมง' : 'Hours'}</option>
                        <option value="days">{language === 'th' ? 'วัน' : 'Days'}</option>
                      </select>
                    </div>
                  </div>

                  {/* Summary of Additional Fee */}
                  <div className="border border-info-subtle bg-info-subtle p-3 rounded-3 mb-2 small">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-dark fw-medium">
                        {language === 'th' ? 'ค่าเช่าเพิ่มเติมที่ต้องชำระ:' : 'Additional Rental Fee:'}
                      </span>
                      <span className="fw-bold font-monospace text-primary fs-6">
                        {(
                          extendDurationUnit === 'minutes'
                            ? Math.max(0.005, (parseFloat(inspectedRental.rentalPriceEth || '0.05') / 1440) * extendDurationValue)
                            : extendDurationUnit === 'hours'
                            ? Math.max(0.01, (parseFloat(inspectedRental.rentalPriceEth || '0.05') / 24) * extendDurationValue)
                            : Math.max(0.05, parseFloat(inspectedRental.rentalPriceEth || '0.05') * extendDurationValue)
                        ).toFixed(4)}{' '}
                        ETH
                      </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center text-muted small">
                      <span>{language === 'th' ? 'เงินมัดจำเดิม (ไม่ต้องจ่ายเพิ่ม):' : 'Deposit (No extra fee):'}</span>
                      <span className="font-monospace text-success fw-semibold">+{inspectedRental.depositEth} ETH (Hold)</span>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2.5">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-3"
                    onClick={() => setIsExtendModalOpen(false)}
                    disabled={isProcessingAction}
                  >
                    {t('common.close')}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary fw-bold px-4 rounded-3"
                    onClick={() => handleExecuteExtend(false)}
                    disabled={isProcessingAction || actionTxState === 'confirmed'}
                  >
                    {isProcessingAction ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {language === 'th' ? 'กำลังเซ็นใน MetaMask...' : 'Signing in MetaMask...'}
                      </>
                    ) : actionTxState === 'confirmed' ? (
                      <>
                        <i className="bi bi-check-circle me-1"></i> {language === 'th' ? 'ต่ออายุสำเร็จแล้ว' : 'Extended Successfully'}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-clock-history me-1"></i>{' '}
                        {language === 'th' ? 'ยืนยันต่ออายุ & ชำระเพิ่ม' : 'Confirm Extension & Pay'}
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
