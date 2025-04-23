import '../styles/globals.css';
import { useState, useEffect } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { WalletProvider } from '../hooks/useWallet';
import AppLayout from '../components/AppLayout';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  
  return (
    <WalletProvider>
      <AppLayout>
        <Component {...pageProps} />
      </AppLayout>
    </WalletProvider>
  );
} 