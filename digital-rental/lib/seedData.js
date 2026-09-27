/**
 * Blockchain-Based Rental System
 * Initial Pre-seeded Asset Catalog & Comprehensive Rental History
 * Provides rich, realistic data for university demo and academic capstone evaluation.
 */

import { parseEther, formatEther } from 'ethers';
import { RENTAL_STATUS } from './constants';

export const SEED_ITEMS = [
  {
    itemId: 1,
    owner: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    name: 'Sony Alpha 7 IV Full-Frame Camera + 28-70mm Kit',
    description: 'กล้องฟูลเฟรม 33MP ระดับโปรสำหรับงานภาพนิ่งและวิดีโอ 4K 60p เซ็นเซอร์ Exmor R BSI พร้อมเลนส์ Kit 28-70mm สภาพใหม่ 99% แบตเตอรี่ 2 ก้อน เมมโมรี่การ์ด 128GB',
    category: 'Cameras & Media',
    rentalPrice: parseEther('0.015'),
    rentalPriceEth: '0.0150',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 20,
  },
  {
    itemId: 2,
    owner: '0x35D628De2C0637f9e80d216503c805aA8272995D',
    name: 'DJI Mavic 3 Pro Cine Drone (Triple Camera System)',
    description: 'โดรนถ่ายภาพทางอากาศระดับภาพยนตร์ กล้อง Hasselblad 3 ระยะ บินได้นาน 43 นาที ระบบส่งสัญญาณ O3+ ไกล 15 กม. เซ็นเซอร์หลบหลีกรอบทิศทาง พร้อมรีโมทจอสัมผัส RC Pro',
    category: 'Cameras & Media',
    rentalPrice: parseEther('0.025'),
    rentalPriceEth: '0.0250',
    deposit: parseEther('0.080'),
    depositEth: '0.0800',
    available: false, // Currently in active rental
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 18,
  },
  {
    itemId: 3,
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    name: 'MacBook Pro 16" Apple M3 Max (36GB RAM / 1TB SSD)',
    description: 'แล็ปท็อปประสิทธิภาพสูงสุดสำหรับตัดต่อวิดีโอ 8K งานเรนเดอร์โมเดล 3D และงานวิจัย AI จอภาพ Liquid Retina XDR พร้อมซอฟต์แวร์ลิขสิทธิ์ครบชุด แบตเตอรี่สุขภาพดี 100%',
    category: 'Electronics & Gadgets',
    rentalPrice: parseEther('0.030'),
    rentalPriceEth: '0.0300',
    deposit: parseEther('0.100'),
    depositEth: '0.1000',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 15,
  },
  {
    itemId: 4,
    owner: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    name: 'Segway Ninebot KickScooter Max G2 (Suspension)',
    description: 'สกู๊ตเตอร์ไฟฟ้าระยะไกล มอเตอร์ 900W พร้อมโช้คอัพไฮดรอลิกหน้า-หลัง วิ่งได้ไกล 70 กม. ต่อการชาร์จ ความเร็วสูงสุด 35 กม./ชม. ระบบเบรกหน้าดรัม หลังไฟฟ้า E-ABS',
    category: 'Vehicles & Transport',
    rentalPrice: parseEther('0.010'),
    rentalPriceEth: '0.0100',
    deposit: parseEther('0.030'),
    depositEth: '0.0300',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 12,
  },
  {
    itemId: 5,
    owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    name: 'Coleman Darkroom 4-Person Camping Full Set',
    description: 'ชุดเต็นท์แคมป์ปิ้งขนาด 4 คน เทคโนโลยี Darkroom ป้องกันแสงและลดอุณหภูมิ กันน้ำ 3,000 มม. พร้อมโต๊ะสนาม เก้าอี้พับ 4 ตัว เตาแก๊สปิกนิก และชุดเครื่องครัวสนามครบชุด',
    category: 'Sports & Recreation',
    rentalPrice: parseEther('0.008'),
    rentalPriceEth: '0.0080',
    deposit: parseEther('0.020'),
    depositEth: '0.0200',
    available: false, // Currently in active rental
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 10,
  },
  {
    itemId: 6,
    owner: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    name: 'Bosch Professional Wall Scanner D-tect 200 C',
    description: 'เครื่องสแกนและตรวจสอบโครงสร้างผนังคอนกรีตระดับมืออาชีพ ตรวจหาท่อเหล็ก สายไฟที่มีไฟฟ้า ท่อพลาสติก และวัตถุในความลึกสูงสุด 200 มม. พร้อมเลเซอร์วัดระยะ 50 ม.',
    category: 'Tools & Equipment',
    rentalPrice: parseEther('0.006'),
    rentalPriceEth: '0.0060',
    deposit: parseEther('0.015'),
    depositEth: '0.0150',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 8,
  },
  {
    itemId: 7,
    owner: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
    name: 'Taylor 214ce Plus Acoustic-Electric Guitar',
    description: 'กีตาร์โปร่งไฟฟ้าระดับพรีเมียม ไม้หน้า Solid Sitka Spruce ด้านหลัง Rosewood พร้อมระบบปิ๊กอัพ Expression System 2 ให้เสียงเป็นธรรมชาติ ทัชชิ่งเล่นง่าย พร้อมเคสแข็ง Aerocase',
    category: 'Musical Instruments',
    rentalPrice: parseEther('0.012'),
    rentalPriceEth: '0.0120',
    deposit: parseEther('0.040'),
    depositEth: '0.0400',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 6,
  },
  {
    itemId: 8,
    owner: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    name: 'Creator Studio Space (Soundproof & RGB Lighting)',
    description: 'สตูดิโอบันทึกเสียงและถ่ายทำวิดีโอระดับมืออาชีพ ผนังซับเสียง Acoustic Foam พร้อมไฟสตูดิโอ Aputure 3 ดวง ไมโครโฟน Shure SM7B พรีแอมป์ Focusrite และฉากหลัง 4 สี',
    category: 'Real Estate & Spaces',
    rentalPrice: parseEther('0.040'),
    rentalPriceEth: '0.0400',
    deposit: parseEther('0.080'),
    depositEth: '0.0800',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 5,
  },
];

