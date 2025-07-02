/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useUser } from '@clerk/nextjs';
import { CookieConsent } from '../../components/gdpr/CookieConsent';

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

describe('CookieConsent Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUser as jest.Mock).mockReturnValue({
      user: { id: 'test-user-id' },
      isLoaded: true
    });
  });

  it('should not render when user has valid consent', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          consent: {
            lastUpdated: new Date().toISOString(),
            functional: { granted: true, timestamp: new Date() },
            analytics: { granted: true, timestamp: new Date() },
            marketing: { granted: false, timestamp: new Date() }
          }
        }
      })
    });

    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.queryByText('We value your privacy')).not.toBeInTheDocument();
    });
  });

  it('should render banner when consent is needed', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: 'No consent data found'
      })
    });

    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.getByText('We value your privacy')).toBeInTheDocument();
      expect(screen.getByText('Accept All')).toBeInTheDocument();
      expect(screen.getByText('Necessary Only')).toBeInTheDocument();
      expect(screen.getByText('Customize')).toBeInTheDocument();
    });
  });

  it('should handle accept all functionality', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'No consent data found' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '127.0.0.1' })
      });

    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.getByText('Accept All')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Accept All'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/gdpr/update-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            functional: true,
            analytics: true,
            marketing: true
          },
          ipAddress: '127.0.0.1'
        })
      });
    });
  });

  it('should handle necessary only functionality', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'No consent data found' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '127.0.0.1' })
      });

    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.getByText('Necessary Only')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Necessary Only'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/gdpr/update-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            functional: true,
            analytics: false,
            marketing: false
          },
          ipAddress: '127.0.0.1'
        })
      });
    });
  });

  it('should show preferences modal when customize is clicked', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'No consent data found' })
    });

    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.getByText('Customize')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Customize'));

    await waitFor(() => {
      expect(screen.getByText('Cookie Preferences')).toBeInTheDocument();
      expect(screen.getByText('Functional Cookies')).toBeInTheDocument();
      expect(screen.getByText('Analytics Cookies')).toBeInTheDocument();
      expect(screen.getByText('Marketing Cookies')).toBeInTheDocument();
    });
  });

  it('should handle preferences modal save', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'No consent data found' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '127.0.0.1' })
      });

    render(<CookieConsent />);

    // Open preferences modal
    await waitFor(() => {
      expect(screen.getByText('Customize')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Customize'));

    // Toggle analytics
    await waitFor(() => {
      const analyticsToggle = screen.getAllByRole('checkbox')[0];
      fireEvent.click(analyticsToggle);
    });

    // Save preferences
    fireEvent.click(screen.getByText('Save Preferences'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/gdpr/update-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            functional: true,
            analytics: true,
            marketing: false
          },
          ipAddress: '127.0.0.1'
        })
      });
    });
  });
});