'use client'

import { useState, useEffect, Fragment, FormEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { Product } from '@/types';
import { getProductByTitle } from '@/lib/actions';
import ThemedIcon from './ThemedIcon';


const SearchModal = () => {
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const products = await getProductByTitle(searchInput);
        setFilteredProducts(products || []);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    }

    fetchData();
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

  return (
    <>
      <button onClick={openModal} className='searchbar-top gap-2'>
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
                  <div className='flex justify-between gap-5'>
                    <form 
                      className='flex flex-col w-full' 
                      onSubmit={handleSubmit}
                      name='track-product'
                    >
                      <div className='dialog-input_container'>
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
                        {filteredProducts.map((product) => (
                          <div key={product._id}>{product.title}</div>
                        ))}
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