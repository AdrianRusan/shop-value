'use client'

import React, { useState, useEffect, Fragment, FormEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { searchProducts } from '@/lib/actions'; // Update the import to the new function
import ThemedIcon from './ThemedIcon';
import { Product } from '@/types';
import Link from 'next/link';

const SearchModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<any>({});

  const debounceDelay = 250;

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;

    const fetchData = async () => {
      if (searchInput.length >= 3) {
        try {
          const productsData = await searchProducts(searchInput);
          if (productsData) {
            setSuggestions(productsData);
          } else {
            setSuggestions({});
          }
        } catch (error) {
          console.error('Error fetching suggestions:', error);
        }
      } else {
        setSuggestions({});
      }
    };

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    closeModal();
  };

  function capitalizeItem(item: string): string {
    return item
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const handleProductCardClick = () => {
    setTimeout(() => {
      closeModal();
    }, 1000);
  };

  const defaultSuggestions = ['Suggestion 1', 'Suggestion 2', 'Suggestion 3', 'Suggestion 4'];

  return (
    <>
      <button onClick={openModal} className='searchbar-top gap-2 text-[#415985] dark:text-[#A7B5B9]'>
        <ThemedIcon alt='search' />
        Product Search...
      </button>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" onClose={closeModal} className="dialog-container">
          <div className='min-h-screen px-4 text-center'>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo='opacity-100'
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0" />
            </Transition.Child>

            <span className='inline-block h-screen align-middle' aria-hidden='true' />

            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom='opacity-0 scale-95'
              enterTo='opacity-100 scale-100'
              leave="ease-in duration-200"
              leaveFrom='opacity-100 scale-100'
              leaveTo='opacity-0 scale-95'
            >
              <div className='dialog-content'>
                <div className='flex flex-col'>
                  <div className='flex justify-between items-center gap-5'>
                    <form
                      className='flex flex-col w-full'
                      onSubmit={handleSubmit}
                      name='track-product'
                    >
                      <div className='dialog-input_container flex items-center'>
                        <ThemedIcon alt='search' />

                        <input
                          required
                          type='text'
                          id="search-input"
                          value={searchInput}
                          onChange={(e) => handleSearch(e.target.value)}
                          placeholder='Search products...'
                          className='dark:bg-slate-800 dialog-input dark:text-white-200'
                          autoComplete='on'
                        />
                      </div>
                    </form>

                    <Image
                      src="/assets/icons/x-close.svg"
                      alt="close"
                      width={0}
                      height={0}
                      onClick={closeModal}
                      className='cursor-pointer w-auto h-auto'
                    />
                  </div>

                  <div className='mt-3 space-y-4 dark:text-white'>
                    <h3>Sugestii de cautare:</h3>
                    {defaultSuggestions.map((suggestion, index) => (
                      <div className='py-2 rounded-md' key={index}>
                        <ul>
                          <li className='py-2 hover:scale-105' onClick={handleProductCardClick}>
                            {capitalizeItem(suggestion)}
                            {defaultSuggestions.length > 1 && <hr />}
                          </li>
                        </ul>
                      </div>
                    ))}
                    {suggestions.brands && suggestions.brands.length > 0 && (
                      <div className='py-2 rounded-md'>
                        <ul>
                          {suggestions.brands.map((brand: string, index: number) => (
                            <Link href={`/produse/${brand}`} key={index}>
                              <li className='py-2 hover:scale-105' onClick={handleProductCardClick}>
                                {capitalizeItem(brand)}
                                {suggestions.brands.length > 1 && <hr />}
                              </li>
                            </Link>
                          ))}
                        </ul>
                      </div>
                    )}
                    {suggestions.brandModelObjects && suggestions.brandModelObjects.length > 0 && (
                      <div className='py-2 rounded-md'>
                        <ul>
                          {suggestions.brandModelObjects.map((item: any, index: number) => (
                            <Link href={`/produse/${item.brand}/${item.model.replace(/ /g, '-')}`} key={index}>
                              <li className='py-2 hover:scale-105' onClick={handleProductCardClick}>
                                {item.model}
                                {suggestions.brandModelObjects.length > 1 && <hr />}
                              </li>
                            </Link>
                          ))}
                        </ul>
                      </div>
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