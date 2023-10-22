'use client'

import { scrapeAndScoreProductFlip  } from '@/lib/actions';
import { FormEvent, useState } from 'react';

//  Not Valid
// const isValidEmagProductURL = (url: string) => {
//   try {
//     const parsedURL = new URL(url);
//     const hostname = parsedURL.hostname;

//     if (
//       (hostname.includes('emag.ro') ||
//         hostname.includes('emag.bg') ||
//         hostname.includes('emag.hu') ||
//         hostname.includes('emag.net') ||
//         hostname.endsWith('emag'))
//     ) {
//       return {
//         isValid: true,
//         source: 'emag',
//       };
//     }
//   } catch (error) {
//     return false;
//   }
// };

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

    //  Not Valid
    // const emagLink = isValidEmagProductURL(searchPrompt);
    const flipLink = isValidFlipProductURL(searchPrompt);
    
    //  Not Valid
    // if (!emagLink && !flipLink) {
    //   return alert('Please provide a valid link.');
    // }

    if (!flipLink) {
      return alert('Please provide a valid link.');
    }

    try {
      setIsLoading(true);
      
      // Not Valid
      // if (emagLink) {
      //   const product = await scrapeAndScoreProductEmag(searchPrompt);
      // } else if (flipLink) {
      //   const product = await scrapeAndScoreProductFlip(searchPrompt);
      // }

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
      className="flex flex-wrap gap-4 mt-12"
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        placeholder="Enter product link"
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
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
};

export default Searchbar;
