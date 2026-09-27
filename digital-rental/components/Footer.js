'use client';

import { useLanguage } from '../context/LanguageContext';
export default function Footer() {
  const { t, language } = useLanguage();

  return (
    <footer className="bg-dark text-light border-top border-secondary py-4 mt-auto">
      <div className="container">
        <div className="row gy-3 align-items-center">
          <div className="col-md-6 text-center text-md-start">
            <div className="d-flex align-items-center justify-content-center justify-content-md-start mb-1">
              <i className="bi bi-link-45deg text-info fs-4 me-2"></i>
              <span className="fw-bold">{t('home.heroTitle')}</span>
            </div>
            <p className="text-secondary small mb-0">
              {language === 'th'
                ? 'DApp จัดการการเช่าแบบกระจายศูนย์ พัฒนาด้วย Next.js, ethers.js, MetaMask และ Ethereum Sepolia'
                : 'Decentralized Web3 DApp developed with Next.js, ethers.js, MetaMask & Ethereum Sepolia.'}
            </p>
          </div>

          <div className="col-md-6 text-center text-md-end">
            <div className="text-muted small">
              {t('common.academicProject')} &copy; {new Date().getFullYear()} &bull; {t('common.trustlessText')}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
