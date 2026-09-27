'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useWallet } from '../context/WalletContext';
import { useLanguage } from '../context/LanguageContext';
import { isContractConfigured } from '../lib/contract';
import { SEPOLIA_CHAIN_ID, NETWORK_NAME } from '../lib/constants';

/**
 * Home Page (app/page.js)
 * Clean, modern Web3 UI with bilingual support (Thai & English)
 */
export default function HomePage() {
  const { account, connect, isConnecting } = useWallet();
  const { t, language } = useLanguage();
  const contractReady = isContractConfigured();

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const solidityContractCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RentalSystem is Ownable, ReentrancyGuard {
    enum RentalStatus { None, Active, Returned, Cancelled }

    struct Item {
        uint256 itemId;
        address payable owner;
        string name;
        string description;
        string category;
        uint256 rentalPrice;
        uint256 deposit;
        bool available;
        uint256 createdAt;
    }

    struct RentalAgreement {
        uint256 rentalId;
        uint256 itemId;
        address payable owner;
        address payable renter;
        uint256 startTime;
        uint256 endTime;
        uint256 rentalPrice;
        uint256 deposit;
        uint256 totalPaid;
        RentalStatus status;
        uint256 createdAt;
    }

    uint256 private _itemCounter;
    uint256 private _rentalCounter;

    mapping(uint256 => Item) public items;
    mapping(uint256 => RentalAgreement) public rentals;

    event ItemRegistered(uint256 indexed itemId, address indexed owner, string name, string category, uint256 rentalPrice, uint256 deposit);
    event ItemAvailabilityUpdated(uint256 indexed itemId, bool available);
    event RentalCreated(uint256 indexed rentalId, uint256 indexed itemId, address indexed renter, uint256 startTime, uint256 endTime, uint256 totalPaid, uint256 deposit);
    event ItemReturned(uint256 indexed rentalId, uint256 indexed itemId, address indexed renter, uint256 returnedTime, uint256 depositRefunded);
    event RentalCancelled(uint256 indexed rentalId, uint256 indexed itemId, address indexed renter, uint256 refundAmount);

    constructor() Ownable(msg.sender) {}

    function getItemCount() external view returns (uint256) { return _itemCounter; }
    function getRentalCount() external view returns (uint256) { return _rentalCounter; }

    function registerItem(string calldata name, string calldata description, string calldata category, uint256 rentalPrice, uint256 deposit) external returns (uint256) {
        require(bytes(name).length > 0, "Item name cannot be empty");
        require(rentalPrice > 0, "Rental price must be greater than zero");
        _itemCounter++;
        items[_itemCounter] = Item(_itemCounter, payable(msg.sender), name, description, category, rentalPrice, deposit, true, block.timestamp);
        emit ItemRegistered(_itemCounter, msg.sender, name, category, rentalPrice, deposit);
        return _itemCounter;
    }

    function updateItemAvailability(uint256 itemId, bool available) external {
        require(itemId > 0 && itemId <= _itemCounter, "Invalid item ID");
        require(items[itemId].owner == msg.sender, "Only owner can update availability");
        items[itemId].available = available;
        emit ItemAvailabilityUpdated(itemId, available);
    }

    function createRental(uint256 itemId, uint256 durationInDays) external payable nonReentrant returns (uint256) {
        require(itemId > 0 && itemId <= _itemCounter, "Invalid item ID");
        require(durationInDays > 0, "Duration must be at least 1 day");
        Item storage item = items[itemId];
        require(item.available, "Item is currently not available for rent");
        require(item.owner != msg.sender, "Owner cannot rent their own item");
        uint256 rentalCost = item.rentalPrice * durationInDays;
        uint256 requiredTotal = rentalCost + item.deposit;
        require(msg.value >= requiredTotal, "Insufficient payment sent");
        item.available = false;
        _rentalCounter++;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + (durationInDays * 1 days);
        rentals[_rentalCounter] = RentalAgreement(_rentalCounter, itemId, item.owner, payable(msg.sender), startTime, endTime, item.rentalPrice, item.deposit, msg.value, RentalStatus.Active, block.timestamp);
        (bool feeSent, ) = item.owner.call{value: rentalCost}("");
        require(feeSent, "Failed to send rental fee to owner");
        emit RentalCreated(_rentalCounter, itemId, msg.sender, startTime, endTime, msg.value, item.deposit);
        return _rentalCounter;
    }

    function returnItem(uint256 rentalId) external nonReentrant {
        require(rentalId > 0 && rentalId <= _rentalCounter, "Invalid rental ID");
        RentalAgreement storage agreement = rentals[rentalId];
        require(agreement.renter == msg.sender, "Only renter can trigger return");
        require(agreement.status == RentalStatus.Active, "Rental agreement is not active");
        agreement.status = RentalStatus.Returned;
        items[agreement.itemId].available = true;
        uint256 depositRefund = agreement.deposit;
        if (depositRefund > 0) {
            (bool refundSuccess, ) = agreement.renter.call{value: depositRefund}("");
            require(refundSuccess, "Deposit refund failed");
        }
        emit ItemReturned(rentalId, agreement.itemId, msg.sender, block.timestamp, depositRefund);
    }

    function cancelRental(uint256 rentalId) external nonReentrant {
        require(rentalId > 0 && rentalId <= _rentalCounter, "Invalid rental ID");
        RentalAgreement storage agreement = rentals[rentalId];
        require(agreement.renter == msg.sender || agreement.owner == msg.sender, "Not authorized to cancel");
        require(agreement.status == RentalStatus.Active, "Rental agreement is not active");
        agreement.status = RentalStatus.Cancelled;
        items[agreement.itemId].available = true;
        uint256 refundAmount = agreement.deposit;
        if (refundAmount > 0) {
            (bool refundSuccess, ) = agreement.renter.call{value: refundAmount}("");
            require(refundSuccess, "Refund failed");
        }
        emit RentalCancelled(rentalId, agreement.itemId, agreement.renter, refundAmount);
    }

    function getAllItems() external view returns (Item[] memory) {
        Item[] memory allItems = new Item[](_itemCounter);
        for (uint256 i = 1; i <= _itemCounter; i++) {
            allItems[i - 1] = items[i];
        }
        return allItems;
    }

    function getAllRentals() external view returns (RentalAgreement[] memory) {
        RentalAgreement[] memory allRentals = new RentalAgreement[](_rentalCounter);
        for (uint256 i = 1; i <= _rentalCounter; i++) {
            allRentals[i - 1] = rentals[i];
        }
        return allRentals;
    }
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(solidityContractCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const workflowIcons = [
    { icon: 'bi-wallet2', color: 'text-primary' },
    { icon: 'bi-box-seam', color: 'text-info' },
    { icon: 'bi-cpu', color: 'text-primary' },
    { icon: 'bi-search', color: 'text-secondary' },
    { icon: 'bi-file-earmark-lock', color: 'text-warning' },
    { icon: 'bi-cash-coin', color: 'text-success' },
    { icon: 'bi-broadcast', color: 'text-primary' },
    { icon: 'bi-arrow-return-left', color: 'text-success' },
  ];

  return (
    <div>
      {/* Contract Configuration Notice with Interactive Guide & Dismiss Button */}
      {!contractReady && !bannerDismissed && (
        <div className="setup-banner py-2 px-3">
          <div className="container d-flex flex-wrap align-items-center justify-content-between gap-2 small">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-info-circle-fill text-info fs-6"></i>
              <span>
                {language === 'th' ? (
                  <>
                    <strong>การติดตั้ง Smart Contract:</strong> นำสัญญาไป Deploy บน Sepolia ผ่าน Remix IDE แล้วระบุ <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> ใน <code>.env.local</code>
                  </>
                ) : (
                  <>
                    <strong>Smart Contract Setup:</strong> Deploy contract to Sepolia via Remix IDE and configure <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> in <code>.env.local</code>
                  </>
                )}
              </span>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="btn btn-xs btn-outline-info rounded-pill py-0.5 px-2.5 small fw-semibold"
              >
                <i className="bi bi-book me-1"></i>
                {language === 'th' ? 'ดูขั้นตอนแก้ไข / Deploy' : 'Setup Guide'}
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="btn btn-xs btn-link text-white-50 p-1 text-decoration-none"
                title={language === 'th' ? 'ปิดการแจ้งเตือนนี้' : 'Dismiss notice'}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="hero-gradient text-white">
        <div className="container py-4">
          <div className="row align-items-center gy-4">
            <div className="col-lg-7">
              <div className="d-inline-flex align-items-center gap-2 badge bg-dark bg-opacity-50 text-info border border-info border-opacity-25 px-3 py-1.5 rounded-pill mb-3">
                <span className="pulse-indicator"></span>
                <span className="small">{t('home.networkBadge')}</span>
              </div>

              <h1 className="hero-title mb-3">
                {t('home.heroTitle')}
              </h1>

              <p className="lead text-light opacity-90 mb-4" style={{ maxWidth: '620px', fontSize: '1.05rem', lineHeight: '1.7' }}>
                {t('home.heroSubtitle')}
              </p>

              {/* Action Buttons - Cleanly Aligned Row */}
              <div className="d-flex flex-wrap gap-2.5 pt-1">
                {!account ? (
                  <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="btn btn-info px-4 py-2.5 fw-bold text-dark shadow-sm rounded-3 d-flex align-items-center"
                  >
                    <i className="bi bi-wallet2 me-2"></i>
                    {isConnecting ? t('nav.connecting') : t('home.btnConnect')}
                  </button>
                ) : (
                  <Link
                    href="/dashboard"
                    className="btn btn-info px-4 py-2.5 fw-bold text-dark shadow-sm rounded-3 d-flex align-items-center"
                  >
                    <i className="bi bi-speedometer2 me-2"></i> {t('home.btnDashboard')}
                  </Link>
                )}

                <Link
                  href="/rentals"
                  className="btn btn-outline-light px-3.5 py-2.5 fw-medium rounded-3 d-flex align-items-center"
                >
                  <i className="bi bi-grid me-2"></i> {t('home.btnBrowse')}
                </Link>

                <Link
                  href="/my-rentals"
                  className="btn btn-outline-info px-3.5 py-2.5 fw-medium rounded-3 d-flex align-items-center"
                >
                  <i className="bi bi-bag-check me-2"></i> {t('home.btnMyRentals')}
                </Link>
              </div>
            </div>

            {/* Hero Visual Card */}
            <div className="col-lg-5">
              <div className="glass-card text-dark p-4 rounded-4">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-3">
                  <div className="d-flex align-items-center gap-2">
                    <div className="rounded-3 bg-primary bg-opacity-10 text-primary p-2 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px' }}>
                      <i className="bi bi-shield-lock-fill fs-5"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0">{t('home.contractStateTitle')}</h6>
                      <span className="small text-muted font-monospace">Sepolia Verified</span>
                    </div>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1">
                    {t('home.decentralizedBadge')}
                  </span>
                </div>

                <div className="small text-muted mb-3">
                  {t('home.contractStateDesc')}
                </div>

                <div className="d-flex flex-column gap-2 mb-3">
                  <div className="d-flex justify-content-between align-items-center p-2 rounded-3 bg-light border">
                    <span className="small fw-medium text-secondary">
                      <i className="bi bi-file-earmark-lock text-primary me-2"></i>
                      {t('home.feat1Title')}
                    </span>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                      {t('home.feat1Desc')}
                    </span>
                  </div>

                  <div className="d-flex justify-content-between align-items-center p-2 rounded-3 bg-light border">
                    <span className="small fw-medium text-secondary">
                      <i className="bi bi-safe text-success me-2"></i>
                      {t('home.feat2Title')}
                    </span>
                    <span className="badge bg-success-subtle text-success border border-success-subtle small">
                      {t('home.feat2Desc')}
                    </span>
                  </div>

                  <div className="d-flex justify-content-between align-items-center p-2 rounded-3 bg-light border">
                    <span className="small fw-medium text-secondary">
                      <i className="bi bi-person-badge text-info me-2"></i>
                      {t('home.feat3Title')}
                    </span>
                    <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle small">
                      {t('home.feat3Desc')}
                    </span>
                  </div>

                  <div className="d-flex justify-content-between align-items-center p-2 rounded-3 bg-light border">
                    <span className="small fw-medium text-secondary">
                      <i className="bi bi-cash-coin text-warning me-2"></i>
                      {t('home.feat4Title')}
                    </span>
                    <span className="badge bg-secondary-subtle text-secondary small">
                      {t('home.feat4Desc')}
                    </span>
                  </div>
                </div>

                <Link href="/register" className="btn btn-primary w-100 fw-bold py-2 rounded-3 shadow-sm d-flex align-items-center justify-content-center">
                  <i className="bi bi-plus-circle me-1.5"></i> {t('home.btnRegisterAsset')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement vs Blockchain Solution */}
      <section className="py-5 bg-white border-bottom">
        <div className="container">
          <div className="text-center mb-5">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1.5 rounded-pill text-uppercase fw-bold small">
              {t('home.whyBlockchainTag')}
            </span>
            <h2 className="fw-bold mt-2">{t('home.comparisonTitle')}</h2>
            <p className="text-muted" style={{ maxWidth: '720px', margin: '0 auto', fontSize: '0.95rem' }}>
              {t('home.comparisonSubtitle')}
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-6">
              <div className="card h-100 border-danger-subtle bg-danger-subtle bg-opacity-10 p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="rounded-circle bg-danger text-white p-2.5 me-3 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
                    <i className="bi bi-x-octagon fs-5"></i>
                  </div>
                  <h5 className="fw-bold text-danger mb-0">{t('home.tradProblemsTitle')}</h5>
                </div>
                <ul className="list-unstyled mb-0 d-flex flex-column gap-2.5 small text-secondary">
                  <li className="d-flex align-items-start">
                    <i className="bi bi-dash-circle text-danger me-2 mt-1"></i>
                    <span>{t('home.tradP1')}</span>
                  </li>
                  <li className="d-flex align-items-start">
                    <i className="bi bi-dash-circle text-danger me-2 mt-1"></i>
                    <span>{t('home.tradP2')}</span>
                  </li>
                  <li className="d-flex align-items-start">
                    <i className="bi bi-dash-circle text-danger me-2 mt-1"></i>
                    <span>{t('home.tradP3')}</span>
                  </li>
                  <li className="d-flex align-items-start">
                    <i className="bi bi-dash-circle text-danger me-2 mt-1"></i>
                    <span>{t('home.tradP4')}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100 border-success-subtle bg-success-subtle bg-opacity-10 p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="rounded-circle bg-success text-white p-2.5 me-3 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
                    <i className="bi bi-check-circle fs-5"></i>
                  </div>
                  <h5 className="fw-bold text-success mb-0">{t('home.solTitle')}</h5>
                </div>
                <ul className="list-unstyled mb-0 d-flex flex-column gap-2.5 small text-secondary">
                  <li className="d-flex align-items-start">
                    <i className="bi bi-check2 text-success me-2 mt-1 fs-6"></i>
                    <span>{t('home.solP1')}</span>
                  </li>
                  <li className="d-flex align-items-start">
                    <i className="bi bi-check2 text-success me-2 mt-1 fs-6"></i>
                    <span>{t('home.solP2')}</span>
                  </li>
                  <li className="d-flex align-items-start">
                    <i className="bi bi-check2 text-success me-2 mt-1 fs-6"></i>
                    <span>{t('home.solP3')}</span>
                  </li>
                  <li className="d-flex align-items-start">
                    <i className="bi bi-check2 text-success me-2 mt-1 fs-6"></i>
                    <span>{t('home.solP4')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Rental Workflow Stepper */}
      <section className="py-5 bg-light border-bottom">
        <div className="container">
          <div className="text-center mb-5">
            <span className="badge bg-secondary-subtle text-dark border px-3 py-1.5 rounded-pill text-uppercase fw-bold small">
              {t('home.workflowTag')}
            </span>
            <h2 className="fw-bold mt-2">{t('home.workflowTitle')}</h2>
            <p className="text-muted" style={{ maxWidth: '680px', margin: '0 auto', fontSize: '0.95rem' }}>
              {t('home.workflowSubtitle')}
            </p>
          </div>

          <div className="row g-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
              const stepTitle = t(`home.steps.${idx}.title`);
              const stepDesc = t(`home.steps.${idx}.desc`);
              const iconObj = workflowIcons[idx];
              return (
                <div key={idx} className="col-6 col-md-3">
                  <div className="workflow-step shadow-sm">
                    <div className="badge bg-dark text-white position-absolute top-0 start-0 m-2 font-monospace small">
                      #{idx + 1}
                    </div>
                    <div className="workflow-icon mt-2">
                      <i className={`bi ${iconObj.icon} ${iconObj.color}`}></i>
                    </div>
                    <h6 className="fw-bold text-dark mb-1">{stepTitle}</h6>
                    <p className="text-muted small mb-0">{stepDesc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4 Feature Highlights */}
      <section className="py-5 bg-white">
        <div className="container">
          <div className="text-center mb-5">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1.5 rounded-pill text-uppercase fw-bold small">
              {t('home.coreTag')}
            </span>
            <h2 className="fw-bold mt-2">{t('home.coreTitle')}</h2>
          </div>

          <div className="row g-4">
            <div className="col-md-6 col-lg-3">
              <div className="card h-100 card-hover p-4 text-center border">
                <div className="workflow-icon mb-3 bg-primary-subtle text-primary">
                  <i className="bi bi-file-earmark-binary fs-3"></i>
                </div>
                <h5 className="fw-bold">{t('home.featCard1Title')}</h5>
                <p className="text-muted small mb-0">
                  {t('home.featCard1Desc')}
                </p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="card h-100 card-hover p-4 text-center border">
                <div className="workflow-icon mb-3 bg-success-subtle text-success">
                  <i className="bi bi-currency-exchange fs-3"></i>
                </div>
                <h5 className="fw-bold">{t('home.featCard2Title')}</h5>
                <p className="text-muted small mb-0">
                  {t('home.featCard2Desc')}
                </p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="card h-100 card-hover p-4 text-center border">
                <div className="workflow-icon mb-3 bg-info-subtle text-info">
                  <i className="bi bi-patch-check fs-3"></i>
                </div>
                <h5 className="fw-bold">{t('home.featCard3Title')}</h5>
                <p className="text-muted small mb-0">
                  {t('home.featCard3Desc')}
                </p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="card h-100 card-hover p-4 text-center border">
                <div className="workflow-icon mb-3 bg-warning-subtle text-warning">
                  <i className="bi bi-clock-history fs-3"></i>
                </div>
                <h5 className="fw-bold">{t('home.featCard4Title')}</h5>
                <p className="text-muted small mb-0">
                  {t('home.featCard4Desc')}
                </p>
              </div>
            </div>
          </div>

          {/* Call to action banner */}
          <div className="mt-5 p-4 rounded-4 bg-dark text-white d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 shadow">
            <div>
              <h4 className="fw-bold mb-1">{t('home.ctaTitle')}</h4>
              <p className="text-light opacity-75 small mb-0">
                {t('home.ctaSubtitle')}
              </p>
            </div>
            <div className="d-flex gap-2">
              <Link href="/rentals" className="btn btn-info fw-bold text-dark px-4 py-2 rounded-3">
                {t('home.ctaBrowse')}
              </Link>
              <Link href="/register" className="btn btn-outline-light px-4 py-2 rounded-3">
                {t('home.ctaRegister')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Deploy Guide Modal */}
      {showGuideModal && mounted && createPortal(
        <>
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              zIndex: 9999,
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              overflowY: 'auto',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowGuideModal(false);
            }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg" style={{ margin: '2rem auto' }}>
              <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
                <div className="modal-header bg-dark text-white border-bottom border-secondary py-3">
                  <h5 className="modal-title fw-bold d-flex align-items-center">
                    <i className="bi bi-cpu-fill text-info me-2"></i>
                    {language === 'th'
                      ? 'วิธีการติดตั้ง Smart Contract บน Sepolia เพื่อให้แถบเตือนหายไป'
                      : 'Smart Contract Deployment Guide for Ethereum Sepolia'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowGuideModal(false)}
                    aria-label="Close"
                  ></button>
                </div>

                <div className="modal-body p-4 bg-white">
                  {/* Why this shows up */}
                  <div className="alert alert-info border border-info-subtle small mb-4">
                    <h6 className="fw-bold mb-1">
                      <i className="bi bi-question-circle-fill me-1.5"></i>
                      {language === 'th' ? 'ทำไมหน้าเว็บถึงขึ้นแถบนี้?' : 'Why does this notice appear?'}
                    </h6>
                    <p className="mb-0">
                      {language === 'th'
                        ? 'เพราะในไฟล์ .env.local ยังไม่ได้ระบุ Contract Address จริงที่ Deploy บนเครือข่าย Sepolia (ยังเป็น YOUR_DEPLOYED_CONTRACT_ADDRESS) ระบบจึงแจ้งเตือนเพื่อแนะนำให้คุณ Deploy สัญญาใน Remix IDE แล้วนำ Address มาใส่ เพื่อให้เว็บสามารถอ่านและเขียนข้อมูลการเช่าบนบล็อกเชนได้จริงครับ'
                        : 'The environment variable NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local is still set to placeholder. Deploy your contract to Sepolia via Remix IDE to interact with live blockchain state.'}
                    </p>
                  </div>

                  {/* 3 Steps */}
                  <h6 className="fw-bold text-dark mb-3">
                    <i className="bi bi-list-ol text-primary me-2"></i>
                    {language === 'th' ? 'ขั้นตอนการ Deploy สัญญา (ใช้เวลา 1-2 นาที)' : 'Deployment Steps (Takes 1-2 mins)'}
                  </h6>

                  <div className="timeline-steps mb-4">
                    {/* Step 1 */}
                    <div className="p-3 border rounded-3 bg-light mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-bold text-dark">
                          1. {language === 'th' ? 'คัดลอกโค้ดสัญญา RentalSystem.sol' : 'Copy RentalSystem.sol Code'}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="btn btn-sm btn-primary rounded-pill px-3 py-1"
                        >
                          <i className={`bi ${copiedCode ? 'bi-check-lg' : 'bi-clipboard'} me-1`}></i>
                          {copiedCode ? (language === 'th' ? 'คัดลอกแล้ว!' : 'Copied!') : (language === 'th' ? 'คัดลอกโค้ด Solidity' : 'Copy Solidity Code')}
                        </button>
                      </div>
                      <div className="small text-muted mb-2">
                        {language === 'th'
                          ? 'สัญญาเขียนด้วย Solidity 0.8.20 ใช้ OpenZeppelin (Ownable, ReentrancyGuard) รองรับการสร้างสัญญาเช่า ล็อกเงินมัดจำใน Escrow และคืนเงินมัดจำอัตโนมัติ'
                          : 'Solidity 0.8.20 contract using OpenZeppelin for escrow deposits and automated return refunds.'}
                      </div>
                      <pre className="bg-dark text-light p-2.5 rounded small font-monospace mb-0" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                        {solidityContractCode}
                      </pre>
                    </div>

                    {/* Step 2 */}
                    <div className="p-3 border rounded-3 bg-light mb-3">
                      <div className="fw-bold text-dark mb-2">
                        2. {language === 'th' ? 'เปิด Remix IDE และทำการ Deploy' : 'Open Remix IDE & Deploy'}
                      </div>
                      <ol className="small text-secondary mb-2 ps-3">
                        <li className="mb-1">
                          เปิดเว็บไซต์{' '}
                          <a href="https://remix.ethereum.org" target="_blank" rel="noopener noreferrer" className="fw-bold text-primary">
                            remix.ethereum.org <i className="bi bi-box-arrow-up-right"></i>
                          </a>
                        </li>
                        <li className="mb-1">สร้างไฟล์ใหม่ชื่อ <code>RentalSystem.sol</code> ในโฟลเดอร์ <code>contracts</code> แล้ววางโค้ดลงไป</li>
                        <li className="mb-1">ไปที่แท็บ <strong>Solidity Compiler</strong> (แถบซ้าย) แล้วกดปุ่ม <strong>Compile RentalSystem.sol</strong></li>
                        <li className="mb-1">
                          ไปที่แท็บ <strong>Deploy & Run Transactions</strong> เปลี่ยน <strong>ENVIRONMENT</strong> เป็น{' '}
                          <span className="badge bg-primary">Injected Provider - MetaMask</span>
                        </li>
                        <li>MetaMask จะเด้งขึ้นมา ให้เลือกเครือข่าย <strong>Sepolia Testnet</strong> แล้วกดปุ่มส้ม <strong>Deploy</strong></li>
                      </ol>
                    </div>

                    {/* Step 3 */}
                    <div className="p-3 border rounded-3 bg-light">
                      <div className="fw-bold text-dark mb-2">
                        3. {language === 'th' ? 'คัดลอก Contract Address มาใส่ใน .env.local' : 'Paste Address into .env.local'}
                      </div>
                      <p className="small text-secondary mb-2">
                        {language === 'th'
                          ? 'เมื่อ Deploy สำเร็จ ใน Remix ด้านล่างซ้ายจะมีส่วน Deployed Contracts ให้กดคัดลอก Address (เช่น 0x1234...) แล้วนำมาแทนที่ในไฟล์ .env.local:'
                          : 'Copy the newly deployed contract address from Remix and paste it into .env.local:'}
                      </p>
                      <pre className="bg-dark text-info p-2 rounded small font-monospace mb-2">
                        NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedAddressHere
                      </pre>
                      <div className="small text-success fw-medium">
                        <i className="bi bi-check-circle-fill me-1"></i>
                        {language === 'th'
                          ? 'เมื่อบันทึกไฟล์ .env.local แล้ว แถบแจ้งเตือนสีฟ้านี้จะหายไปทันทีโดยอัตโนมัติ!'
                          : 'Once saved, the notification banner will automatically disappear!'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2.5">
                  <button
                    type="button"
                    className="btn btn-secondary rounded-3"
                    onClick={() => setShowGuideModal(false)}
                  >
                    {t('common.close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 9990 }}></div>
        </>,
        document.body
      )}
    </div>
  );
}
