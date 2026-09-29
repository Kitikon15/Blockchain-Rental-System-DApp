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
    name: 'MacBook Pro 16" Apple M3 Max (36GB Unified RAM / 1TB SSD)',
    description: 'แล็ปท็อปประสิทธิภาพสูงสุดสำหรับงานพัฒนาซอฟต์แวร์, งานประมวลผล AI/ML และตัดต่อวิดีโอ 8K ชิป Apple M3 Max (14-Core CPU, 30-Core GPU) จอภาพ Liquid Retina XDR 120Hz แบตเตอรี่สุขภาพดี 100% พร้อมอุปกรณ์ชาร์จ MagSafe 140W',
    category: 'Laptops & Notebooks',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 20,
  },
  {
    itemId: 2,
    owner: '0x35D628De2C0637f9e80d216503c805aA8272995D',
    name: 'ASUS ROG Zephyrus G16 (Intel Core Ultra 9 / RTX 4090 16GB / 32GB DDR5)',
    description: 'เกมมิ่งโน้ตบุ๊กระดับเรือธงสำหรับโปรแกรมเมอร์และเกมเมอร์ ชิป Intel Core Ultra 9 185H พร้อมการ์ดจอ NVIDIA RTX 4090 แรม 32GB SSD 2TB หน้าจอ OLED 2.5K 240Hz 0.2ms น้ำหนักเบาเพียง 1.95 กก. ระบายความร้อน Vapor Chamber',
    category: 'Laptops & Notebooks',
    rentalPrice: parseEther('0.060'),
    rentalPriceEth: '0.0600',
    deposit: parseEther('0.080'),
    depositEth: '0.0800',
    available: false, // Currently in active rental
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 18,
  },
  {
    itemId: 3,
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    name: 'Lenovo ThinkPad X1 Carbon Gen 12 (Core Ultra 7 / 32GB RAM / 1TB SSD)',
    description: 'โน้ตบุ๊กสายงานธุรกิจและนักพัฒนาซอฟต์แวร์ระดับตำนาน ตัวเครื่องคาร์บอนไฟเบอร์เกรดทหาร ทนทาน น้ำหนักเพียง 1.09 กก. แป้นพิมพ์ ThinkPad Ergonomic คีย์บอร์ดสัมผัสดีเยี่ยม แบตเตอรี่ใช้งานได้ยาวนาน 16 ชั่วโมง',
    category: 'Laptops & Notebooks',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 15,
  },
  {
    itemId: 4,
    owner: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    name: 'Custom AI Deep Learning Rig (AMD Ryzen 9 7950X / Dual RTX 4090 48GB VRAM)',
    description: 'คอมพิวเตอร์เวิร์กสเตชันประกอบพิเศษสำหรับงานเทรนโมเดล AI, LLM และงานวิจัย Machine Learning ติดตั้งการ์ดจอ Dual NVIDIA RTX 4090 รวม 48GB VRAM แรม 128GB DDR5 ระบบระบายความร้อนด้วยน้ำแบบ Custom Loop พาวเวอร์ซัพพลาย 1600W Titanium',
    category: 'Desktops & Workstations',
    rentalPrice: parseEther('0.080'),
    rentalPriceEth: '0.0800',
    deposit: parseEther('0.100'),
    depositEth: '0.1000',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 12,
  },
  {
    itemId: 5,
    owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    name: 'Apple Mac Studio (M2 Ultra 24-Core CPU / 60-Core GPU / 64GB Memory)',
    description: 'เวิร์กสเตชันขนาดกะทัดรัดแต่ทรงพลังอย่างเหลือเชื่อ ชิป M2 Ultra รองรับการประมวลผลงานกราฟิก 3D แรนเดอร์สถาปัตยกรรมและตัดต่อวิดีโอหลายสตรีมพร้อมกัน รองรับการต่อออกจอภาพความละเอียดสูงสูงสุดถึง 8 จอภาพ',
    category: 'Desktops & Workstations',
    rentalPrice: parseEther('0.060'),
    rentalPriceEth: '0.0600',
    deposit: parseEther('0.080'),
    depositEth: '0.0800',
    available: false, // Currently in active rental
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 10,
  },
  {
    itemId: 6,
    owner: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    name: 'Apple Studio Display 27" 5K Retina (Nano-Texture Glass & Tilt Stand)',
    description: 'จอภาพระดับมืออาชีพความละเอียด 5K (5120 x 2880) กระจก Nano-Texture ลดแสงสะท้อน ความสว่าง 600 nits ขอบเขตสีกว้าง P3 พร้อมกล้อง Ultra Wide 12MP รองรับ Center Stage และไมโครโฟน 3 ตัวเกรดสตูดิโอ',
    category: 'Monitors & Displays',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 8,
  },
  {
    itemId: 7,
    owner: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
    name: 'Samsung Odyssey Neo G9 49" Dual QHD Curved 240Hz Mini-LED Monitor',
    description: 'จอโค้งอัลตร้าไวด์ 49 นิ้ว อัตราส่วน 32:9 เทียบเท่าจอ 27 นิ้ววางคู่กันสองจอ ความละเอียด Dual QHD 5120 x 1440 พาเนล Quantum Mini-LED รีเฟรชเรท 240Hz ความโค้ง 1000R เหมาะสำหรับงานเขียนโค้ด งานมัลติทาสก์ และเทรดดิ้ง',
    category: 'Monitors & Displays',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 6,
  },
  {
    itemId: 8,
    owner: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    name: 'Synology DiskStation DS1821+ 8-Bay NAS (64TB Enterprise Storage + 10GbE)',
    description: 'อุปกรณ์จัดเก็บข้อมูลเครือข่ายระดับองค์กร ขนาด 8 ช่อง ติดตั้งฮาร์ดดิสก์ Enterprise รวม 64TB พร้อมการ์ดเครือข่าย 10GbE SFP+ และ NVMe Cache SSD 1TB สำหรับสำรองข้อมูลโปรเจกต์ งานสตูดิโอ และโฮสต์บริการทดสอบในองค์กร',
    category: 'Networking & Servers',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.080'),
    depositEth: '0.0800',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 5,
  },
  {
    itemId: 9,
    owner: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    name: 'Apple Vision Pro 512GB (Spatial Computer & Developer Strap)',
    description: 'แว่นตา Spatial Computer ความละเอียดสูงระดับ 4K Micro-OLED ต่อข้าง ชิป M2 + R1 ควบคุมด้วยสายตาและท่าทางมือ พร้อมสาย Developer Strap สำหรับเชื่อมต่อ Mac พัฒนาแอปพลิเคชัน visionOS และทดสอบ 3D Spatial UI',
    category: 'VR & Gaming Gear',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 4,
  },
  {
    itemId: 10,
    owner: '0x35D628De2C0637f9e80d216503c805aA8272995D',
    name: 'PlayStation 5 Pro 2TB + PS VR2 + DualSense Edge Controller',
    description: 'ชุดคอนโซลและอุปกรณ์ความบันเทิง IT เจนเนอเรชันล่าสุด PS5 Pro ความจุ 2TB รองรับ PlayStation Spectral Super Resolution (PSSR) 4K 120Hz พร้อมแว่น VR2 และคอนโทรลเลอร์รุ่นโปร เหมาะสำหรับจัดแสดงงานเกมหรืองานอีเวนต์ IT',
    category: 'VR & Gaming Gear',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 3,
  },
  {
    itemId: 11,
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    name: 'Cisco Catalyst 9200L 48-Port PoE+ Gigabit Enterprise Switch',
    description: 'สวิตช์เครือข่ายระดับเอ็นเตอร์ไพรส์ 48 พอร์ต Gigabit PoE+ กำลังจ่ายไฟรวม 740W พร้อม 4x 10G SFP+ Uplinks รองรับฟีเจอร์ Layer 3, Cisco DNA Center และความปลอดภัยระดับสูง เหมาะสำหรับจัดตั้งระบบเครือข่ายในงานแข่งขันหรืองานประชุม IT',
    category: 'Networking & Servers',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 2,
  },
  {
    itemId: 12,
    owner: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    name: 'EcoFlow DELTA 2 Max Portable Power Station (2400W / 2048Wh)',
    description: 'สถานีจ่ายไฟสำรองพกพากำลังสูง 2,400W รองรับการจ่ายไฟให้อุปกรณ์เซิร์ฟเวอร์, ตู้แร็คเครือข่ายภาคสนาม และคอมพิวเตอร์เวิร์กสเตชันในกรณีไฟดับหรือจัดงานนอกสถานที่ พร้อมหน้าจอ LCD แสดงผลอัตรากินไฟแบบ Real-Time',
    category: 'Electronics & Gadgets',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 1,
  },
  {
    itemId: 13,
    owner: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
    name: 'Elgato Stream Deck XL + Shure SM7B + RØDECaster Pro II Audio Hub',
    description: 'ชุดอุปกรณ์ควบคุม IT มัลติมีเดียและสตรีมมิ่งระดับมืออาชีพ ประกอบด้วย Stream Deck XL 32 ปุ่ม LCD คัสตอมคำสั่งได้, ไมโครโฟน Shure SM7B พร้อมพรีแอมป์ Cloudlifter และมิกเซอร์ RØDECaster Pro II สำหรับแคสเกม สตรีม และพ็อดคาสต์',
    category: 'Electronics & Gadgets',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000),
  },
  {
    itemId: 14,
    owner: '0x35D628De2C0637f9e80d216503c805aA8272995D',
    name: 'Alienware m18 R2 Gaming Laptop (Intel Core i9-14900HX / RTX 4090 16GB / 64GB DDR5 / 4TB SSD RAID 0)',
    description: 'เกมมิ่งแล็ปท็อปขนาดหน้าจอใหญ่ 18 นิ้ว QHD+ 165Hz ความแรงระดับท็อป ชิป Intel Core i9 Gen 14th คู่กับการ์ดจอ GeForce RTX 4090 แรม 64GB DDR5 และความจุ 4TB SSD RAID 0 รองรับงานคำนวณกราฟิก 3D แรนเดอร์ Unreal Engine 5 และเล่นเกมระดับ 4K Ultra ระบบระบายความร้อน Cryo-tech และสารนำความร้อน Element 31',
    category: 'Laptops & Notebooks',
    rentalPrice: parseEther('0.065'),
    rentalPriceEth: '0.0650',
    deposit: parseEther('0.080'),
    depositEth: '0.0800',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 3,
  },
  {
    itemId: 15,
    owner: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    name: 'Dell Precision 7960 Tower Workstation (Intel Xeon w9-3495X 56-Core / 256GB ECC RAM / NVIDIA RTX 6000 Ada 48GB)',
    description: 'สุดยอดซูเปอร์เวิร์กสเตชันระดับองค์กรสำหรับงานวิจัย AI ขนาดใหญ่ ชิป Intel Xeon w9-3495X (56 คอร์ / 112 เธรด) แรม 256GB DDR5 ECC พร้อมการ์ดจอระดับมืออาชีพ NVIDIA RTX 6000 Ada Generation VRAM 48GB เหมาะสำหรับการเทรน Large Language Model (LLM) และการจำลองฟิสิกส์ชั้นสูง',
    category: 'Desktops & Workstations',
    rentalPrice: parseEther('0.090'),
    rentalPriceEth: '0.0900',
    deposit: parseEther('0.120'),
    depositEth: '0.1200',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 4,
  },
  {
    itemId: 16,
    owner: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    name: 'Apple Pro Display XDR 32" Retina 6K (Nano-Texture Glass + Pro Stand)',
    description: 'หน้าจอแสดงผลระดับ Professional Reference ความละเอียด 6K (6016 x 3384) ขนาด 32 นิ้ว ขอบเขตสีกว้าง P3 10-bit ความสว่างสูงสุด 1600 nits คอนทราสต์เรโช 1,000,000:1 กระจก Nano-Texture ป้องกันแสงสะท้อน พร้อมขาตั้ง Pro Stand ปรับระดับความสูงและหมุนแนวตั้งได้',
    category: 'Monitors & Displays',
    rentalPrice: parseEther('0.070'),
    rentalPriceEth: '0.0700',
    deposit: parseEther('0.080'),
    depositEth: '0.0800',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 2,
  },
  {
    itemId: 17,
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    name: 'Synology DiskStation DS3622xs+ 12-Bay Enterprise NAS (Intel Xeon / 48TB Enterprise Storage / Dual 10GbE)',
    description: 'เซิร์ฟเวอร์จัดเก็บข้อมูลเครือข่าย NAS ระดับ Enterprise 12 ช่อง ติดตั้งฮาร์ดดิสก์ Enterprise รวม 48TB ชิป Intel Xeon 6-Core แรม 32GB ECC พร้อมพอร์ตเชื่อมต่อ Dual 10GbE RJ-45 ความเร็วการอ่านข้อมูลกว่า 4,700 MB/s สำหรับสำรองข้อมูลระดับคลาวด์และโปรเจกต์ทีมขนาดใหญ่',
    category: 'Networking & Servers',
    rentalPrice: parseEther('0.055'),
    rentalPriceEth: '0.0550',
    deposit: parseEther('0.060'),
    depositEth: '0.0600',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 5,
  },
  {
    itemId: 18,
    owner: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
    name: 'HTC VIVE XR Elite Business Edition VR/AR Headset + Full Body Trackers',
    description: 'ชุดแว่นเสมือนจริงแบบไฮบริด VR/XR ความละเอียด 4K 110° FOV น้ำหนักเบาเพียง 625 กรัม รองรับการทำงานแบบ Standalone ไร้สาย และต่อพ่วงกับพีซีเวิร์กสเตชัน พร้อมเซ็นเซอร์ติดตามร่างกาย Full Body Tracker 3 จุด สำหรับงานทดสอบระบบ Metaverse และพัฒนาเกม VR',
    category: 'VR & Gaming Gear',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 3,
  },
  {
    itemId: 19,
    owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    name: 'Ubiquiti UniFi Dream Machine Special Edition (UDM-SE) + Enterprise WiFi 7 AP Suite',
    description: 'เราเตอร์เกตเวย์ความปลอดภัยเครือข่ายความเร็วสูงระดับ 10G SFP+ พร้อม PoE Switch ในตัว รองรับระบบป้องกันการบุกรุก IDS/IPS 3.5 Gbps มาพร้อมชุดเสากระจายสัญญาณ UniFi U7 Pro WiFi 7 Tri-Band ความเร็วสูงสุด 9.3 Gbps เหมาะสำหรับวางระบบโครงข่าย Hackathon หรืองาน Event IT',
    category: 'Networking & Servers',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 1,
  },
  {
    itemId: 20,
    owner: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    name: 'NVIDIA Jetson AGX Orin 64GB Developer Kit (275 TOPS AI Engine)',
    description: 'บอร์ดประมวลผลสมองกล AI Edge Computing ขนาดกะทัดรัด ประสิทธิภาพสูงถึง 275 TOPS สถาปัตยกรรม NVIDIA Ampere 2048-Core พร้อม Tensor Cores แรม 64GB สำหรับพัฒนาระบบหุ่นยนต์อัตโนมัติ (Autonomous Robotics), โดรนอัจฉริยะ และการประมวลผลภาพ Computer Vision แบบ Real-Time',
    category: 'Electronics & Gadgets',
    rentalPrice: parseEther('0.050'),
    rentalPriceEth: '0.0500',
    deposit: parseEther('0.050'),
    depositEth: '0.0500',
    available: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 2,
  },
  {
    itemId: 21,
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    name: 'Framework Laptop 16 Modular Edition (AMD Ryzen 9 7940HS / Radeon RX 7700S / Modular GPU & Ports)',
    description: 'โน้ตบุ๊กนวัตกรรม Modular เพื่อชาวไอทีและฮาร์ดแวร์แฮกเกอร์ สามารถถอดเปลี่ยนการ์ดจอแยก อัปเกรดพอร์ต Expansion Cards (USB-C, USB-A, HDMI, Ethernet, Audio) ได้อิสระ หน้าจอ 16 นิ้ว 165Hz รองรับการติดตั้ง Linux Ubuntu / Arch Linux ได้สมบูรณ์แบบ 100%',
    category: 'Laptops & Notebooks',
    rentalPrice: parseEther('0.055'),
    rentalPriceEth: '0.0550',
    deposit: parseEther('0.060'),
    depositEth: '0.0600',
    available: true,
    createdAt: Math.floor(Date.now() / 1000),
  },
];

