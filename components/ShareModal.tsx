'use client'

import { useState, useEffect, Fragment, MouseEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';

import {
  FacebookShareButton,
  FacebookIcon,
  RedditShareButton,
  RedditIcon,
  TwitterShareButton,
  TwitterIcon,
  WhatsappShareButton,
  WhatsappIcon,
  TelegramShareButton,
  TelegramIcon,
  LinkedinShareButton,
  LinkedinIcon,
} from 'next-share'

const ShareModal = () => {

  const [isOpen, setIsOpen] = useState(false);
  const [currentURL, setCurrentURL] = useState('');
  
  useEffect(() => {
    setCurrentURL(window.location.href);
  }, []);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const handleCopyLink = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(currentURL);
    } catch (err) {
      console.error('Unable to copy to clipboard:', err);
    }
  };

  return (
    <>
      <button type="button" onClick={openModal}>
        <div className="p-2 bg-white-200 rounded-10 flex justify-center items-center">
        <Image 
          src='/assets/icons/share.svg'
          alt='share'
          width={20}
          height={20}
          priority
        /> 
            </div>
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
                  <div className='flex justify-between pb-3 border-b-2'>
                    <h4 className='dialog-head_text'>
                      Share
                    </h4>
                    <Image 
                      src="/assets/icons/x-close.svg"
                      alt="close"
                      width={0}
                      height={0}
                      className='cursor-pointer w-auto h-auto'
                      onClick={closeModal}
                    />
                  </div>

                  <div className='flex flex-col gap-2 py-2 dark:text-white-200'>
                    <p>Share this link via</p>
                    <div className='flex justify-between max-sm:flex-col items-center gap-y-2'>
                      <div className='flex justify-evenly w-full gap-1'>
                        <FacebookShareButton
                          url={currentURL}
                          quote={'next-share is a social share buttons for your next React apps.'}
                          hashtag={'#shopvalue'}
                        >
                          <FacebookIcon size={48} round />
                        </FacebookShareButton>

                        <RedditShareButton
                          url={currentURL}
                          title={'next-share is a social share buttons for your next React apps.'}
                        >
                          <RedditIcon size={48} round />
                        </RedditShareButton>

                        <TwitterShareButton
                          url={currentURL}
                          title={'next-share is a social share buttons for your next React apps.'}
                        >
                          <TwitterIcon size={48} round />
                        </TwitterShareButton>
                      </div>
                      <div className='flex justify-evenly w-full gap-1'>
                        <WhatsappShareButton
                          url={currentURL}
                          title={'next-share is a social share buttons for your next React apps.'}
                          separator=":: "
                        >
                          <WhatsappIcon size={48} round />
                        </WhatsappShareButton>

                        <TelegramShareButton
                          url={currentURL}
                          title={'next-share is a social share buttons for your next React apps.'}
                        >
                          <TelegramIcon size={48} round />
                        </TelegramShareButton>

                        <LinkedinShareButton 
                          url={currentURL}
                        >
                          <LinkedinIcon size={48} round />
                        </LinkedinShareButton>
                      </div>

                    </div>
                  </div>

                  <form 
                  className='flex flex-col mt-5 dark:text-white-200'
                  name='share-link'
                  >
                    <p>Or copy link</p>
                    <div className='flex flex-col gap-2'>
                      <div className='dialog-input_container'>
                        <div className='flex w-[98%]'>
                          <Image 
                            src="/assets/icons/link.svg"
                            alt="link"
                            width={18}
                            height={18}
                          />

                          <input
                            required
                            type='text'
                            id="link"
                            defaultValue={currentURL}
                            readOnly
                            className='dark:bg-slate-800 dialog-input max-sm:w-[98%]'
                          />
                        </div>
                      </div>
                      <button 
                          className='w-full mt-3 py-2 px-4 bg-secondary dark:bg-white-200 font-bold hover:bg-opacity-70 rounded-2xl text-white-200 dark:text-secondary text-lg;'
                          onClick={handleCopyLink}
                        >
                          Copy
                      </button>
                    </div>
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

export default ShareModal;