/**
 * Generate historical rental records, binding the user's active wallet
 * as the renter for selected records so their personal history is populated.
 */
export function getSeedRentals(userAccount) {
  const currentWallet = userAccount || '0xc7c8b35F368e7E160273a5a40a5015bEc474ED';
  const now = Math.floor(Date.now() / 1000);

  return [
    // 1. Returned & Refunded (Rented by Current User)
    {
      rentalId: 101,
      itemId: 1,
      owner: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
      renter: currentWallet,
      startTime: now - 86400 * 14,
      endTime: now - 86400 * 11,
      rentalPrice: parseEther('0.015'),
      rentalPriceEth: '0.0150',
      deposit: parseEther('0.050'),
      depositEth: '0.0500',
      totalPaid: parseEther('0.095'),
      totalPaidEth: '0.0950',
      status: RENTAL_STATUS.RETURNED,
      createdAt: now - 86400 * 14,
    },
    // 2. Currently Active Rental (Rented by Peer)
    {
      rentalId: 102,
      itemId: 2,
      owner: '0x35D628De2C0637f9e80d216503c805aA8272995D',
      renter: '0x71CB05EE1b1F506fF321Da3dac38f25c0c9ce6E1',
      startTime: now - 86400 * 1,
      endTime: now + 86400 * 2,
      rentalPrice: parseEther('0.025'),
      rentalPriceEth: '0.0250',
      deposit: parseEther('0.080'),
      depositEth: '0.0800',
      totalPaid: parseEther('0.155'),
      totalPaidEth: '0.1550',
      status: RENTAL_STATUS.ACTIVE,
      createdAt: now - 86400 * 1,
    },
    // 3. Returned & Refunded (Rented by Current User)
    {
      rentalId: 103,
      itemId: 3,
      owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      renter: currentWallet,
      startTime: now - 86400 * 9,
      endTime: now - 86400 * 5,
      rentalPrice: parseEther('0.030'),
      rentalPriceEth: '0.0300',
      deposit: parseEther('0.100'),
      depositEth: '0.1000',
      totalPaid: parseEther('0.220'),
      totalPaidEth: '0.2200',
      status: RENTAL_STATUS.RETURNED,
      createdAt: now - 86400 * 9,
    },
    // 4. Currently Active Rental (Rented by Peer)
    {
      rentalId: 104,
      itemId: 5,
      owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      renter: '0x52bC88E39d150Ac49495c2763f03bDb8Fe87A13B',
      startTime: now - 86400 * 2,
      endTime: now + 86400 * 1,
      rentalPrice: parseEther('0.008'),
      rentalPriceEth: '0.0080',
      deposit: parseEther('0.020'),
      depositEth: '0.0200',
      totalPaid: parseEther('0.044'),
      totalPaidEth: '0.0440',
      status: RENTAL_STATUS.ACTIVE,
      createdAt: now - 86400 * 2,
    },
    // 5. Returned & Refunded (Rented by Peer)
    {
      rentalId: 105,
      itemId: 7,
      owner: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
      renter: '0xa48D5Fa01e35C3f2C259eE4bC3F079F496B10901',
      startTime: now - 86400 * 12,
      endTime: now - 86400 * 10,
      rentalPrice: parseEther('0.012'),
      rentalPriceEth: '0.0120',
      deposit: parseEther('0.040'),
      depositEth: '0.0400',
      totalPaid: parseEther('0.064'),
      totalPaidEth: '0.0640',
      status: RENTAL_STATUS.RETURNED,
      createdAt: now - 86400 * 12,
    },
    // 6. Returned & Refunded (Rented by Current User)
    {
      rentalId: 106,
      itemId: 4,
      owner: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      renter: currentWallet,
      startTime: now - 86400 * 22,
      endTime: now - 86400 * 19,
      rentalPrice: parseEther('0.010'),
      rentalPriceEth: '0.0100',
      deposit: parseEther('0.030'),
      depositEth: '0.0300',
      totalPaid: parseEther('0.060'),
      totalPaidEth: '0.0600',
      status: RENTAL_STATUS.RETURNED,
      createdAt: now - 86400 * 22,
    },
    // 7. Cancelled Agreement
    {
      rentalId: 107,
      itemId: 8,
      owner: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
      renter: '0x618E7F25D6c2436A1Fe5262276C7a8bFE32D9D2a',
      startTime: now - 86400 * 7,
      endTime: now - 86400 * 6,
      rentalPrice: parseEther('0.040'),
      rentalPriceEth: '0.0400',
      deposit: parseEther('0.080'),
      depositEth: '0.0800',
      totalPaid: parseEther('0.120'),
      totalPaidEth: '0.1200',
      status: RENTAL_STATUS.CANCELLED,
      createdAt: now - 86400 * 7,
    },
  ];

  const dynamicRentals = getStoredUserRentals();
  return [...dynamicRentals, ...baseRentals];
}

