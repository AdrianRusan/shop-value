'use client'

import { useState, Fragment, FormEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { addUserEmailToProduct } from '@/lib/actions';

interface Props {
  productId: string;
}

const TrackModal = ({ productId }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    await addUserEmailToProduct(productId, email);

    setIsSubmitting(false);
    setEmail('');
    closeModal();
  };

  return (
    <>
      <button 
        type="button" 
        className="btn w-full touch-manipulation"
        onClick={openModal}
      >
        Urmărește
      </button>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" onClose={closeModal} className="dialog-container">
          <div className='min-h-screen px-4 sm:px-6 md:px-8 text-center'>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo='opacity-100'
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50" />
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
              {/* Enhanced mobile-responsive modal content */}
              <div className='inline-block w-full max-w-sm sm:max-w-md md:max-w-lg p-4 sm:p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-xl rounded-2xl'>
                <div className='flex flex-col'>
                  <div className='flex justify-between items-start mb-4'>
                    <div className='p-2 sm:p-3 border border-gray-300 dark:border-gray-600 rounded-lg'>
                      <Image 
                        src="/assets/icons/logo.svg"
                        alt="logo"
                        width={24}
                        height={24}
                        className="sm:w-7 sm:h-7"
                      />
                    </div>

                    <button
                      onClick={closeModal}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors touch-manipulation"
                      aria-label="Închide"
                    >
                      <Image 
                        src="/assets/icons/x-close.svg"
                        alt="close"
                        width={20}
                        height={20}
                        className="w-5 h-5 sm:w-6 sm:h-6"
                      />
                    </button>
                  </div>

                  <h4 className='text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2'>
                    Urmărește acest produs
                  </h4>
                  <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6'>
                    Nu veți mai rata niciodată o ofertă cu alertele noastre!
                  </p>
                  
                  <form 
                    className='flex flex-col space-y-4' 
                    onSubmit={handleSubmit}
                    name='track-product'
                  >
                    <div>
                      <label 
                        htmlFor='email' 
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                      >
                        Adresă de e-mail
                      </label>
                      <div className='relative flex items-center'>
                        <div className="absolute left-3 flex items-center pointer-events-none">
                          <Image 
                            src="/assets/icons/mail.svg"
                            alt="mail"
                            width={18}
                            height={18}
                            className="text-gray-400"
                          />
                        </div>
                        <input
                          required
                          type='email'
                          id="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder='Introduceți adresa dumneavoastră de e-mail'
                          className='w-full pl-10 pr-4 py-3 sm:py-4 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors touch-manipulation'
                          autoComplete='email'
                        />
                      </div>
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className='w-full py-3 sm:py-4 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold rounded-lg text-white text-base sm:text-lg transition-colors touch-manipulation focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    >
                      {isSubmitting ? 'Se creează alertele...' : 'Urmărește Produsul'}
                    </button>
                  </form>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default TrackModal;
