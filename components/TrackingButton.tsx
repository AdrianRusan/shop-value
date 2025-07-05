'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

// Simple utility to combine class names
const classNames = (...classes: (string | undefined | boolean)[]): string => {
  return classes.filter(Boolean).join(' ');
};

interface TrackingButtonProps {
  productId: string;
  isTracked?: boolean;
  onTrackingChange?: (productId: string, isTracked: boolean) => Promise<void>;
  variant?: 'default' | 'minimal' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  disabled?: boolean;
}

const TrackingButton = ({
  productId,
  isTracked = false,
  onTrackingChange,
  variant = 'default',
  size = 'md',
  className,
  showText = true,
  disabled = false,
}: TrackingButtonProps) => {
  const { user, isSignedIn } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [trackingState, setTrackingState] = useState(isTracked);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | null>(null);
  
  // Ref to store the timeout ID for cleanup
  const feedbackTimeoutRef = useRef<number | null>(null);

  // Update local state when prop changes
  useEffect(() => {
    setTrackingState(isTracked);
  }, [isTracked]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleTrackingToggle = async () => {
    if (!isSignedIn || disabled || isLoading) return;

    setIsLoading(true);
    setShowFeedback(false);

    try {
      // Call the parent handler if provided
      if (onTrackingChange) {
        await onTrackingChange(productId, !trackingState);
      }

      // Update local state
      setTrackingState(!trackingState);
      setFeedbackType('success');
      setShowFeedback(true);

      // Clear any existing timeout before setting a new one
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      
      // Hide feedback after 2 seconds
      feedbackTimeoutRef.current = setTimeout(() => {
        setShowFeedback(false);
      }, 2000);
    } catch (error) {
      console.error('Error toggling tracking:', error);
      setFeedbackType('error');
      setShowFeedback(true);

      // Clear any existing timeout before setting a new one
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      
      // Hide error feedback after 3 seconds
      feedbackTimeoutRef.current = setTimeout(() => {
        setShowFeedback(false);
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Get button styles based on variant and size
  const getButtonStyles = () => {
    const baseStyles = 'relative inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const variantStyles: Record<string, string> = {
      default: trackingState 
        ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500' 
        : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500',
      minimal: trackingState 
        ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 focus:ring-red-500' 
        : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 focus:ring-blue-500',
      icon: trackingState 
        ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500' 
        : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500',
    };

    const sizeStyles: Record<string, string> = {
      sm: 'text-sm px-3 py-1.5 rounded-md',
      md: 'text-base px-4 py-2 rounded-lg',
      lg: 'text-lg px-6 py-3 rounded-xl',
    };

    const iconSizeStyles: Record<string, string> = {
      sm: 'p-1.5 rounded-full',
      md: 'p-2 rounded-full',
      lg: 'p-3 rounded-full',
    };

    return classNames(
      baseStyles,
      variantStyles[variant],
      variant === 'icon' ? iconSizeStyles[size] : sizeStyles[size],
      isLoading && 'opacity-70 cursor-not-allowed',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    );
  };

  // Get icon based on tracking state
  const getIcon = () => {
    if (isLoading) {
      return (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        </svg>
      );
    }

    return trackingState ? (
      // Heart filled (tracking)
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    ) : (
      // Heart outline (not tracking)
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
      </svg>
    );
  };

  // Get button text
  const getButtonText = () => {
    if (isLoading) {
      return trackingState ? 'Se oprește...' : 'Se adaugă...';
    }
    return trackingState ? 'Oprește urmărirea' : 'Urmărește';
  };

  // Get ARIA label
  const getAriaLabel = () => {
    if (isLoading) {
      return trackingState ? 'Se oprește urmărirea produsului' : 'Se adaugă produsul la urmărire';
    }
    return trackingState ? 'Oprește urmărirea acestui produs' : 'Începe urmărirea acestui produs';
  };

  // Don't render if user is not signed in
  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleTrackingToggle}
        disabled={disabled || isLoading}
        className={getButtonStyles()}
        aria-label={getAriaLabel()}
        title={getButtonText()}
      >
        {getIcon()}
        {showText && variant !== 'icon' && (
          <span className="ml-2">{getButtonText()}</span>
        )}
      </button>

      {/* Feedback overlay */}
      {showFeedback && (
        <div className={classNames(
          'absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 rounded-md text-sm font-medium z-50',
          feedbackType === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        )}>
          {feedbackType === 'success' ? (
            trackingState ? 'Produsul este urmărit!' : 'Urmărirea a fost oprită!'
          ) : (
            'A apărut o eroare. Încercați din nou.'
          )}
        </div>
      )}
    </div>
  );
};

export default TrackingButton;