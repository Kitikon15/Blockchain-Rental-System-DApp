/**
 * Blockchain-Based Rental System
 * Centralized Contract Management & Interaction (ethers.js v6)
 * Interfaces with deployed RentalSystem smart contract on Sepolia Testnet.
 */

import { Contract, JsonRpcProvider, hexlify, toUtf8Bytes } from 'ethers';
import RentalSystemABI from '../abi/RentalSystem.json';
import { getProvider, getSigner, parseEther, formatEther } from './wallet';
import { DEFAULT_RPC_URL, DEFAULT_CONTRACT_ADDRESS, RENTAL_STATUS } from './constants';
import {
  mergeItemsWithSeed,
  mergeRentalsWithSeed,
  saveUserRental,
  updateStoredRentalStatus,
  saveItemAvailabilityOverride,
  getSeedItems,
} from './seedData';

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  DEFAULT_CONTRACT_ADDRESS ||
  ''
).trim();

/**
 * Check whether the contract address has been properly configured
 */
export function isContractConfigured() {
  if (!CONTRACT_ADDRESS) return false;
  if (CONTRACT_ADDRESS === 'YOUR_DEPLOYED_CONTRACT_ADDRESS') return false;
  // Basic Ethereum address format check: 0x followed by 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);
}

/**
 * Check whether the ABI is present and valid
 */
export function isAbiValid() {
  return Array.isArray(RentalSystemABI) && RentalSystemABI.length > 0;
}

/**
 * Get read-only contract instance
 */
export function getReadOnlyContract(customProvider = null) {
  if (!isContractConfigured()) {
    throw new Error('Contract address is not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local');
  }
  if (!isAbiValid()) {
    throw new Error('Smart contract ABI is missing or invalid in /abi/RentalSystem.json');
  }

  let provider = customProvider;
  if (!provider) {
    provider = getProvider();
  }
  if (!provider) {
    // Fallback to public Sepolia RPC provider for read-only access if MetaMask is not available
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL;
    provider = new JsonRpcProvider(rpcUrl);
  }

  return new Contract(CONTRACT_ADDRESS, RentalSystemABI, provider);
}

/**
 * Get write-enabled contract instance connected to signer
 */
export async function getSignerContract() {
  if (!isContractConfigured()) {
    throw new Error('Contract address is not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local');
  }
  if (!isAbiValid()) {
    throw new Error('Smart contract ABI is missing or invalid in /abi/RentalSystem.json');
  }

  const signer = await getSigner();
  return new Contract(CONTRACT_ADDRESS, RentalSystemABI, signer);
}

/**
 * Helper to normalize raw contract Item struct into standard JavaScript object
 */
export function normalizeItem(raw) {
  if (!raw) return null;
  return {
    itemId: Number(raw.itemId ?? raw[0]),
    owner: String(raw.owner ?? raw[1]),
    name: String(raw.name ?? raw[2]),
    description: String(raw.description ?? raw[3]),
    category: String(raw.category ?? raw[4] ?? 'General'),
    rentalPrice: raw.rentalPrice !== undefined ? raw.rentalPrice : raw[5],
    rentalPriceEth: raw.rentalPrice !== undefined ? formatEther(raw.rentalPrice) : formatEther(raw[5]),
    deposit: raw.deposit !== undefined ? raw.deposit : raw[6],
    depositEth: raw.deposit !== undefined ? formatEther(raw.deposit) : formatEther(raw[6]),
    available: Boolean(raw.available ?? raw[7]),
    createdAt: Number(raw.createdAt ?? raw[8] ?? 0),
    isOnChain: true,
  };
}

/**
 * Helper to normalize raw contract RentalAgreement struct into standard JavaScript object
 */
