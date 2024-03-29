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
      <button type="button" className="btn" onClick={openModal}>
        Urmărește
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
                  <div className='flex justify-between'>
                    <div className='p-3 border border-gray-500  rounded-10'>
                      <Image 
                        src="/assets/icons/logo.svg"
                        alt="logo"
                        width={28}
                        height={28}
                      />
                    </div>

                    <Image 
                      src="/assets/icons/x-close.svg"
                      alt="close"
                      width={0}
                      height={0}
                      className='cursor-pointer w-auto h-auto'
                      onClick={closeModal}
                    />
                  </div>

                  <h4 className='dialog-head_text'>
                    Rămâneți la curent cu alertele privind prețurile produselor direct pe e-mail.
                  </h4>
                  <p className='text-sm text-gray-600 mt-2 dark:text-white-200'>Nu veți mai rata niciodată o ofertă cu alertele noastre!</p>
                  <form 
                    className='flex flex-col mt-5' 
                    onSubmit={handleSubmit}
                    name='track-product '
                  >
                    <label htmlFor='email' className='text-sm font-medium text-gray-700 dark:text-gray-500'>
                      Adresă de e-mail
                    </label>
                    <div className='dialog-input_container'>
                      <Image 
                        src="/assets/icons/mail.svg"
                        alt="mail"
                        width={18}
                        height={18}
                      />

                      <input
                        required
                        type='email'
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder='Introduceți adresa dumneavoastră de e-mail'
                        className='dark:bg-slate-800 dialog-input max-sm:w-[98%]'
                        autoComplete='on'
                      />
                    </div>
                    <button type="submit" className='w-full mt-5 py-2 px-4 bg-secondary dark:bg-white-200 font-bold hover:bg-opacity-70 rounded-2xl text-white-200 dark:text-secondary text-lg;'>
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
