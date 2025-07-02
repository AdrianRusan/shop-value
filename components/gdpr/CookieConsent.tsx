'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

// Icon components as inline SVGs (since lucide-react is not available)
const XIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CookieIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <circle cx="9" cy="9" r="1" />
    <circle cx="15" cy="15" r="1" />
    <circle cx="8" cy="15" r="1" />
    <circle cx="15" cy="9" r="1" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const BarChart3Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <rect x="14" y="3" width="7" height="5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <rect x="14" y="12" width="7" height="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <rect x="3" y="16" width="7" height="5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

interface ConsentPreferences {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface CookieConsentProps {
  onClose?: () => void;
}

export const CookieConsent: React.FC<CookieConsentProps> = ({ onClose }) => {
  const { user } = useUser();
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showPreferences, setShowPreferences] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    functional: true, // Always required
    analytics: false,
    marketing: false
  });
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    checkConsentStatus();
  }, [user]);

  const checkConsentStatus = async (): Promise<void> => {
    try {
      if (!user) return;

      const response = await fetch('/api/gdpr/consent-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch consent status');
      }

      const data = await response.json();
      
      if (!data.success) {
        setShowBanner(true);
        return;
      }

      // User has made consent choices, check if they're still valid (< 1 year old)
      const lastUpdated = new Date(data.data.consent.lastUpdated);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      if (lastUpdated < oneYearAgo) {
        setShowBanner(true);
      } else {
        // Load existing preferences
        setPreferences({
          functional: true, // Always required
          analytics: data.data.consent.analytics.granted,
          marketing: data.data.consent.marketing.granted
        });
      }
    } catch (error) {
      console.error('Error checking consent status:', error);
      // Show banner by default if we can't determine status
      setShowBanner(true);
    }
  };

  const updateConsent = async (newPreferences: ConsentPreferences): Promise<void> => {
    try {
      setLoading(true);

      const response = await fetch('/api/gdpr/update-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: newPreferences,
          ipAddress: await getClientIP(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update consent');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update consent');
      }

      // Update analytics and marketing cookies based on preferences
      updateCookies(newPreferences);
      
      setPreferences(newPreferences);
      setShowBanner(false);
      setShowPreferences(false);
      
      if (onClose) {
        onClose();
      }

    } catch (error) {
      console.error('Error updating consent:', error);
      alert('Failed to save consent preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('/api/client-ip');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  };

  const updateCookies = (prefs: ConsentPreferences): void => {
    // Set consent cookies
    document.cookie = `consent_functional=true; max-age=${365 * 24 * 60 * 60}; path=/; SameSite=Lax`;
    document.cookie = `consent_analytics=${prefs.analytics}; max-age=${365 * 24 * 60 * 60}; path=/; SameSite=Lax`;
    document.cookie = `consent_marketing=${prefs.marketing}; max-age=${365 * 24 * 60 * 60}; path=/; SameSite=Lax`;

    // Initialize or disable analytics based on consent
    if (prefs.analytics) {
      // Initialize analytics (Amplitude, Google Analytics, etc.)
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          analytics_storage: 'granted',
        });
      }
    } else {
      // Disable analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          analytics_storage: 'denied',
        });
      }
    }

    // Handle marketing cookies
    if (prefs.marketing) {
      // Initialize marketing tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
        });
      }
    } else {
      // Disable marketing tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
        });
      }
    }
  };

  const handleAcceptAll = (): void => {
    updateConsent({
      functional: true,
      analytics: true,
      marketing: true
    });
  };

  const handleAcceptNecessary = (): void => {
    updateConsent({
      functional: true,
      analytics: false,
      marketing: false
    });
  };

  const handleSavePreferences = (): void => {
    updateConsent(preferences);
  };

  const handlePreferenceChange = (type: keyof ConsentPreferences, value: boolean): void => {
    if (type === 'functional') return; // Functional cookies are always required
    
    setPreferences(prev => ({
      ...prev,
      [type]: value
    }));
  };

  if (!showBanner && !showPreferences) {
    return null;
  }

  if (showPreferences) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <SettingsIcon />
                Cookie Preferences
              </h2>
              <button
                onClick={() => setShowPreferences(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
              >
                <XIcon />
              </button>
            </div>

            <div className="space-y-6">
              {/* Functional Cookies */}
              <div className="border rounded-lg p-4">
                                 <div className="flex items-start gap-3">
                   <div className="text-green-600 mt-0.5">
                     <ShieldIcon />
                   </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">Functional Cookies</h3>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        Always Active
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      These cookies are essential for the website to function properly. They enable core functionality such as security, network management, and accessibility.
                    </p>
                  </div>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="border rounded-lg p-4">
                                 <div className="flex items-start gap-3">
                   <div className="text-blue-600 mt-0.5">
                     <BarChart3Icon />
                   </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">Analytics Cookies</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.analytics}
                          onChange={(e) => handlePreferenceChange('analytics', e.target.checked)}
                          className="sr-only peer"
                          disabled={loading}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.
                    </p>
                  </div>
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="border rounded-lg p-4">
                                 <div className="flex items-start gap-3">
                   <div className="text-purple-600 mt-0.5">
                     <MailIcon />
                   </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">Marketing Cookies</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.marketing}
                          onChange={(e) => handlePreferenceChange('marketing', e.target.checked)}
                          className="sr-only peer"
                          disabled={loading}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      These cookies are used to deliver personalized advertisements and track the effectiveness of our marketing campaigns.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSavePreferences}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Preferences'}
              </button>
              <button
                onClick={() => setShowPreferences(false)}
                disabled={loading}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                     <div className="flex items-start gap-3 flex-1">
             <div className="text-orange-600 mt-0.5 flex-shrink-0">
               <CookieIcon />
             </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-1">We value your privacy</h3>
              <p className="text-sm text-gray-600">
                We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
                By clicking "Accept All", you consent to our use of cookies.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
            <button
              onClick={() => setShowPreferences(true)}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              Customize
            </button>
            <button
              onClick={handleAcceptNecessary}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Necessary Only'}
            </button>
            <button
              onClick={handleAcceptAll}
              disabled={loading}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Accept All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;