'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchAllItems, isContractConfigured } from '../../lib/contract';
import { ITEM_CATEGORIES } from '../../lib/constants';
import { useWallet } from '../../context/WalletContext';
import { useLanguage } from '../../context/LanguageContext';
import ItemCard from '../../components/ItemCard';
import RentalModal from '../../components/RentalModal';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

/**
 * Browse Rentals Page (app/rentals/page.js)
 * Displays available rental assets queried directly from the Smart Contract.
 * Includes client-side filtering, keyword search, category selection, and checkout modal with i18n support.
 */
export default function BrowseRentalsPage() {
  const { account } = useWallet();
  const { t, language } = useLanguage();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL'); // 'ALL' | 'AVAILABLE' | 'RENTED'
  const [sortOrder, setSortOrder] = useState('NEWEST');

  // Checkout modal
  const [selectedItemForRent, setSelectedItemForRent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const contractConfigured = isContractConfigured();

  const loadItems = useCallback(async () => {
    if (!contractConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllItems(account);
      setItems(data || []);
    } catch (err) {
      console.warn('Items query notice:', err.message);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [contractConfigured, account]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleOpenRentModal = (item) => {
    setSelectedItemForRent(item);
    setIsModalOpen(true);
  };

  const handleRentalSuccess = () => {
    loadItems();
  };

  // Filtered & Sorted items
  const filteredItems = items.filter((item) => {
    // Keyword search
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.owner.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory =
      selectedCategory === 'ALL' || item.category === selectedCategory;

    // Availability filter
    const matchesAvailability =
      availabilityFilter === 'ALL' ||
      (availabilityFilter === 'AVAILABLE' && item.available) ||
      (availabilityFilter === 'RENTED' && !item.available);

    return matchesSearch && matchesCategory && matchesAvailability;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortOrder === 'NEWEST') return b.itemId - a.itemId;
    if (sortOrder === 'OLDEST') return a.itemId - b.itemId;
    if (sortOrder === 'PRICE_LOW') {
      return parseFloat(a.rentalPriceEth) - parseFloat(b.rentalPriceEth);
    }
    if (sortOrder === 'PRICE_HIGH') {
      return parseFloat(b.rentalPriceEth) - parseFloat(a.rentalPriceEth);
    }
    return 0;
  });

  return (
    <div className="container py-4">
      {/* Header and Action */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">{t('rentals.title')}</h2>
          <p className="text-muted small mb-0">
            {t('rentals.subtitle')}
          </p>
        </div>

        <div className="d-flex gap-2">
          <button
            onClick={loadItems}
            disabled={loading || !contractConfigured}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center"
          >
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>
            {t('common.refresh')}
          </button>
          <Link href="/register" className="btn btn-primary btn-sm d-flex align-items-center">
            <i className="bi bi-plus-circle me-1"></i> {t('dashboard.quickRegister')}
          </Link>
        </div>
      </div>

      {/* Contract configuration check */}
      {!contractConfigured && (
        <div className="alert alert-info shadow-sm mb-4">
          <div className="d-flex align-items-center">
            <i className="bi bi-info-circle-fill fs-5 text-primary me-3"></i>
            <div>
              <strong>{language === 'th' ? 'ต้องกำหนด Contract Address:' : 'Contract Setup Required:'}</strong>{' '}
              {language === 'th'
                ? 'เพื่อดึงข้อมูลรายการเช่าจริงจาก Sepolia กรุณา Deploy สัญญาใน Remix IDE และระบุ NEXT_PUBLIC_CONTRACT_ADDRESS ใน .env.local'
                : 'To query live rental assets from Ethereum Sepolia, deploy your contract in Remix IDE and configure NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local.'}
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="card shadow-sm border mb-4 bg-white">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            {/* Search Input */}
            <div className="col-12 col-md-4">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder={t('rentals.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Category Dropdown */}
            <div className="col-6 col-md-3">
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="ALL">{t('rentals.allCategories')}</option>
                {ITEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`categories.${cat}`) || cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Availability Filter */}
            <div className="col-6 col-md-2">
              <select
                className="form-select"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
              >
                <option value="ALL">{t('rentals.allStatuses')}</option>
                <option value="AVAILABLE">{t('rentals.availableOnly')}</option>
                <option value="RENTED">{t('rentals.currentlyRented')}</option>
              </select>
            </div>

            {/* Sort Order */}
            <div className="col-12 col-md-3">
              <select
                className="form-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="NEWEST">{t('rentals.sortNewest')}</option>
                <option value="OLDEST">{t('rentals.sortOldest')}</option>
                <option value="PRICE_LOW">{t('rentals.sortPriceLow')}</option>
                <option value="PRICE_HIGH">{t('rentals.sortPriceHigh')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && <ErrorMessage error={error} onRetry={loadItems} />}

      {/* Loading state */}
      {loading ? (
        <Loading message={language === 'th' ? 'กำลังดึงรายการทรัพย์สินจาก Ethereum Sepolia...' : 'Fetching live rental items from Ethereum Sepolia...'} />
      ) : sortedItems.length === 0 ? (
        <div className="card shadow-sm border text-center py-5 bg-white">
          <div className="card-body">
            <div className="mb-3 text-secondary" style={{ fontSize: '3rem' }}>
              <i className="bi bi-box-seam"></i>
            </div>
            <h5 className="fw-bold text-dark">{t('rentals.noItemsTitle')}</h5>
            <p className="text-muted small mb-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
              {items.length === 0
                ? t('rentals.noItemsDescEmpty')
                : t('rentals.noItemsDescFilter')}
            </p>
            {items.length === 0 ? (
              <Link href="/register" className="btn btn-primary fw-medium px-4">
                <i className="bi bi-plus-circle me-1"></i> {t('rentals.btnRegisterFirst')}
              </Link>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setAvailabilityFilter('ALL');
                }}
                className="btn btn-outline-secondary btn-sm"
              >
                {t('rentals.btnResetFilters')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3 text-muted small">
            <span>
              {t('rentals.showingText')} <strong>{sortedItems.length}</strong> {t('rentals.ofText')} {items.length} {t('rentals.totalItemsText')}
            </span>
          </div>

          {/* Grid of Items */}
          <div className="row g-4">
            {sortedItems.map((item) => (
              <div key={item.itemId} className="col-12 col-sm-6 col-lg-4">
                <ItemCard item={item} onRentClick={handleOpenRentModal} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Checkout Modal */}
      <RentalModal
        item={selectedItemForRent}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRentalSuccess={handleRentalSuccess}
      />
    </div>
  );
}
