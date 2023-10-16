'use client'

import { scrapeAndScoreProduct } from '@/lib/actions';
import { url } from 'inspector'
import { FormEvent, useState } from 'react'

const isValidEmagProductURL = (url: string) => {
  try {
    const parsedURL = new URL(url);
    const hostname = parsedURL.hostname;

    if (hostname.includes('emag.ro') || hostname.includes('emag.bg') || hostname.includes('emag.hu') || hostname.includes('emag.net') || hostname.endsWith('emag')) {
      return true
    }
  } catch (error) {
    return false
  }
}

const Searchbar = () => {

  const [searchPrompt, setSearchPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const isValidLink = isValidEmagProductURL(searchPrompt)

    if (!isValidLink) return alert('Please provide a valid Emag link')

    try {
      setIsLoading(true)

      // Scrape the product page
      const product = await scrapeAndScoreProduct(searchPrompt)

    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form 
      className="flex flex-wrap gap-4 mt-12"
      onSubmit={handleSubmit}
    >
      <input 
        type="text"
        placeholder="Enter product link"
        className="searchbar-input dark:bg-secondary"
        value={searchPrompt}
        onChange={(e) => setSearchPrompt(e.target.value)}
        name='searchbar-input'
      />

      <button 
        type="submit" 
        className="searchbar-btn"
        disabled={searchPrompt === ''}
      >
        {isLoading ? 'Searching...' : 'Search'}
          
      </button>
    </form>
  )
}

export default Searchbar