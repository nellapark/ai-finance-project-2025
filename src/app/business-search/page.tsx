import BusinessSearch from '../../components/pages/business-search/business-search';
import ClientOnly from '../../components/common/client-only';

export default function BusinessSearchPage() {
  return (
    <ClientOnly fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Business Search...</p>
        </div>
      </div>
    }>
      <BusinessSearch />
    </ClientOnly>
  );
}

export const metadata = {
  title: 'Business Search - AI Finance Project',
  description: 'Find nearby businesses and discover the best credit card rewards for your purchases',
};