/**
 * Generate historical rental records, binding the user's active wallet
 * as the renter for selected records so their personal history is populated.
 */
export function getSeedRentals(userAccount) {
  const currentWallet = userAccount || '0xc7c8b35F368e7E160273a5a40a5015bEc474ED';
  const now = Math.floor(Date.now() / 1000);

  const baseRentals = [
    // 1. Returned & Refunded (Rented by Current User)
    {
      rentalId: 101,
      itemId: 1,
      owner: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
      renter: currentWallet,
      startTime: now - 86400 * 14,
      endTime: now - 86400 * 11,
      rentalPrice: parseEther('0.050'),
      rentalPriceEth: '0.0500',
      deposit: parseEther('0.050'),
      depositEth: '0.0500',
      totalPaid: parseEther('0.200'),
      totalPaidEth: '0.2000',
      status: RENTAL_STATUS.RETURNED,
      createdAt: now - 86400 * 14,
    },
    // 2. Currently Active Rental (Rented by Current User)
    {
      rentalId: 102,
      itemId: 2,
      owner: '0x35D628De2C0637f9e80d216503c805aA8272995D',
      renter: currentWallet,
      startTime: now - 86400 * 1,
      endTime: now + 86400 * 2,
      rentalPrice: parseEther('0.060'),
      rentalPriceEth: '0.0600',
      deposit: parseEther('0.080'),
      depositEth: '0.0800',
      totalPaid: parseEther('0.260'),
      totalPaidEth: '0.2600',
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
      rentalPrice: parseEther('0.050'),
      rentalPriceEth: '0.0500',
      deposit: parseEther('0.050'),
      depositEth: '0.0500',
      totalPaid: parseEther('0.250'),
      totalPaidEth: '0.2500',
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
      rentalPrice: parseEther('0.060'),
      rentalPriceEth: '0.0600',
      deposit: parseEther('0.080'),
      depositEth: '0.0800',
      totalPaid: parseEther('0.260'),
      totalPaidEth: '0.2600',
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
      rentalPrice: parseEther('0.050'),
      rentalPriceEth: '0.0500',
      deposit: parseEther('0.050'),
      depositEth: '0.0500',
      totalPaid: parseEther('0.150'),
      totalPaidEth: '0.1500',
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
      rentalPrice: parseEther('0.080'),
      rentalPriceEth: '0.0800',
      deposit: parseEther('0.100'),
      depositEth: '0.1000',
      totalPaid: parseEther('0.340'),
      totalPaidEth: '0.3400',
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
      rentalPrice: parseEther('0.050'),
      rentalPriceEth: '0.0500',
      deposit: parseEther('0.080'),
      depositEth: '0.0800',
      totalPaid: parseEther('0.130'),
      totalPaidEth: '0.1300',
      status: RENTAL_STATUS.CANCELLED,
      createdAt: now - 86400 * 7,
    },
  ];

  const dynamicRentals = getStoredUserRentals();
  const statusOverrides = getStoredRentalStatusOverrides();
  const timeOverrides = getStoredRentalTimeOverrides();

  const applyOverrides = (r) => {
    let modified = { ...r };
    if (statusOverrides[r.rentalId] !== undefined) {
      modified.status = statusOverrides[r.rentalId];
    }
    if (timeOverrides[r.rentalId]) {
      const { additionalSeconds, additionalFeeEth } = timeOverrides[r.rentalId];
      if (additionalSeconds) {
        modified.endTime = Number(modified.endTime) + Number(additionalSeconds);
      }
      if (additionalFeeEth && parseFloat(additionalFeeEth) > 0) {
        const currentPaid = parseFloat(modified.totalPaidEth || '0');
        const newPaid = (currentPaid + parseFloat(additionalFeeEth)).toFixed(4);
        modified.totalPaidEth = newPaid;
        try {
          modified.totalPaid = parseEther(newPaid);
        } catch (_) {}
      }
    }
    return modified;
  };

  const modifiedBase = baseRentals.map(applyOverrides);
  const modifiedDynamic = dynamicRentals.map(applyOverrides);
  return [...modifiedDynamic, ...modifiedBase];
}

