'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface ConsentStatus {
  functional: { granted: boolean; timestamp: string };
  analytics: { granted: boolean; timestamp?: string };
  marketing: { granted: boolean; timestamp?: string };
  lastUpdated: string;
}

interface PrivacyDashboardProps {
  className?: string;
}

export const PrivacyDashboard: React.FC<PrivacyDashboardProps> = ({ className = '' }) => {
  const { user, isLoaded } = useUser();
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

  useEffect(() => {
    if (isLoaded && user) {
      fetchConsentStatus();
    }
  }, [isLoaded, user]);

  const fetchConsentStatus = async (): Promise<void> => {
    try {
      const response = await fetch('/api/gdpr/consent-status');
      const data = await response.json();
      
      if (data.success) {
        setConsentStatus(data.data.consent);
      }
    } catch (error) {
      console.error('Error fetching consent status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDataExport = async (): Promise<void> => {
    try {
      setExportLoading(true);
      
      const response = await fetch('/api/gdpr/export-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(data.data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shopvalue-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Your data has been exported and downloaded successfully.');
      } else {
        alert('Failed to export data: ' + data.error);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleAccountDeletion = async (): Promise<void> => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      alert('Please type "DELETE MY ACCOUNT" exactly to confirm deletion.');
      return;
    }

    try {
      setDeleteLoading(true);
      
      const response = await fetch('/api/gdpr/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmationText: deleteConfirmText,
          reason: 'user_requested'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Your account and all associated data have been permanently deleted. You will be redirected to the homepage.');
        window.location.href = '/';
      } else {
        alert('Failed to delete account: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again or contact support.');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="bg-gray-200 h-8 rounded mb-4"></div>
        <div className="bg-gray-200 h-32 rounded"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-600">Please sign in to view your privacy dashboard.</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Privacy Dashboard</h2>
      
      {/* Consent Status */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cookie Consent Status</h3>
        {consentStatus ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <span className="font-medium text-green-800">Functional Cookies</span>
                <p className="text-sm text-green-600">Always active for website functionality</p>
              </div>
              <span className="text-green-600 font-medium">✓ Active</span>
            </div>
            
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              consentStatus.analytics.granted ? 'bg-blue-50' : 'bg-gray-50'
            }`}>
              <div>
                <span className={`font-medium ${
                  consentStatus.analytics.granted ? 'text-blue-800' : 'text-gray-600'
                }`}>Analytics Cookies</span>
                <p className={`text-sm ${
                  consentStatus.analytics.granted ? 'text-blue-600' : 'text-gray-500'
                }`}>Help us understand how you use our website</p>
              </div>
              <span className={`font-medium ${
                consentStatus.analytics.granted ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {consentStatus.analytics.granted ? '✓ Active' : '✗ Disabled'}
              </span>
            </div>
            
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              consentStatus.marketing.granted ? 'bg-purple-50' : 'bg-gray-50'
            }`}>
              <div>
                <span className={`font-medium ${
                  consentStatus.marketing.granted ? 'text-purple-800' : 'text-gray-600'
                }`}>Marketing Cookies</span>
                <p className={`text-sm ${
                  consentStatus.marketing.granted ? 'text-purple-600' : 'text-gray-500'
                }`}>Enable personalized ads and content</p>
              </div>
              <span className={`font-medium ${
                consentStatus.marketing.granted ? 'text-purple-600' : 'text-gray-500'
              }`}>
                {consentStatus.marketing.granted ? '✓ Active' : '✗ Disabled'}
              </span>
            </div>
            
            <p className="text-sm text-gray-500 mt-3">
              Last updated: {new Date(consentStatus.lastUpdated).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <p className="text-gray-600">No consent information available.</p>
        )}
      </div>

      {/* Data Rights */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Your Data Rights</h3>
        <div className="space-y-4">
          {/* Data Export */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Export Your Data</h4>
            <p className="text-sm text-gray-600 mb-4">
              Download a copy of all your personal data including tracked products, price history, and account information.
            </p>
            <button
              onClick={handleDataExport}
              disabled={exportLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading ? 'Exporting...' : 'Export My Data'}
            </button>
          </div>

          {/* Account Deletion */}
          <div className="border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-2">Delete Your Account</h4>
            <p className="text-sm text-red-600 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Delete My Account
            </button>
          </div>
        </div>
      </div>

      {/* Data Retention Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Data Retention Policy</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• <strong>Price History:</strong> Automatically deleted after 90 days</p>
          <p>• <strong>Account Data:</strong> Kept until account deletion</p>
          <p>• <strong>Audit Logs:</strong> Kept for 7 years for legal compliance</p>
          <p>• <strong>Cookie Consent:</strong> Re-requested annually</p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-red-900 mb-4">Confirm Account Deletion</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete your account and all associated data including:
            </p>
            <ul className="text-sm text-gray-600 mb-4 list-disc list-inside">
              <li>Your user profile and preferences</li>
              <li>All tracked products and price alerts</li>
              <li>Price history and analytics data</li>
              <li>Subscription and billing information</li>
            </ul>
            <p className="text-sm text-red-600 mb-4 font-medium">
              This action cannot be undone!
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type "DELETE MY ACCOUNT" to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="DELETE MY ACCOUNT"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleAccountDeletion}
                disabled={deleteLoading || deleteConfirmText !== 'DELETE MY ACCOUNT'}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                disabled={deleteLoading}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacyDashboard;