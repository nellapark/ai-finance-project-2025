// Extend the Window interface to include Google Maps API
declare global {
  interface Window {
    google: typeof google;
  }
}

export {};
