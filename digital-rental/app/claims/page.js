'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '../../context/WalletContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchRentalById,
  fetchItemById,
  fetchAllRentals,
  isContractConfigured,
} from '../../lib/contract';
import { formatAddress } from '../../lib/wallet';
import { DEFAULT_EXPLORER_URL } from '../../lib/constants';
import RentalStatus from '../../components/RentalStatus';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

/**
 * Claims & On-Chain Audit Page (app/claims/page.js)
 * Transparent verification tool for renters, owners, and managers to audit
 * blockchain rental agreements, inspect escrow deposit state, and verify return timestamps with i18n support.
 */
export default function ClaimsPage() {
  const { account } = useWallet();
  const { t, language } = useLanguage();

  const [searchId, setSearchId] = useState('');
  const [inspectedRental, setInspectedRental] = useState(null);
  const [inspectedItem, setInspectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableRentals, setAvailableRentals] = useState([]);

  const contractConfigured = isContractConfigured();
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

  // Load available rentals for quick lookup suggestions
  useEffect(() => {
    let isMounted = true;
    async function loadRentals() {
      try {
        const list = await fetchAllRentals(account);
        if (isMounted && Array.isArray(list)) {
          setAvailableRentals(list.slice(0, 6));
        }
      } catch (e) {
        // Non-blocking
      }
    }
    loadRentals();

    // Check for query param ?id=101
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const qId = params.get('id');
        if (qId) {
          inspectAgreementId(qId);
        }
      }
    } catch (e) {}

    return () => {
      isMounted = false;
    };
  }, [account]);

  // Core inspection logic
  const inspectAgreementId = useCallback(
    async (rawId) => {
      const cleaned = String(rawId || '').replace(/^#/, '').trim();
      setSearchId(cleaned);

      if (!cleaned) {
        setError(
          language === 'th'
            ? 'กรุณากรอกรหัสสัญญาเช่าที่เป็นตัวเลขให้ถูกต้อง (เช่น 101, 102)'
            : 'Please enter a valid numeric Rental Agreement ID.'
        );
        return;
      }

      // Check if user entered an address or hash instead of numeric ID
      if (cleaned.startsWith('0x') || (cleaned.length >= 15 && isNaN(Number(cleaned)))) {
        setError(
          language === 'th'
            ? 'ข้อความที่คุณกรอกคือ Wallet Address หรือ Tx Hash กรุณากรอก "รหัสสัญญาเช่า" ที่เป็นตัวเลข (เช่น 101, 102, 1) หรือคลิกเลือกสัญญาตัวอย่างด้านล่าง'
            : 'You entered an address or hash. Please enter a numeric Rental Agreement ID (e.g. 101, 102, 1) or click one of the sample buttons.'
        );
        return;
      }

      const id = parseInt(cleaned, 10);
      if (!id || id <= 0) {
        setError(
          language === 'th'
            ? 'กรุณากรอกรหัสสัญญาเช่าที่เป็นตัวเลขให้ถูกต้อง (เช่น 101, 102)'
            : 'Please enter a valid numeric Rental Agreement ID (e.g. 101, 102).'
        );
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

      setLoading(true);
      setError(null);
      setInspectedRental(null);
      setInspectedItem(null);

      try {
        const rental = await fetchRentalById(id, account);
        if (!rental || rental.rentalId === 0) {
          setError(
            language === 'th'
              ? `ไม่พบสัญญาเช่าหมายเลข #${id} บนระบบบล็อกเชน (กรุณาตรวจสอบรหัสสัญญาในหน้า "การเช่าของฉัน")`
              : `No rental agreement found with ID #${id}. Check your agreement ID in "My Rentals".`
          );
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
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [contractConfigured, language, account]
  );

  const handleInspect = (e) => {
    e.preventDefault();
    inspectAgreementId(searchId);
  };

  // Timestamp calculations
  const nowUnix = Math.floor(Date.now() / 1000);
  const isOverdue =
    inspectedRental && inspectedRental.status === 2 && inspectedRental.endTime < nowUnix;

  // Check if input looks like an address/hash
  const isAddressOrHash =
    searchId.startsWith('0x') || (searchId.length >= 15 && isNaN(Number(searchId)));

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="mb-4 pb-2 border-bottom">
        <h2 className="fw-bold mb-1">{t('claims.title')}</h2>
        <p className="text-muted small mb-0">{t('claims.subtitle')}</p>
      </div>

      {/* Overview Cards */}
      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="card shadow-sm border bg-white h-100 p-4">
            <h5 className="fw-bold text-dark mb-3">
              <i className="bi bi-search text-primary me-2"></i>
              {t('claims.queryCardTitle')}
            </h5>
            <p className="text-muted small mb-3">
              {language === 'th'
                ? 'กรอกหมายเลขรหัสสัญญาเช่า (Rental Agreement ID เช่น 101, 102 หรือ 1) เพื่อดึงข้อมูลสดจาก Smart Contract บน Sepolia'
                : t('claims.queryCardDesc')}
            </p>

            <form onSubmit={handleInspect} className="mb-3">
              <div className="input-group">
                <span className="input-group-text bg-light text-muted fw-bold">#</span>
                <input
                  type="text"
                  className="form-control font-monospace"
                  placeholder={language === 'th' ? 'กรอกรหัสสัญญา เช่น 101, 102' : t('claims.inputPlaceholder')}
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={loading || !searchId.trim()}
                  className="btn btn-primary fw-medium px-4"
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
              <div className="alert alert-warning py-2 px-3 small mb-3 d-flex align-items-start">
                <i className="bi bi-exclamation-triangle-fill text-warning me-2 mt-1 fs-6 flex-shrink-0"></i>
                <div>
                  {language === 'th' ? (
                    <>
                      <strong>แจ้งเตือน:</strong> คุณกำลังกรอก Wallet Address หรือ Hash กรุณากรอก <strong>รหัสสัญญาเช่าที่เป็นตัวเลข</strong> เช่น <code>101</code>, <code>102</code> หรือคลิกปุ่มตัวอย่างด้านล่าง
                    </>
                  ) : (
                    <>
                      <strong>Notice:</strong> You pasted an address/hash. Please enter a numeric <strong>Rental Agreement ID</strong> (e.g. <code>101</code>, <code>102</code>).
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick Sample Buttons */}
            <div className="pt-2 border-top">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="small fw-bold text-secondary">
                  <i className="bi bi-lightning-charge-fill text-warning me-1"></i>
                  {language === 'th' ? 'คลิกเลือกสัญญาเพื่อตรวจสอบทันที:' : 'Quick Select Agreement:'}
                </span>
                <Link href="/my-rentals" className="small text-decoration-none">
                  {language === 'th' ? 'ดูรหัสของฉัน ➔' : 'My Rentals ➔'}
                </Link>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => inspectAgreementId(101)}
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                >
                  <span className="badge bg-secondary">#101</span>
                  <span className="small">{language === 'th' ? 'Sony A7 IV (คืนแล้ว)' : 'Sony A7 (Returned)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => inspectAgreementId(102)}
                  className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                >
                  <span className="badge bg-success">#102</span>
                  <span className="small">{language === 'th' ? 'DJI Mavic 3 (กำลังเช่า)' : 'DJI Mavic (Active)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => inspectAgreementId(103)}
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                >
                  <span className="badge bg-secondary">#103</span>
                  <span className="small">{language === 'th' ? 'MacBook M3 (คืนแล้ว)' : 'MacBook (Returned)'}</span>
                </button>
                {availableRentals
                  .filter((r) => ![101, 102, 103].includes(Number(r.rentalId)))
                  .slice(0, 2)
                  .map((r) => (
                    <button
                      key={r.rentalId}
                      type="button"
                      onClick={() => inspectAgreementId(r.rentalId)}
                      className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                    >
                      <span className="badge bg-primary">#{r.rentalId}</span>
                      <span className="small">{language === 'th' ? 'สัญญาของคุณ' : 'Your Rental'}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card shadow-sm border bg-white h-100 p-4">
            <h5 className="fw-bold text-dark mb-3">
              <i className="bi bi-diagram-3 text-info me-2"></i>
              {t('claims.archTitle')}
            </h5>
            <ul className="list-unstyled d-flex flex-column gap-2 small text-secondary mb-0">
              <li className="d-flex align-items-start">
                <i className="bi bi-check2-circle text-primary me-2 mt-0.5"></i>
                <span>{t('claims.arch1')}</span>
              </li>
              <li className="d-flex align-items-start">
                <i className="bi bi-check2-circle text-primary me-2 mt-0.5"></i>
                <span>{t('claims.arch2')}</span>
              </li>
              <li className="d-flex align-items-start">
                <i className="bi bi-check2-circle text-primary me-2 mt-0.5"></i>
                <span>{t('claims.arch3')}</span>
              </li>
            </ul>
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
          <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-file-earmark-check-fill text-info fs-5"></i>
              <span className="fw-bold fs-5">
                {t('claims.agreementHeader')}
                {inspectedRental.rentalId}
              </span>
            </div>
            <RentalStatus status={inspectedRental.status} />
          </div>

          <div className="card-body p-4">
            <div className="row g-4">
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
                        </Link>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">
                        {language === 'th' ? 'เวลาเริ่มสัญญา:' : 'Start Timestamp:'}
                      </td>
                      <td>
                        {new Date(inspectedRental.startTime * 1000).toLocaleString(
                          language === 'th' ? 'th-TH' : 'en-US'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">
                        {language === 'th' ? 'เวลาครบกำหนด:' : 'End Timestamp:'}
                      </td>
                      <td>
                        {new Date(inspectedRental.endTime * 1000).toLocaleString(
                          language === 'th' ? 'th-TH' : 'en-US'
                        )}{' '}
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
                    {language === 'th' ? 'สถานะเงินมัดจำความเสียหาย (Escrow Deposit):' : 'Security Deposit Status:'}
                  </div>
                  {inspectedRental.status === 2 ? (
                    <span className="badge bg-warning text-dark">
                      <i className="bi bi-lock-fill me-1"></i>
                      {language === 'th'
                        ? 'กำลังล็อกอยู่ใน Smart Contract (จะคืนเมื่อส่งมอบของ)'
                        : 'Locked in Smart Contract Bytecode'}
                    </span>
                  ) : inspectedRental.status === 3 ? (
                    <span className="badge bg-success">
                      <i className="bi bi-check-circle-fill me-1"></i>
                      {language === 'th'
                        ? 'ปลดล็อกและโอนคืนกระเป๋าผู้เช่าเรียบร้อยแล้ว 100%'
                        : 'Refunded to Renter Wallet'}
                    </span>
                  ) : (
                    <span className="badge bg-secondary">
                      {language === 'th' ? 'สิ้นสุดสัญญาแล้ว' : 'Terminated'}
                    </span>
                  )}
                </div>
              </div>

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
                  <div className="border rounded p-3 bg-light small">
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