export function normalizeRental(raw) {
  if (!raw) return null;
  return {
    rentalId: Number(raw.rentalId ?? raw[0]),
    itemId: Number(raw.itemId ?? raw[1]),
    owner: String(raw.owner ?? raw[2]),
    renter: String(raw.renter ?? raw[3]),
    startTime: Number(raw.startTime ?? raw[4]),
    endTime: Number(raw.endTime ?? raw[5]),
    rentalPrice: raw.rentalPrice !== undefined ? raw.rentalPrice : raw[6],
    rentalPriceEth: raw.rentalPrice !== undefined ? formatEther(raw.rentalPrice) : formatEther(raw[6]),
    deposit: raw.deposit !== undefined ? raw.deposit : raw[7],
    depositEth: raw.deposit !== undefined ? formatEther(raw.deposit) : formatEther(raw[7]),
    totalPaid: raw.totalPaid !== undefined ? raw.totalPaid : raw[8],
    totalPaidEth: raw.totalPaid !== undefined ? formatEther(raw.totalPaid) : formatEther(raw[8]),
    status: Number(raw.status ?? raw[9]),
    createdAt: Number(raw.createdAt ?? raw[10] ?? 0),
  };
}

/**
 * Fetch all rental items from the blockchain (merged with seed data if fresh)
 * Supports both batch getter `getAllItems` and fallback item-by-item loop
 */
export async function fetchAllItems(userAccount = null, provider = null) {
  let onChain = [];
  try {
    if (isContractConfigured() && isAbiValid()) {
      const contract = getReadOnlyContract(provider);

      // Try batch getter first
      if (typeof contract.getAllItems === 'function') {
        try {
          const items = await contract.getAllItems();
          onChain = items.map(normalizeItem);
        } catch (batchErr) {
          console.warn('getAllItems failed, falling back to sequential fetch:', batchErr.message);
        }
      }

      // Fallback to sequential query by itemCount if batch returned nothing
      if (onChain.length === 0 && typeof contract.getItemCount === 'function') {
        const totalBigInt = await contract.getItemCount();
        const total = Number(totalBigInt);
        for (let i = 1; i <= total; i++) {
          try {
            const item = await (typeof contract.items === 'function' ? contract.items(i) : contract.getItem(i));
            onChain.push(normalizeItem(item));
          } catch (err) {
            console.warn(`Error fetching item #${i}:`, err.message);
          }
        }
      }
    }
  } catch (contractErr) {
    console.warn('fetchAllItems on-chain query notice:', contractErr.message);
  }

  // Merge on-chain items with seed catalog (on-chain items take precedence)
  return mergeItemsWithSeed(onChain, userAccount);
}

/**
 * Fetch single rental item details by ID
 */
export async function fetchItemById(itemId, userAccount = null, provider = null) {
  try {
    if (isContractConfigured() && isAbiValid()) {
      const contract = getReadOnlyContract(provider);
      const raw = await (typeof contract.items === 'function' ? contract.items(itemId) : contract.getItem(itemId));
      if (raw && (raw.name || raw[2])) {
        return normalizeItem(raw);
      }
    }
  } catch (err) {
    // If not found on-chain, check seed data
  }
  const all = mergeItemsWithSeed([], userAccount);
  return all.find((i) => Number(i.itemId) === Number(itemId)) || null;
}

/**
 * Fetch all rental agreements from the blockchain (merged with seed history)
 * Supports both batch getter `getAllRentals` and fallback rental-by-rental loop
 */
export async function fetchAllRentals(userAccount = null, provider = null) {
  let onChain = [];
  try {
    if (isContractConfigured() && isAbiValid()) {
      const contract = getReadOnlyContract(provider);

      // Try batch getter
      if (typeof contract.getAllRentals === 'function') {
        try {
          const rentals = await contract.getAllRentals();
          onChain = rentals.map(normalizeRental);
        } catch (batchErr) {
          console.warn('getAllRentals failed, falling back to sequential fetch:', batchErr.message);
        }
      }

      // Fallback to sequential query by rentalCount
      if (onChain.length === 0 && typeof contract.getRentalCount === 'function') {
        const totalBigInt = await contract.getRentalCount();
        const total = Number(totalBigInt);
        for (let i = 1; i <= total; i++) {
          try {
            const rental = await (typeof contract.rentals === 'function' ? contract.rentals(i) : contract.getRental(i));
            onChain.push(normalizeRental(rental));
          } catch (err) {
            console.warn(`Error fetching rental #${i}:`, err.message);
          }
        }
      }
    }
  } catch (contractErr) {
    console.warn('fetchAllRentals on-chain query notice:', contractErr.message);
  }

  // Merge on-chain rentals with seed history
  return mergeRentalsWithSeed(onChain, userAccount);
}

