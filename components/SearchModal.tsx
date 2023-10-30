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

  const debounceDelay = 250;
  let debounceTimer: NodeJS.Timeout | null = null;

  useEffect(() => {
    const fetchData = async () => {
      if (searchInput.length >= 2) {
        try {
          const productsData = await searchProducts(searchInput);
          setSuggestions(productsData || {});
        } catch (error) {
          console.error('Error fetching suggestions:', error);
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
            model: product.model,
          }));
          setDefaultSuggestions(defaultSuggestionObjects);
        }
      })();
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      if (searchInput !== '') {
        fetchData();
      }
    }, debounceDelay);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    }, 1000);
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

  const renderModelSuggestions = (item: { brand: string; model: string }) => (
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

  return (
    <>
      <button onClick={openModal} className='searchbar-top gap-2 text-[#415985] dark:text-[#A7B5B9]'>
        <ThemedIcon alt='search' />
        Product Search...
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
                    <form className='flex flex-col w-full' onSubmit={handleSubmit} name='track-product'>
                      <div className='dialog-input_container flex items-center'>
                        <ThemedIcon alt='search' />
                        <input
                          required
                          type='text'
                          id='search-input'
                          value={searchInput}
                          onChange={e => handleSearch(e.target.value)}
                          placeholder='Search products...'
                          className='dark:bg-slate-800 dialog-input dark:text-white-200'
                          autoComplete='on'
                        />
                      </div>
                    </form>
                    <Image
                      src='/assets/icons/x-close.svg'
                      alt='close'
                      width={0}
                      height={0}
                      onClick={closeModal}
                      className='cursor-pointer w-auto h-auto'
                    />
                  </div>

                  <div className='mt-3 space-y-4 dark:text-white'>
                    <h3>Sugestii de cautare:</h3>
                    {!suggestions.brandModelObjects ? renderDefaultSuggestions() : null}
                    {suggestions.brands && suggestions.brands.length > 0
                      ? renderBrandSuggestions(suggestions.brands[0])
                      : null}
                    {suggestions.brandModelObjects && suggestions.brandModelObjects.length > 0
                      ? renderModelSuggestions(suggestions.brandModelObjects[0])
                      : null}
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