export function serializeRental(rental) {
  if (!rental) return null;
  return {
    rentalId: Number(rental.rentalId),
    itemId: Number(rental.itemId),
    owner: String(rental.owner || ''),
    renter: String(rental.renter || ''),
    startTime: Number(rental.startTime || 0),
    endTime: Number(rental.endTime || 0),
    rentalPriceEth: String(rental.rentalPriceEth || '0.0500'),
    depositEth: String(rental.depositEth || '0.0500'),
    totalPaidEth: String(rental.totalPaidEth || '0.1000'),
    status: Number(rental.status !== undefined ? rental.status : RENTAL_STATUS.ACTIVE),
    createdAt: Number(rental.createdAt || Math.floor(Date.now() / 1000)),
    durationUnit: String(rental.durationUnit || 'days'),
    durationValue: Number(rental.durationValue || 1),
    txHash: rental.txHash ? String(rental.txHash) : null,
    isOnChain: Boolean(rental.isOnChain),
  };
}

export function deserializeRental(rental) {
  if (!rental) return null;
  let rentalPrice = parseEther('0.05');
  let deposit = parseEther('0.05');
  let totalPaid = parseEther('0.10');
  try {
    rentalPrice = parseEther(String(rental.rentalPriceEth || '0.05'));
    deposit = parseEther(String(rental.depositEth || '0.05'));
    totalPaid = parseEther(String(rental.totalPaidEth || '0.10'));
  } catch (_) {}
  return {
    ...rental,
    rentalPrice,
    deposit,
    totalPaid,
  };
}

