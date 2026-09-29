/**
 * Blockchain-Based Rental System
 * Constants and Platform Configuration
 * Network: Ethereum Sepolia Testnet (Chain ID 11155111)
 */

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_HEX_CHAIN_ID = '0xaa36a7';
export const NETWORK_NAME = 'Sepolia';
export const DEFAULT_EXPLORER_URL = 'https://sepolia.etherscan.io';
export const DEFAULT_RPC_URL = 'https://rpc.sepolia.org';
export const DEFAULT_CONTRACT_ADDRESS = '0xa0F7a17b2e403091F0397B3a8B9f99A8B65A5861';

// Rental status codes corresponding to the smart contract enum
export const RENTAL_STATUS = {
  AVAILABLE: 0,
  PENDING: 1,
  ACTIVE: 2,
  RETURNED: 3,
  CANCELLED: 4,
  COMPLETED: 5,
};

export const RENTAL_STATUS_LABELS = {
  [RENTAL_STATUS.AVAILABLE]: 'Available',
  [RENTAL_STATUS.PENDING]: 'Pending',
  [RENTAL_STATUS.ACTIVE]: 'Active',
  [RENTAL_STATUS.RETURNED]: 'Returned',
  [RENTAL_STATUS.CANCELLED]: 'Cancelled',
  [RENTAL_STATUS.COMPLETED]: 'Completed',
};

export const RENTAL_STATUS_BADGES = {
  [RENTAL_STATUS.AVAILABLE]: 'success',
  [RENTAL_STATUS.PENDING]: 'warning',
  [RENTAL_STATUS.ACTIVE]: 'primary',
  [RENTAL_STATUS.RETURNED]: 'info',
  [RENTAL_STATUS.CANCELLED]: 'secondary',
  [RENTAL_STATUS.COMPLETED]: 'success',
};

// Item categories supported for browsing and registration (IT & Computing Focus)
export const ITEM_CATEGORIES = [
  'Laptops & Notebooks',
  'Desktops & Workstations',
  'Monitors & Displays',
  'Networking & Servers',
  'Electronics & Gadgets',
  'VR & Gaming Gear',
  'Cameras & Media',
  'Other Assets',
];

// Fallback images based on category
export const CATEGORY_ICONS = {
  'Laptops & Notebooks': 'bi-laptop',
  'Desktops & Workstations': 'bi-pc-display-horizontal',
  'Monitors & Displays': 'bi-display',
  'Networking & Servers': 'bi-router',
  'Electronics & Gadgets': 'bi-motherboard',
  'VR & Gaming Gear': 'bi-controller',
  'Cameras & Media': 'bi-camera-video',
  'Other Assets': 'bi-cpu',
};