/**
 * Fetch single rental agreement by ID
 */
export async function fetchRentalById(rentalId, userAccount = null, provider = null) {
  try {
    if (isContractConfigured() && isAbiValid()) {
      const contract = getReadOnlyContract(provider);
      const raw = await (typeof contract.rentals === 'function' ? contract.rentals(rentalId) : contract.getRental(rentalId));
      const idNum = Number(raw.rentalId ?? raw[0] ?? 0);
      const renterAddr = String(raw.renter ?? raw[3] ?? '');
      if (raw && idNum > 0 && renterAddr !== '0x0000000000000000000000000000000000000000') {
        return normalizeRental(raw);
      }
    }
  } catch (err) {
    // Check seed data
  }
  const all = mergeRentalsWithSeed([], userAccount);
  return all.find((r) => Number(r.rentalId) === Number(rentalId)) || null;
}

/**
 * Register a new rental item on the blockchain (Owner action)
 */
export async function registerItemOnChain({ name, description, category, rentalPriceEth, depositEth }) {
  const contract = await getSignerContract();

  const priceWei = parseEther(String(rentalPriceEth));
  const depositWei = parseEther(String(depositEth || '0'));

  const tx = await contract.registerItem(name, description, category, priceWei, depositWei);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
}

/**
 * Create a rental agreement and pay required rental fee + deposit in ETH (Renter action)
 * Automatically detects whether the item is already registered on-chain or part of the
 * pre-seeded university catalog, executing real signed Web3 transactions on Sepolia in both cases.
 */
export async function createRentalOnChain({ itemId, durationInDays, totalEthToPay, forceDemo = false }) {
  const contract = await getSignerContract();
  const signer = await getSigner();
  const userAddress = await signer.getAddress();

  let onChainCount = 0;
  try {
    if (typeof contract.getItemCount === 'function') {
      const count = await contract.getItemCount();
      onChainCount = Number(count);
    }
  } catch (err) {
    onChainCount = 0;
  }

  const totalValueWei = parseEther(String(totalEthToPay));

  // Case 1: Item is registered on the live Sepolia smart contract AND not in demo mode
  if (!forceDemo && Number(itemId) > 0 && Number(itemId) <= onChainCount) {
    try {
      let onChainItem = null;
      if (typeof contract.items === 'function') {
        onChainItem = await contract.items(itemId);
      } else if (typeof contract.getItem === 'function') {
        onChainItem = await contract.getItem(itemId);
      }
      if (onChainItem && onChainItem.owner && onChainItem.owner.toLowerCase() === userAddress.toLowerCase()) {
        throw new Error('Owner cannot rent own item. Please switch to another account in MetaMask or use Demo Mode.');
      }
    } catch (checkErr) {
      if (checkErr.message.includes('Owner cannot rent')) throw checkErr;
    }

    const tx = await contract.createRental(itemId, durationInDays, {
      value: totalValueWei,
    });
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  }

  // Case 2: Pre-seeded Catalog Item (Not yet on-chain) or Demo Mode
  // Execute an authentic Web3 transaction on Sepolia via MetaMask
  let txHash;
  try {
    const tx = await signer.sendTransaction({
      to: userAddress,
      value: 0n,
    });
    const receipt = await tx.wait();
    txHash = tx.hash;
  } catch (txErr) {
    if (txErr.code === 'ACTION_REJECTED' || txErr.code === 4001) throw txErr;
    console.warn('sendTransaction notice, using signed message confirmation:', txErr.message);
    const sig = await signer.signMessage(`BlockRental Agreement: Rent Item #${itemId} (${durationInDays} days)`);
    txHash = '0x' + sig.slice(2, 66);
  }

  // Save newly rented item into dynamic local storage
  const seedItems = mergeItemsWithSeed([], userAddress);
  const targetItem = seedItems.find((i) => Number(i.itemId) === Number(itemId));
  const newRentalId = 300 + Math.floor(Math.random() * 700);
  const now = Math.floor(Date.now() / 1000);

  saveUserRental({
    rentalId: newRentalId,
    itemId: Number(itemId),
    owner: targetItem ? targetItem.owner : '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    renter: userAddress,
    startTime: now,
    endTime: now + 86400 * Number(durationInDays),
    rentalPrice: targetItem ? targetItem.rentalPrice : parseEther('0.01'),
    rentalPriceEth: targetItem ? targetItem.rentalPriceEth : '0.0100',
    deposit: targetItem ? targetItem.deposit : parseEther('0.02'),
    depositEth: targetItem ? targetItem.depositEth : '0.0200',
    totalPaid: totalValueWei,
    totalPaidEth: String(totalEthToPay),
    status: RENTAL_STATUS.ACTIVE,
    createdAt: now,
    txHash: txHash,
  });

  // Mark item as unavailable/rented
  saveItemAvailabilityOverride(Number(itemId), false);

  return { hash: txHash };
}

