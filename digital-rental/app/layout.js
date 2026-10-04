import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';

import { WalletProvider } from '../context/WalletContext';
import { LanguageProvider } from '../context/LanguageContext';
import Navbar from '../components/Navbar';
import RentalExpiryAlert from '../components/RentalExpiryAlert';
import Footer from '../components/Footer';

export const metadata = {
  title: 'Blockchain-Based Rental System | ระบบจัดการการเช่าบนบล็อกเชน Web3 DApp',
  description:
    'A university-level decentralized rental platform powered by Ethereum Sepolia Testnet, OpenZeppelin Smart Contracts, ethers.js, and MetaMask.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="d-flex flex-column min-vh-100">
        <LanguageProvider>
          <WalletProvider>
            {/* Main Navigation Bar */}
            <Navbar />

            {/* Global Expiry Countdown & Notification Alert Banner */}
            <RentalExpiryAlert />

            {/* Main Page View */}
            <main className="flex-grow-1">
              {children}
            </main>

            {/* Platform Footer with i18n support */}
            <Footer />
          </WalletProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
