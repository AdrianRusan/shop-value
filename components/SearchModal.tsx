'use client'

import { useState, useEffect, Fragment, FormEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { Product } from '@/types';
import { getProductByTitle } from '@/lib/actions';
import ThemedIcon from './ThemedIcon';
import ProductCard from './ProductCard';

const SearchModal = () => {

  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const debounceDelay = 250;

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;

    const fetchData = async () => {
      if (searchInput.length >= 3) {
        try {
          const productsData = await getProductByTitle(searchInput);
          
          if (productsData) {
            const products = productsData.map(( item: any ) => ({
              _id: String(item._id || ''),
              source: item.source || '',
              sourceSrc: item.sourceSrc || '',
              currency: item.currency || 'RON',
              image: item.image || '',
              title: item.title || '',
              currentPrice: Number(item.currentPrice) || 0,
              originalPrice: Number(item.originalPrice) || 0,
              category: item.category || '',
              isOutOfStock: item.isOutOfStock,
            }));
            setFilteredProducts(products);
          } else {
            setFilteredProducts([]);
            console.error("Error fetching products: productsData is undefined");
          }
        } catch (error) {
          console.error("Error fetching products:", error);
        }
      } else {
        setFilteredProducts([]);
      }
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set a new debounce timer to fetch data after a delay
    debounceTimer = setTimeout(() => {
      if (searchInput !== '') {
        fetchData();
      }
    }, debounceDelay);

    return () => {
      // Clean up by clearing the debounce timer if the component unmounts or the search input changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [searchInput]);

  const openModal = () => setIsOpen(true);
  const closeModal = () => {
    setIsOpen(false);
    setSearchInput('');
    setFilteredProducts([]);
  };

  const handleSearch = (input: string) => {
    setSearchInput(input);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    closeModal();
  };

  const handleProductCardClick = () => {
    closeModal();
  };


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

                  <div className='flex flex-wrap mt-5 xl:gap-x-6 lg:gap-x-9 md:gap-x-28 gap-y-5'>
                    {filteredProducts.map((product) => (
                      <div 
                        key={product._id}
                        onClick={() => handleProductCardClick()}
                      >
                        <ProductCard product={product} />
                      </div>
                    ))}
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