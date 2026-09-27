'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectWallet from './ConnectWallet';
import { useLanguage } from '../context/LanguageContext';

/**
 * Navbar component
 * Responsive header with navigation links, branding, language switcher, and MetaMask widget
 */
export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const toggleNavbar = () => setIsOpen(!isOpen);
  const closeNavbar = () => setIsOpen(false);

  const navLinks = [
    { href: '/', label: t('nav.home'), icon: 'bi-house' },
    { href: '/dashboard', label: t('nav.dashboard'), icon: 'bi-speedometer2' },
    { href: '/rentals', label: t('nav.browse'), icon: 'bi-grid' },
    { href: '/register', label: t('nav.register'), icon: 'bi-plus-circle' },
    { href: '/my-rentals', label: t('nav.myRentals'), icon: 'bi-bag-check' },
    { href: '/owner', label: t('nav.ownerPanel'), icon: 'bi-shield-check' },
    { href: '/claims', label: t('nav.claims'), icon: 'bi-journal-check' },
  ];

  return (
    <nav className="navbar navbar-expand-xl navbar-dark navbar-web3 sticky-top py-2">
      <div className="container-fluid px-3 px-lg-4">
        {/* Brand Logo */}
        <Link href="/" className="navbar-brand d-flex align-items-center me-3" onClick={closeNavbar}>
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-2 text-white"
            style={{
              width: '34px',
              height: '34px',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
            }}
          >
            <i className="bi bi-box-seam-fill fs-6"></i>
          </div>
          <span className="fw-bold fs-5 text-white tracking-tight">{t('nav.brand')}</span>
          <span className="badge bg-primary-subtle text-info border border-info-subtle ms-2 py-0.5 px-1.5 small d-none d-sm-inline">
            {t('nav.dappBadge')}
          </span>
        </Link>

        {/* Mobile Hamburger Toggle */}
        <button
          className="navbar-toggler border-0 p-2"
          type="button"
          onClick={toggleNavbar}
          aria-expanded={isOpen}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Collapsible Menu */}
        <div className={`collapse navbar-collapse ${isOpen ? 'show' : ''}`} id="mainNavbar">
          <ul className="navbar-nav me-auto mb-2 mb-xl-0 py-2 py-xl-0 d-flex flex-row flex-wrap gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li className="nav-item" key={link.href}>
                  <Link
                    href={link.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={closeNavbar}
                  >
                    <i className={`bi ${link.icon} me-1`}></i>
                    <span>{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right Section: Language Switcher & Connect Wallet */}
          <div className="d-flex flex-wrap align-items-center gap-2.5 mt-3 mt-xl-0 pt-2 pt-xl-0 border-top border-xl-0 border-secondary">
            {/* Sleek Segmented Language Switcher (No emoji letter bug on Windows) */}
            <div className="lang-switcher">
              <button
                type="button"
                onClick={() => setLanguage('th')}
                className={`lang-btn ${language === 'th' ? 'active' : ''}`}
                title="เปลี่ยนเป็นภาษาไทย"
              >
                TH
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                title="Switch to English"
              >
                EN
              </button>
            </div>

            {/* Connect Wallet Component */}
            <ConnectWallet />
          </div>
        </div>
      </div>
    </nav>
  );
}