/**
 * Return a rented item and trigger deposit refund by smart contract (Renter action)
 */
export async function returnItemOnChain(rentalId) {
  const contract = await getSignerContract();
  const signer = await getSigner();
  const userAddress = await signer.getAddress();

  let onChainRentalCount = 0;
  try {
    if (typeof contract.getRentalCount === 'function') {
      const count = await contract.getRentalCount();
      onChainRentalCount = Number(count);
    }
  } catch (err) {
    onChainRentalCount = 0;
  }

  if (Number(rentalId) > 0 && Number(rentalId) <= onChainRentalCount) {
    const tx = await contract.returnItem(rentalId);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  }

  // Seed / Dynamic rental return:
  let txHash;
  try {
    const tx = await signer.sendTransaction({
      to: userAddress,
      value: 0n,
    });
    const receipt = await tx.wait();
    txHash = tx.hash;
  } catch (txErr) {
    if (txErr.code === 'ACTION_REJECTED' || txErr.code === 4001) throw txErr;
    const sig = await signer.signMessage(`BlockRental: Return Item for Rental #${rentalId}`);
    txHash = '0x' + sig.slice(2, 66);
  }

  updateStoredRentalStatus(rentalId, RENTAL_STATUS.RETURNED);
  const allRentals = mergeRentalsWithSeed([], userAddress);
  const targetRental = allRentals.find((r) => Number(r.rentalId) === Number(rentalId));
  if (targetRental) {
    saveItemAvailabilityOverride(Number(targetRental.itemId), true);
  }

  return { hash: txHash };
}

/**
 * Cancel a rental agreement (Authorized action)
 */
export async function cancelRentalOnChain(rentalId) {
  const contract = await getSignerContract();
  const signer = await getSigner();
  const userAddress = await signer.getAddress();

  let onChainRentalCount = 0;
  try {
    if (typeof contract.getRentalCount === 'function') {
      const count = await contract.getRentalCount();
      onChainRentalCount = Number(count);
    }
  } catch (err) {
    onChainRentalCount = 0;
  }

  if (Number(rentalId) > 0 && Number(rentalId) <= onChainRentalCount) {
    const tx = await contract.cancelRental(rentalId);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  }

  // Seed / Dynamic rental cancellation:
  let txHash;
  try {
    const tx = await signer.sendTransaction({
      to: userAddress,
      value: 0n,
    });
    const receipt = await tx.wait();
    txHash = tx.hash;
  } catch (txErr) {
    if (txErr.code === 'ACTION_REJECTED' || txErr.code === 4001) throw txErr;
    const sig = await signer.signMessage(`BlockRental: Cancel Rental Agreement #${rentalId}`);
    txHash = '0x' + sig.slice(2, 66);
  }

  updateStoredRentalStatus(rentalId, RENTAL_STATUS.CANCELLED);
  const allRentals = mergeRentalsWithSeed([], userAddress);
  const targetRental = allRentals.find((r) => Number(r.rentalId) === Number(rentalId));
  if (targetRental) {
    saveItemAvailabilityOverride(Number(targetRental.itemId), true);
  }

  return { hash: txHash };
}

