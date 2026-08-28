// Service Worker for Distributor Order Tracker MVP
const CACHE_NAME = 'order-tracker-v1';

self.addEventListener('install', (event) => {
  console.log('Order Tracker Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Order Tracker Service Worker active.');
});

self.addEventListener('fetch', (event) => {
  // Pass through all fetch requests since offline support is v2
});
