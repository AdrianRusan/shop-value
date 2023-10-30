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

      if (flipLink) {
        const product = await scrapeAndScoreProductFlip(searchPrompt);
      }

    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      className="flex flex-col mt-12 "
      onSubmit={handleSubmit}
    >
      <label className='dark:text-white text-sm'>Nu găsești produsul?</label>
      <div className='flex flex-wrap gap-4 mt-1 max-sm:flex-col'>
        <input
          type="text"
          aria-label='sadasd'
          placeholder="Introduceți link-ul produsului de pe Flip aici..."
          className="searchbar-input dark:text-white-200"
          value={searchPrompt}
          onChange={(e) => setSearchPrompt(e.target.value)}
          name="searchbar-input"
        />

        <button
          type="submit"
          className="searchbar-btn"
          disabled={searchPrompt === ''}
        >
          {isLoading ? 'Căutare...' : 'Caută'}
        </button>
      </div>
    </form>
  );
};

export default Searchbar;
