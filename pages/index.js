// pages/index.js
// File ini berfungsi sebagai router untuk memanggil index.html
// agar halaman utama tidak 404.

import Head from 'next/head';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Redirect permanen dari / ke file html statis
    if (typeof window !== 'undefined') {
      window.location.href = '/index.html';
    }
  }, []);

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Loading Ngebel...</h1>
      <p>Mengalihkan ke halaman utama...</p>
    </div>
  );
}

export const metadata = {
  title: 'Ngebel.com | Smart Living Tourism',
  description: 'Platform Digital Wisata Telaga Ngebel',
};