export function getStoredUserRentals() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('blockrental_dynamic_rentals');
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(deserializeRental).filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

export function getStoredRentalStatusOverrides() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('blockrental_rental_status_overrides');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function getStoredRentalTimeOverrides() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('blockrental_rental_time_overrides');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveUserRental(rental) {
  if (typeof window === 'undefined' || !rental) return;
  try {
    const cleanRental = serializeRental(rental);
    const existing = getStoredUserRentals();
    const filtered = existing.filter((r) => Number(r.rentalId) !== Number(rental.rentalId));
    const updated = [cleanRental, ...filtered.map(serializeRental)];
    localStorage.setItem(
      'blockrental_dynamic_rentals',
      JSON.stringify(updated, (key, value) => (typeof value === 'bigint' ? value.toString() : value))
    );
  } catch (e) {
    console.error('Could not save user rental to localStorage', e);
  }
}

export function updateStoredRentalStatus(rentalId, status) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredUserRentals();
    const isDynamic = existing.some((r) => Number(r.rentalId) === Number(rentalId));
    if (isDynamic) {
      const updated = existing.map((r) => {
        if (Number(r.rentalId) === Number(rentalId)) {
          return serializeRental({ ...r, status: Number(status) });
        }
        return serializeRental(r);
      });
      localStorage.setItem('blockrental_dynamic_rentals', JSON.stringify(updated));
    } else {
      const overrides = getStoredRentalStatusOverrides();
      overrides[rentalId] = Number(status);
      localStorage.setItem('blockrental_rental_status_overrides', JSON.stringify(overrides));
    }
  } catch (e) {
    console.error('Could not update rental status', e);
  }
}

