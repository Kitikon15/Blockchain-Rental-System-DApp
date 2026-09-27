'use client';

import { DEFAULT_EXPLORER_URL } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';

/**
 * TransactionStatus component
 * Displays live feedback during blockchain write operations:
 * - Waiting for MetaMask signature
 * - Pending confirmation on Sepolia
 * - Confirmed on-chain with verifiable Etherscan link
 * - Failed with revert explanation
 * Supports Thai and English seamlessly.
 */
export default function TransactionStatus({
  status, // 'waiting_approval' | 'pending' | 'confirmed' | 'failed'
  txHash,
  errorMessage,
  onReset,
}) {
  const { t } = useLanguage();

  if (!status) return null;

  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;
  const etherscanLink = txHash ? `${explorerBase}/tx/${txHash}` : null;

  return (
    <div className="card shadow-sm border mb-4">
      <div className="card-body p-4">
        {status === 'waiting_approval' && (
          <div className="text-center py-2">
            <div className="spinner-border text-warning mb-3" role="status">
              <span className="visually-hidden">Waiting for approval...</span>
            </div>
            <h5 className="fw-bold mb-1">{t('tx.waitingTitle')}</h5>
            <p className="text-muted small mb-0">
              {t('tx.waitingDesc')}
            </p>
          </div>
        )}

        {status === 'pending' && (
          <div className="text-center py-2">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Transaction pending...</span>
            </div>
            <h5 className="fw-bold text-primary mb-1">{t('tx.pendingTitle')}</h5>
            <p className="text-muted small mb-3">
              {t('tx.pendingDesc')}
            </p>
            {txHash && (
              <div className="small">
                <span className="text-muted me-2">Tx Hash:</span>
                <code className="text-break bg-light p-1 rounded border me-2">
                  {txHash.substring(0, 14)}...{txHash.substring(txHash.length - 10)}
                </code>
                {etherscanLink && (
                  <a
                    href={etherscanLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-primary"
                  >
                    <i className="bi bi-box-arrow-up-right me-1"></i> {t('tx.viewEtherscan')}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {status === 'confirmed' && (
          <div className="text-center py-2">
            <div className="text-success mb-3 fs-1">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h5 className="fw-bold text-success mb-1">{t('tx.confirmedTitle')}</h5>
            <p className="text-muted small mb-3">
              {t('tx.confirmedDesc')}
            </p>
            {txHash && (
              <div className="d-flex flex-wrap align-items-center justify-content-center gap-2 mb-3">
                <span className="text-muted small">Hash:</span>
                <span className="address-pill">{txHash.substring(0, 16)}...{txHash.substring(txHash.length - 8)}</span>
                {etherscanLink && (
                  <a
                    href={etherscanLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-success"
                  >
                    <i className="bi bi-box-arrow-up-right me-1"></i> {t('tx.viewEtherscan')}
                  </a>
                )}
              </div>
            )}
            {onReset && (
              <button onClick={onReset} className="btn btn-sm btn-outline-secondary">
                <i className="bi bi-arrow-clockwise me-1"></i> {t('tx.newAction')}
              </button>
            )}
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center py-2">
            <div className="text-danger mb-3 fs-1">
              <i className="bi bi-exclamation-triangle-fill"></i>
            </div>
            <h5 className="fw-bold text-danger mb-1">{t('tx.failedTitle')}</h5>
            <p className="text-danger-emphasis small mb-3">
              {errorMessage || 'The transaction could not be completed on the blockchain.'}
            </p>
            {onReset && (
              <button onClick={onReset} className="btn btn-sm btn-outline-danger">
                <i className="bi bi-arrow-repeat me-1"></i> {t('tx.tryAgain')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
