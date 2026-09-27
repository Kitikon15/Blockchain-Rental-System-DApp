'use client';

/**
 * ErrorMessage component
 * Translates low-level Web3 and Smart Contract errors into friendly, actionable UI alerts
 */
export default function ErrorMessage({
  error,
  title = 'Blockchain Notice',
  onRetry = null,
  dismissible = false,
  onDismiss = null,
}) {
  if (!error) return null;

  let message = typeof error === 'string' ? error : error.message || 'An unexpected error occurred.';
  let icon = 'bi-exclamation-triangle-fill';
  let alertVariant = 'danger';
  let actionHint = null;

  // Pattern detection for standard Web3 situations
  if (message.includes('MetaMask is not installed') || message.includes('No Ethereum browser')) {
    title = 'MetaMask Extension Required';
    alertVariant = 'warning';
    icon = 'bi-wallet2';
    actionHint = (
      <div className="mt-2">
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm btn-outline-dark"
        >
          <i className="bi bi-box-arrow-up-right me-1"></i> Install MetaMask
        </a>
      </div>
    );
  } else if (message.includes('Sepolia') || message.includes('network') || message.includes('chain')) {
    title = 'Network Mismatch';
    alertVariant = 'warning';
    icon = 'bi-diagram-3';
  } else if (message.includes('Contract address is not configured') || message.includes('YOUR_DEPLOYED_CONTRACT_ADDRESS')) {
    title = 'Contract Not Configured';
    alertVariant = 'info';
    icon = 'bi-gear-fill';
    message = 'The RentalSystem smart contract address has not been set yet. Please deploy the contract using Remix IDE to Sepolia and update NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local.';
  } else if (message.includes('rejected') || message.includes('4001')) {
    title = 'Signature Cancelled';
    alertVariant = 'secondary';
    icon = 'bi-x-circle';
    message = 'You cancelled or rejected the transaction request in MetaMask.';
  } else if (message.includes('insufficient funds') || message.includes('INSUFFICIENT_FUNDS')) {
    title = 'Insufficient Sepolia ETH';
    alertVariant = 'warning';
    icon = 'bi-coin';
    message = 'Your wallet does not have enough Sepolia ETH to cover this transaction and the network gas fee.';
    actionHint = (
      <div className="mt-2">
        <a
          href="https://sepoliafaucet.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm btn-outline-primary"
        >
          <i className="bi bi-droplet-half me-1"></i> Get Free Sepolia ETH
        </a>
      </div>
    );
  }

  return (
    <div className={`alert alert-${alertVariant} d-flex align-items-start shadow-sm border`} role="alert">
      <div className="me-3 fs-4 text-opacity-75">
        <i className={`bi ${icon}`}></i>
      </div>
      <div className="flex-grow-1">
        <h6 className="alert-heading fw-bold mb-1">{title}</h6>
        <div className="small mb-0">{message}</div>
        {actionHint}
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-sm btn-outline-secondary mt-2"
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Try Again
          </button>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          className="btn-close"
          aria-label="Close"
          onClick={onDismiss}
        ></button>
      )}
    </div>
  );
}