export function extendRentalTime(rentalId, additionalSeconds, additionalFeeEth = '0') {
  if (typeof window === 'undefined') return;
  try {
    const existingDynamic = getStoredUserRentals();
    const isDynamic = existingDynamic.some((r) => Number(r.rentalId) === Number(rentalId));
    if (isDynamic) {
      const updated = existingDynamic.map((r) => {
        if (Number(r.rentalId) === Number(rentalId)) {
          const currentEnd = Number(r.endTime);
          const baseTime = Math.max(currentEnd, Math.floor(Date.now() / 1000));
          const newEnd = baseTime + Number(additionalSeconds);
          const currentPaid = parseFloat(r.totalPaidEth || '0');
          const newPaid = (currentPaid + parseFloat(additionalFeeEth)).toFixed(4);
          return serializeRental({
            ...r,
            endTime: newEnd,
            totalPaidEth: newPaid,
          });
        }
        return serializeRental(r);
      });
      localStorage.setItem('blockrental_dynamic_rentals', JSON.stringify(updated));
    } else {
      const timeOverrides = getStoredRentalTimeOverrides();
      const currentOverride = timeOverrides[rentalId] || { additionalSeconds: 0, additionalFeeEth: '0' };
      timeOverrides[rentalId] = {
        additionalSeconds: Number(currentOverride.additionalSeconds || 0) + Number(additionalSeconds),
        additionalFeeEth: (parseFloat(currentOverride.additionalFeeEth || '0') + parseFloat(additionalFeeEth)).toFixed(4),
      };
      localStorage.setItem('blockrental_rental_time_overrides', JSON.stringify(timeOverrides));
    }
  } catch (e) {
    console.error('Could not extend rental time in localStorage', e);
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

export function mergeRentalsWithSeed(onChainRentals, userAccount) {
  const seedRentals = getSeedRentals(userAccount);
  const statusOverrides = getStoredRentalStatusOverrides();
  const timeOverrides = getStoredRentalTimeOverrides();

  const applyOverrides = (r) => {
    let modified = { ...r };
    if (statusOverrides[r.rentalId] !== undefined) {
      modified.status = statusOverrides[r.rentalId];
    }
    if (timeOverrides[r.rentalId]) {
      const { additionalSeconds, additionalFeeEth } = timeOverrides[r.rentalId];
      if (additionalSeconds) {
        modified.endTime = Number(modified.endTime) + Number(additionalSeconds);
      }
      if (additionalFeeEth && parseFloat(additionalFeeEth) > 0) {
        const currentPaid = parseFloat(modified.totalPaidEth || '0');
        const newPaid = (currentPaid + parseFloat(additionalFeeEth)).toFixed(4);
        modified.totalPaidEth = newPaid;
        try {
          modified.totalPaid = parseEther(newPaid);
        } catch (_) {}
      }
    }
    return modified;
  };

  if (Array.isArray(onChainRentals) && onChainRentals.length > 0) {
    const overriddenOnChain = onChainRentals.map(applyOverrides);
    const onChainIds = new Set(overriddenOnChain.map((r) => Number(r.rentalId)));
    const remainingSeed = seedRentals.filter((r) => !onChainIds.has(Number(r.rentalId)));
    return [...overriddenOnChain, ...remainingSeed];
  }
  return seedRentals;
}