export function getStoredUserRentals() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('blockrental_dynamic_rentals');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveUserRental(rental) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredUserRentals();
    const updated = [rental, ...existing];
    localStorage.setItem('blockrental_dynamic_rentals', JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not save user rental to localStorage', e);
  }
}

export function updateStoredRentalStatus(rentalId, status) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredUserRentals();
    const updated = existing.map((r) =>
      Number(r.rentalId) === Number(rentalId) ? { ...r, status } : r
    );
    localStorage.setItem('blockrental_dynamic_rentals', JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not update rental status', e);
  }
}

export function getStoredItemOverrides() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('blockrental_item_overrides');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveItemAvailabilityOverride(itemId, available) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredItemOverrides();
    existing[itemId] = available;
    localStorage.setItem('blockrental_item_overrides', JSON.stringify(existing));
  } catch (e) {
    console.warn('Could not save item override', e);
  }
}

export function getSeedItems(userAccount) {
  const overrides = getStoredItemOverrides();
  return SEED_ITEMS.map((item) => {
    let modified = { ...item, isOnChain: false };
    if (overrides[item.itemId] !== undefined) {
      modified.available = overrides[item.itemId];
    }
    return modified;
  });
}

/**
 * Merge on-chain items with seed items (on-chain items always take precedence)
 */
export function mergeItemsWithSeed(onChainItems, userAccount) {
  const seedItems = getSeedItems(userAccount);
  if (Array.isArray(onChainItems) && onChainItems.length > 0) {
    const onChainIds = new Set(onChainItems.map((i) => Number(i.itemId)));
    const remainingSeed = seedItems.filter((i) => !onChainIds.has(Number(i.itemId)));
    return [...onChainItems, ...remainingSeed];
  }
  return seedItems;
}

/**
 * Merge on-chain rentals with seed rentals
 */
export function mergeRentalsWithSeed(onChainRentals, userAccount) {
  const seedRentals = getSeedRentals(userAccount);
  if (Array.isArray(onChainRentals) && onChainRentals.length > 0) {
    const onChainIds = new Set(onChainRentals.map((r) => Number(r.rentalId)));
    const remainingSeed = seedRentals.filter((r) => !onChainIds.has(Number(r.rentalId)));
    return [...onChainRentals, ...remainingSeed];
  }
  return seedRentals;
}
