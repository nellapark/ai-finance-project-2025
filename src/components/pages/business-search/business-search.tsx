'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import BusinessSidebar from './components/business-sidebar';
import { fuzzyMatchCategory } from '../../../utils/businessCategoryMatcher';
import type { Business } from '../../../types/business';

interface BusinessSearchProps {
  className?: string;
}

const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: '100%',
  height: '600px'
};

const defaultCenter = {
  lat: 37.7749, // San Francisco default
  lng: -122.4194
};

// Helper function to safely check for browser environment and Google Maps
const isGoogleMapsAvailable = () => {
  return typeof window !== 'undefined' && window.google && window.google.maps;
};

const BusinessSearch: React.FC<BusinessSearchProps> = ({ className = '' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(defaultCenter);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [selectedMarker, setSelectedMarker] = useState<Business | null>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setMapCenter(location);
          console.log('📍 [Location] User location obtained:', location);
        },
        (error) => {
          console.warn('⚠️ [Location] Could not get user location:', error);
        }
      );
    }
  }, []);

  // Initialize Places service when map loads
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (isGoogleMapsAvailable() && window.google.maps.places) {
      placesServiceRef.current = new window.google.maps.places.PlacesService(map);
      setIsGoogleMapsLoaded(true);
      console.log('🗺️ [Maps] Google Maps and Places service initialized');
    } else {
      console.error('❌ [Maps] Google Maps Places API not loaded');
    }
  }, []);

  // Search for businesses using Google Places API
  const searchBusinesses = useCallback(async () => {
    if (!searchQuery.trim() || !placesServiceRef.current) {
      console.warn('⚠️ [Search] No search query or Places service not ready');
      return;
    }

    setIsLoading(true);
    console.log('🔍 [Search] Searching for:', searchQuery);

    const request: google.maps.places.TextSearchRequest = {
      query: searchQuery,
      location: isGoogleMapsAvailable() 
        ? new window.google.maps.LatLng(userLocation.lat, userLocation.lng)
        : userLocation,
      radius: 10000, // 10km radius
    };

    placesServiceRef.current.textSearch(request, (results, status) => {
      console.log('📊 [Search] Places API response:', { status, resultsCount: results?.length });
      
      if (isGoogleMapsAvailable() && status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        const businessResults: Business[] = results.slice(0, 20).map((place, index) => {
          // Fuzzy match the business type to reward categories
          const businessTypes = place.types || [];
          const businessName = place.name || '';
          const matchedCategory = fuzzyMatchCategory(businessTypes, businessName);
          
          return {
            id: place.place_id || `business-${index}`,
            name: place.name || 'Unknown Business',
            address: place.formatted_address || 'Address not available',
            location: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0
            },
            types: businessTypes,
            rating: place.rating,
            priceLevel: place.price_level,
            photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400, maxHeight: 300 }),
            rewardCategory: matchedCategory,
            isOpen: place.opening_hours?.isOpen(),
            placeId: place.place_id
          };
        });

        setBusinesses(businessResults);
        console.log('✅ [Search] Processed businesses:', businessResults.length);
        
        // Adjust map bounds to show all results
        if (mapRef.current && businessResults.length > 0 && isGoogleMapsAvailable()) {
          const bounds = new window.google.maps.LatLngBounds();
          businessResults.forEach(business => {
            bounds.extend(new window.google.maps.LatLng(business.location.lat, business.location.lng));
          });
          mapRef.current.fitBounds(bounds);
        }
      } else {
        console.error('❌ [Search] Places API error:', status);
        setBusinesses([]);
      }
      
      setIsLoading(false);
    });
  }, [searchQuery, userLocation]);

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchBusinesses();
  };

  // Handle business marker click
  const handleMarkerClick = (business: Business) => {
    console.log('📍 [Map] Business marker clicked:', business.name);
    setSelectedMarker(business);
    setSelectedBusiness(business);
    setIsSidebarOpen(true);
  };

  // Handle closing sidebar
  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedBusiness(null);
    setSelectedMarker(null);
  };

  // Get marker color based on reward category
  const getMarkerColor = (rewardCategory: string) => {
    const colorMap: Record<string, string> = {
      dining: '#ef4444', // Red
      grocery: '#22c55e', // Green
      travel_general: '#3b82f6', // Blue
      travel_flights: '#1d4ed8', // Dark Blue
      travel_hotels: '#6366f1', // Indigo
      gas_stations: '#f59e0b', // Amber
      entertainment_and_recreation: '#ec4899', // Pink
      streaming_services: '#8b5cf6', // Purple
      drugstores_and_pharmacies: '#06b6d4', // Cyan
      fitness_and_wellness: '#10b981', // Emerald
      transit_and_rideshare: '#f97316', // Orange
      catch_all_general_purchases: '#6b7280' // Gray
    };
    return colorMap[rewardCategory] || colorMap.catch_all_general_purchases;
  };

  return (
    <div className={`business-search min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Business Search</h1>
              <p className="mt-2 text-gray-600">
                Find nearby businesses and discover the best credit card rewards for your purchases
              </p>
            </div>
            <div>
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Simulator
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for restaurants, shops, services..."
                className="w-full px-4 py-3 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim() || !isGoogleMapsLoaded}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Searching...</span>
                </div>
              ) : !isGoogleMapsLoaded ? (
                'Loading Maps...'
              ) : (
                'Search'
              )}
            </button>
          </div>
        </form>

        {/* Results Summary */}
        {businesses.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <span className="text-blue-800 font-medium">
                Found {businesses.length} businesses for &ldquo;{searchQuery}&rdquo;
              </span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Map Container */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                <div className="flex items-center justify-center h-96 bg-gray-50">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Google Maps API Key Required</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables.
                    </p>
                  </div>
                </div>
              ) : (
                <LoadScript
                  googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                  libraries={libraries}
                  onError={(error) => {
                    console.error('❌ [Maps] Google Maps API loading error:', error);
                  }}
                >
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={13}
                  onLoad={onMapLoad}
                  options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                  }}
                >
                  {/* User location marker */}
                  <Marker
                    position={userLocation}
                    icon={{
                      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="white" stroke-width="2"/>
                          <circle cx="12" cy="12" r="3" fill="white"/>
                        </svg>
                      `),
                      scaledSize: isGoogleMapsAvailable() ? new window.google.maps.Size(24, 24) : undefined,
                    }}
                    title="Your Location"
                  />

                  {/* Business markers */}
                  {businesses.map((business) => (
                    <Marker
                      key={business.id}
                      position={business.location}
                      onClick={() => handleMarkerClick(business)}
                      icon={{
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="16" cy="16" r="12" fill="${getMarkerColor(business.rewardCategory)}" stroke="white" stroke-width="2"/>
                            <text x="16" y="20" text-anchor="middle" fill="white" font-size="16" font-weight="bold">$</text>
                          </svg>
                        `),
                        scaledSize: isGoogleMapsAvailable() ? new window.google.maps.Size(32, 32) : undefined,
                      }}
                      title={business.name}
                    />
                  ))}

                  {/* Info window for selected marker */}
                  {selectedMarker && (
                    <InfoWindow
                      position={selectedMarker.location}
                      onCloseClick={() => setSelectedMarker(null)}
                    >
                      <div className="p-2 max-w-xs">
                        <h3 className="font-semibold text-gray-900">{selectedMarker.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{selectedMarker.address}</p>
                        {selectedMarker.rating && (
                          <div className="flex items-center mt-2">
                            <span className="text-yellow-500">★</span>
                            <span className="text-sm text-gray-700 ml-1">{selectedMarker.rating}</span>
                          </div>
                        )}
                        <div className="mt-2">
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {selectedMarker.rewardCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
                </LoadScript>
              )}
            </div>
          </div>

          {/* Business Sidebar */}
          <BusinessSidebar
            business={selectedBusiness}
            isOpen={isSidebarOpen}
            onClose={handleCloseSidebar}
          />
        </div>
      </section>
    </div>
  );
};

export default BusinessSearch;
