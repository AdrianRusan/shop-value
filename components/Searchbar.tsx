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
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const flipLink = isValidFlipProductURL(searchPrompt);

    if (!flipLink) {
      setError('Vă rugăm să furnizați un link valid de la Flip.ro');
      return;
    }

    try {
      setIsLoading(true);

      if (flipLink) {
        await scrapeAndScoreProductFlip(searchPrompt);
      }

    } catch (error) {
      console.error(error);
      setError('A apărut o eroare la căutarea produsului. Vă rugăm să încercați din nou.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      className="flex flex-col mt-12 "
      onSubmit={handleSubmit}
    >
      <label htmlFor="product-url-input" className='dark:text-white text-sm'>Nu găsești produsul?</label>
      <div className='flex flex-wrap gap-4 mt-1 max-sm:flex-col'>
        <input
          id="product-url-input"
          type="text"
          aria-label='Introduceți link-ul produsului'
          aria-describedby={error ? 'search-error' : undefined}
          aria-invalid={error ? 'true' : 'false'}
          placeholder="Introduceți link-ul produsului de pe Flip aici..."
          className="searchbar-input dark:text-white-200"
          value={searchPrompt}
          onChange={(e) => setSearchPrompt(e.target.value)}
          name="searchbar-input"
        />

        <button
          type="submit"
          className="searchbar-btn"
          disabled={searchPrompt === '' || isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? 'Căutare...' : 'Caută'}
        </button>
      </div>
      {error && (
        <p id="search-error" className="text-red-600 dark:text-red-400 text-sm mt-2" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};

export default Searchbar;