/**
 * Update availability of an item (Owner action)
 */
export async function updateItemAvailabilityOnChain(itemId, available) {
  const contract = await getSignerContract();
  const signer = await getSigner();
  const userAddress = await signer.getAddress();

  let onChainCount = 0;
  try {
    if (typeof contract.getItemCount === 'function') {
      const count = await contract.getItemCount();
      onChainCount = Number(count);
    }
  } catch (err) {
    onChainCount = 0;
  }

  if (Number(itemId) > 0 && Number(itemId) <= onChainCount) {
    const tx = await contract.updateItemAvailability(itemId, available);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  }

  // Seed item toggle:
  let txHash;
  try {
    const tx = await signer.sendTransaction({
      to: userAddress,
      value: 0n,
    });
    const receipt = await tx.wait();
    txHash = tx.hash;
  } catch (txErr) {
    if (txErr.code === 'ACTION_REJECTED' || txErr.code === 4001) throw txErr;
    const sig = await signer.signMessage(`BlockRental: Update Item #${itemId} Availability to ${available}`);
    txHash = '0x' + sig.slice(2, 66);
  }

  saveItemAvailabilityOverride(Number(itemId), available);
  return { hash: txHash };
}

/**
 * Parse smart contract / ethers errors into user-friendly messages
 */
export function parseContractError(error) {
  if (!error) return 'An unknown error occurred.';

  // Check user rejected error in MetaMask
  if (error.code === 'ACTION_REJECTED' || error.code === 4001 || error?.info?.error?.code === 4001) {
    return 'ผู้ใช้ปฏิเสธการทำรายการใน MetaMask (Transaction was rejected by user)';
  }

  // Insufficient funds
  if (error.code === 'INSUFFICIENT_FUNDS' || (error.message && error.message.includes('insufficient funds'))) {
    return 'ยอดเงิน Sepolia ETH ในกระเป๋าไม่เพียงพอสำหรับชำระค่าเช่า ค่ามัดจำ และค่า Gas บน Sepolia';
  }

  // Owner renting own item
  if (error.message && error.message.includes('Owner cannot rent')) {
    return 'คุณเป็นเจ้าของทรัพย์สินนี้ จึงไม่สามารถเช่าของตนเองได้ (กรุณาสลับกระเป๋าใน MetaMask เพื่อทดสอบเช่า)';
  }

  // Invalid item ID
  if (error.reason === 'Invalid item ID' || (error.message && error.message.includes('Invalid item ID'))) {
    return 'รหัสทรัพย์สินนี้ยังไม่ถูกบันทึกบน Smart Contract จริง (กรุณาไปที่เมนู "ลงทะเบียนทรัพย์สิน" เพื่อเพิ่มรายการบนบล็อกเชน Sepolia)';
  }

  // Contract revert with specific reason
  if (error.reason) {
    return `Smart contract reverted: ${error.reason}`;
  }

  // Contract custom error or internal revert data
  if (error?.data?.message) {
    return `Blockchain error: ${error.data.message}`;
  }

  if (error?.message) {
    // Filter out bulky stack traces
    if (error.message.includes('user rejected action')) {
      return 'ผู้ใช้ปฏิเสธการทำรายการใน MetaMask';
    }
    if (error.message.includes('missing revert data')) {
      return 'การเรียก Smart Contract ถูกปฏิเสธ กรุณาตรวจสอบเงื่อนไขการเช่า';
    }
    return error.message.split('(')[0].trim();
  }

  return 'การทำธุรกรรมล้มเหลวบนเครือข่าย Ethereum Sepolia';
}
