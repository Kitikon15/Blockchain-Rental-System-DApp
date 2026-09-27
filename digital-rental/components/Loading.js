'use client';

/**
 * Loading component displaying Bootstrap Spinner and descriptive message
 */
export default function Loading({
  message = 'Loading blockchain data...',
  size = 'normal',
  inline = false,
}) {
  const spinnerSizeClass = size === 'small' ? 'spinner-border-sm' : '';

  if (inline) {
    return (
      <span className="d-inline-flex align-items-center text-muted">
        <span
          className={`spinner-border ${spinnerSizeClass} text-primary me-2`}
          role="status"
          aria-hidden="true"
        ></span>
        <span className="small">{message}</span>
      </span>
    );
  }

  return (
    <div className="text-center py-5">
      <div
        className={`spinner-border text-primary ${size === 'large' ? 'style={{ width: "3.5rem", height: "3.5rem" }}' : ''}`}
        role="status"
        style={size === 'large' ? { width: '3.5rem', height: '3.5rem' } : {}}
      >
        <span className="visually-hidden">Loading...</span>
      </div>
      <p className="mt-3 text-secondary fw-medium">{message}</p>
    </div>
  );
}
