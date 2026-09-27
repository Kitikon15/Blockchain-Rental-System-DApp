'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '../../context/WalletContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  registerItemOnChain,
  isContractConfigured,
  parseContractError,
} from '../../lib/contract';
import { ITEM_CATEGORIES } from '../../lib/constants';
import TransactionStatus from '../../components/TransactionStatus';
import ErrorMessage from '../../components/ErrorMessage';

/**
 * Register Rental Item Page (app/register/page.js)
 * Allows asset owners to register rentable equipment or properties directly
 * into the Smart Contract state on Ethereum Sepolia with i18n support.
 */
export default function RegisterItemPage() {
  const { account, isSepolia, connect, switchNetwork } = useWallet();
  const { t, language } = useLanguage();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: ITEM_CATEGORIES[0],
    description: '',
    rentalPriceEth: '',
    depositEth: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Blockchain Transaction States
  const [txState, setTxState] = useState(null); // 'waiting_approval' | 'pending' | 'confirmed' | 'failed'
  const [txHash, setTxHash] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const contractConfigured = isContractConfigured();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = t('register.validationName');
    if (!formData.description.trim()) errors.description = t('register.validationDesc');

    const price = parseFloat(formData.rentalPriceEth);
    if (!formData.rentalPriceEth || isNaN(price) || price <= 0) {
      errors.rentalPriceEth = t('register.validationPrice');
    }

    if (formData.depositEth !== '') {
      const dep = parseFloat(formData.depositEth);
      if (isNaN(dep) || dep < 0) {
        errors.depositEth = t('register.validationDeposit');
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!account) {
      await connect();
      return;
    }

    if (!isSepolia) {
      await switchNetwork();
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setTxState('waiting_approval');

    try {
      // Execute on-chain item registration via signer
      const { hash } = await registerItemOnChain({
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        rentalPriceEth: formData.rentalPriceEth,
        depositEth: formData.depositEth || '0',
      });

      setTxHash(hash);
      setTxState('confirmed');

      // Reset form on success
      setFormData({
        name: '',
        category: ITEM_CATEGORIES[0],
        description: '',
        rentalPriceEth: '',
        depositEth: '',
      });
    } catch (err) {
      console.error('Registration failed:', err);
      const friendlyErr = parseContractError(err);
      setErrorMessage(friendlyErr);
      setTxState('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetTx = () => {
    setTxState(null);
    setTxHash(null);
    setErrorMessage(null);
  };

  return (
    <div className="container py-4" style={{ maxWidth: '820px' }}>
      {/* Header */}
      <div className="mb-4 pb-2 border-bottom">
        <h2 className="fw-bold mb-1">{t('register.title')}</h2>
        <p className="text-muted small mb-0">
          {t('register.subtitle')}
        </p>
      </div>

      {/* Contract configuration notice */}
      {!contractConfigured && (
        <div className="alert alert-info shadow-sm mb-4">
          <div className="d-flex align-items-center">
            <i className="bi bi-info-circle-fill fs-5 text-primary me-3"></i>
            <div>
              <strong>{language === 'th' ? 'ต้องกำหนด Contract Address:' : 'Contract Setup Required:'}</strong>{' '}
              {language === 'th'
                ? 'เพื่อลงทะเบียนทรัพย์สินบน Sepolia จริง กรุณา Deploy สัญญาผ่าน Remix IDE แล้วระบุ NEXT_PUBLIC_CONTRACT_ADDRESS ใน .env.local'
                : 'To register items on the live testnet, deploy the contract via Remix IDE to Sepolia and update NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local.'}
            </div>
          </div>
        </div>
      )}

      {/* Wallet Status Banner */}
      {!account ? (
        <div className="alert alert-warning shadow-sm d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div className="d-flex align-items-center">
            <i className="bi bi-wallet2 fs-4 me-3"></i>
            <div>
              <h6 className="fw-bold mb-0">{t('register.connectRequiredTitle')}</h6>
              <div className="small text-muted">
                {t('register.connectRequiredDesc')}
              </div>
            </div>
          </div>
          <button onClick={connect} className="btn btn-warning fw-bold btn-sm">
            {t('nav.connectWallet')}
          </button>
        </div>
      ) : !isSepolia ? (
        <div className="alert alert-danger shadow-sm d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div className="d-flex align-items-center">
            <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
            <div>
              <h6 className="fw-bold mb-0">{t('register.wrongNetworkTitle')}</h6>
              <div className="small">{t('register.wrongNetworkDesc')}</div>
            </div>
          </div>
          <button onClick={switchNetwork} className="btn btn-danger fw-bold btn-sm">
            {t('nav.switchToSepolia')}
          </button>
        </div>
      ) : null}

      {/* Live Transaction Status Alert */}
      {txState && (
        <TransactionStatus
          status={txState}
          txHash={txHash}
          errorMessage={errorMessage}
          onReset={handleResetTx}
        />
      )}

      {errorMessage && !txState && (
        <ErrorMessage error={errorMessage} onDismiss={() => setErrorMessage(null)} dismissible />
      )}

      {/* Main Registration Form Card */}
      <div className="card shadow-sm border bg-white">
        <div className="card-header bg-light py-3 d-flex justify-content-between align-items-center">
          <h5 className="fw-bold text-dark mb-0">
            <i className="bi bi-pencil-square text-primary me-2"></i>
            {t('register.formCardTitle')}
          </h5>
          <span className="badge bg-secondary-subtle text-secondary small">{t('register.badgeOnChain')}</span>
        </div>

        <div className="card-body p-4">
          <form onSubmit={handleSubmit} noValidate>
            {/* Item Name */}
            <div className="mb-3">
              <label htmlFor="name" className="form-label fw-bold small text-dark">
                {t('register.itemNameLabel')} <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className={`form-control ${formErrors.name ? 'is-invalid' : ''}`}
                placeholder={t('register.itemNamePlaceholder')}
                value={formData.name}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {formErrors.name && <div className="invalid-feedback">{formErrors.name}</div>}
            </div>

            {/* Category and Price Row */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label htmlFor="category" className="form-label fw-bold small text-dark">
                  {t('register.categoryLabel')} <span className="text-danger">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  className="form-select"
                  value={formData.category}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  {ITEM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {t(`categories.${cat}`) || cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label htmlFor="rentalPriceEth" className="form-label fw-bold small text-dark">
                  {t('register.dailyRateLabel')} <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light font-monospace">ETH</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    id="rentalPriceEth"
                    name="rentalPriceEth"
                    className={`form-control font-monospace ${formErrors.rentalPriceEth ? 'is-invalid' : ''}`}
                    placeholder="0.01"
                    value={formData.rentalPriceEth}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  {formErrors.rentalPriceEth && (
                    <div className="invalid-feedback">{formErrors.rentalPriceEth}</div>
                  )}
                </div>
                <div className="form-text small">{t('register.dailyRateHelp')}</div>
              </div>
            </div>

            {/* Security Deposit */}
            <div className="mb-3">
              <label htmlFor="depositEth" className="form-label fw-bold small text-dark">
                {t('register.depositLabel')} <span className="text-muted fw-normal">{t('register.depositOptional')}</span>
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light font-monospace">ETH</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  id="depositEth"
                  name="depositEth"
                  className={`form-control font-monospace ${formErrors.depositEth ? 'is-invalid' : ''}`}
                  placeholder="0.02"
                  value={formData.depositEth}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {formErrors.depositEth && (
                  <div className="invalid-feedback">{formErrors.depositEth}</div>
                )}
              </div>
              <div className="form-text small">
                {t('register.depositHelp')}
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              <label htmlFor="description" className="form-label fw-bold small text-dark">
                {t('register.descLabel')} <span className="text-danger">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows="4"
                className={`form-control ${formErrors.description ? 'is-invalid' : ''}`}
                placeholder={t('register.descPlaceholder')}
                value={formData.description}
                onChange={handleChange}
                disabled={isSubmitting}
              ></textarea>
              {formErrors.description && (
                <div className="invalid-feedback">{formErrors.description}</div>
              )}
            </div>

            {/* Blockchain Confirmation Guidance */}
            <div className="alert alert-secondary small mb-4 py-2.5">
              <i className="bi bi-shield-check text-success me-2"></i>
              {t('register.guidanceNote')}
            </div>

            {/* Submit Button */}
            <div className="d-flex flex-wrap gap-3 align-items-center">
              <button
                type="submit"
                disabled={isSubmitting || !account || !isSepolia}
                className="btn btn-primary fw-bold px-4 py-2.5 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    {t('common.submitting')}
                  </>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-up me-2"></i>
                    {t('register.btnRegisterSubmit')}
                  </>
                )}
              </button>

              <Link href="/rentals" className="btn btn-outline-secondary py-2.5">
                {t('register.btnCancel')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
