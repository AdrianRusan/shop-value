'use client'

import React, { useState, useEffect, Fragment, FormEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { searchProducts } from '@/lib/actions';
import ThemedIcon from './ThemedIcon';
import Link from 'next/link';

function wrapMatchedText(text: string, match: string): React.ReactNode {
  const parts = text.split(new RegExp(`(${match})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === match.toLowerCase() ? (
      <strong key={index}>{part}</strong>
    ) : (
      part
    )
  );
}

const SearchModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<any>({});
  const [defaultSuggestions, setDefaultSuggestions] = useState<Array<{ brand: string; model: string }>>([
    { brand: '', model: '' },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const debounceDelay = 250;
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (searchInput.length >= 2) {
        setIsLoading(true);
        try {
          const productsData = await searchProducts(searchInput);
          setSuggestions(productsData || {});
        } catch (error) {
          console.error('Error fetching suggestions:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions({});
      }
    };

    if (searchInput.length === 0) {
      (async () => {
        const topProducts = await searchProducts('');
        if (topProducts && topProducts.topSearchedProducts) {
          const defaultSuggestionObjects = topProducts.topSearchedProducts.map(product => ({
            brand: product.brand,
            model: product.productModel,
          }));
          setDefaultSuggestions(defaultSuggestionObjects);
        }
      })();
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (searchInput !== '') {
        fetchData();
      }
    }, debounceDelay);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchInput]);

  const openModal = () => setIsOpen(true);
  const closeModal = () => {
    setIsOpen(false);
    setSearchInput('');
    setSuggestions({});
  };

  const handleSearch = (input: string) => {
    setSearchInput(input);
  };

  const handleSearchSubmit = () => {
    if (searchInput) {
      // Assuming the search input directly corresponds to a product path
      window.location.href = `/produse/samsung/${searchInput.replace(/ /g, '-')}`;
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearchSubmit();
    closeModal();
  };

  const capitalizeItem = (item: string): string => {
    return item
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleProductCardClick = () => {
    setTimeout(() => {
      closeModal();
    }, 500);
  };

  const renderDefaultSuggestions = () => (
    <div className='py-2 rounded-md'>
      <ul>
        {defaultSuggestions.map((suggestion, index) => (
          <Link href={`/produse/${suggestion.brand}/${suggestion.model.replace(/ /g, '-')}`} key={index}>
            <li className='py-2 hover:scale-105' onClick={handleProductCardClick}>
              {wrapMatchedText(suggestion.model, searchInput)}
              {defaultSuggestions.length > 1 && <hr />}
            </li>
          </Link>
        ))}
      </ul>
    </div>
  );

  const renderBrandSuggestions = (brand: string) => (
    <div className='py-2 rounded-md'>
      <ul>
        <Link href={`/produse/${brand}`}>
          <li className='py-2 hover:scale-105' onClick={handleProductCardClick}>
            {wrapMatchedText(capitalizeItem(brand), searchInput)}
          </li>
        </Link>
      </ul>
    </div>
  );

  const renderModelSuggestions = (item: { brand: string; model: string }) => {

      return (
        <div className='py-2 rounded-md'>
          <ul>
            <Link href={`/produse/${item.brand}/${item.model.replace(/ /g, '-')}`}>
              <li className='py-2 hover:scale-105' onClick={handleProductCardClick}>
                {wrapMatchedText(item.model, searchInput)}
              </li>
            </Link>
          </ul>
        </div>
      );
  };

  return (
    <>
      <button
        onClick={openModal}
        className='searchbar-top gap-2 text-[#415985] dark:text-[#A7B5B9]'
        aria-label='Deschide modalul de căutare produse'
      >
        <ThemedIcon alt='search' />
        Caută produsul dorit...
      </button>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as='div' onClose={closeModal} className='dialog-container'>
          <div className='min-h-screen px-4 text-center'>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-300'
              enterFrom='opacity-0'
              enterTo='opacity-100'
              leave='ease-in duration-200'
              leaveFrom='opacity-100'
              leaveTo='opacity-0'
            >
              <Dialog.Overlay className='fixed inset-0' />
            </Transition.Child>

            <span className='inline-block h-screen align-middle' aria-hidden='true' />

            <Transition.Child
              as={Fragment}
              enter='ease-out duration-300'
              enterFrom='opacity-0 scale-95'
              enterTo='opacity-100 scale-100'
              leave='ease-in duration-200'
              leaveFrom='opacity-100 scale-100'
              leaveTo='opacity-0 scale-95'
            >
              <div className='dialog-content'>
                <div className='flex flex-col'>
                  <div className='flex justify-between items-center gap-5'>
                    <form className='flex flex-col w-full' onSubmit={handleSubmit} name='track-product' role='search'>
                      <div className='dialog-input_container flex items-center'>
                        <button
                          type="submit"
                          onClick={() => handleSearchSubmit()}
                          aria-label='Caută produse'
                        >
                          <ThemedIcon alt='search'/>
                        </button>
                        <input
                          required
                          type='text'
                          id='search-input'
                          value={searchInput}
                          onChange={e => handleSearch(e.target.value)}
                          placeholder='Caută...'
                          className='dark:bg-slate-800 dialog-input dark:text-white-200'
                          autoComplete='on'
                          aria-label='Câmp de căutare produse'
                        />
                      </div>
                    </form>
                    <button
                      onClick={closeModal}
                      className='cursor-pointer'
                      aria-label='Închide modalul de căutare'
                    >
                      <Image
                        src='/assets/icons/x-close.svg'
                        alt='close'
                        width={24}
                        height={24}
                      />
                    </button>
                  </div>

                  <div className='mt-3 space-y-4 dark:text-white'>
                    <h3>Sugestii de Căutare:</h3>
                    {isLoading ? (
                      <div className='flex items-center justify-center py-4'>
                        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
                      </div>
                    ) : (
                      <>
                        {!suggestions.brandModelObjects ? renderDefaultSuggestions() : null}
                        {suggestions.brands && suggestions.brands.length > 0
                          ? renderBrandSuggestions(suggestions.brands[0])
                          : null}
                        {suggestions.brandModelObjects && suggestions.brandModelObjects.length > 0
                          ? renderModelSuggestions(suggestions.brandModelObjects[0])
                          : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default SearchModal;