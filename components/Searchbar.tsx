'use client'

import { scrapeAndScoreProductFlip  } from '@/lib/actions';
import { FormEvent, useState } from 'react';

const isValidFlipProductURL = (url: string) => {
  try {
    const parsedURL = new URL(url);
    const hostname = parsedURL.hostname;

    if (
      hostname.includes('flip.ro') && !url.includes('modelType')
    ) {
      return {
        isValid: true,
        source: 'flip',
      };
    }
  } catch (error) {
    return false;
  }
};

const Searchbar = () => {
  const [searchPrompt, setSearchPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const flipLink = isValidFlipProductURL(searchPrompt);
    
    if (!flipLink) {
      return alert('Please provide a valid link.');
    }

    try {
      setIsLoading(true);

      let product

      if (flipLink) {
        for (let i = 0; i < 3; i++) {
          product = await scrapeAndScoreProductFlip(searchPrompt);
        }      
      }

    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form
        className="flex flex-col mt-8 sm:mt-12 space-y-3 sm:space-y-4"
        onSubmit={handleSubmit}
      >
        <label className='text-sm sm:text-base font-medium text-gray-700 dark:text-white'>
          Nu găsești produsul?
        </label>
        
        <div className='flex flex-col sm:flex-row gap-3 sm:gap-4'>
          <div className="flex-1">
            <input
              type="text"
              aria-label='URL produs pentru căutare'
              placeholder="Introduceți link-ul produsului de pe Flip aici..."
              className="w-full px-4 py-3 sm:py-4 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors shadow-sm hover:shadow-md touch-manipulation"
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
              name="searchbar-input"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation shadow-sm hover:shadow-md whitespace-nowrap"
            disabled={searchPrompt === '' || isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Căutare...</span>
              </div>
            ) : (
              'Caută'
            )}
          </button>
        </div>
        
        {/* Help text for mobile users */}
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2">
          Introduceți un link valid de pe Flip.ro pentru a adăuga produsul la urmărire
        </p>
      </form>
    </div>
  );
};

export default Searchbar;
