'use client'

import { useState, Fragment, FormEvent, ChangeEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { createPriceAlert } from '@/lib/actions/price-alert';
import { formatPrice } from '@/lib/utils';

interface Props {
  productId: string;
  productTitle: string;
  currentPrice: number;
  currency: string;
  userEmail?: string;
  userId?: string;
}

type AlertType = 'target_price' | 'percentage_drop' | 'significant_drop' | 'back_in_stock' | 'any_drop';
type FrequencyType = 'immediate' | 'daily' | 'weekly';

const PriceAlertModal = ({ 
  productId, 
  productTitle, 
  currentPrice, 
  currency, 
  userEmail, 
  userId 
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Form states
  const [email, setEmail] = useState(userEmail || '');
  const [alertType, setAlertType] = useState<AlertType>('target_price');
  const [targetPrice, setTargetPrice] = useState<number>(currentPrice * 0.9);
  const [percentageThreshold, setPercentageThreshold] = useState<number>(10);
  const [significantDropAmount, setSignificantDropAmount] = useState<number>(50);
  const [frequency, setFrequency] = useState<FrequencyType>('immediate');
  const [maxAlertsPerDay, setMaxAlertsPerDay] = useState<number>(3);

  const openModal = () => setIsOpen(true);
  const closeModal = () => {
    setIsOpen(false);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!email) {
      newErrors.email = 'Email este obligatoriu';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalid';
    }
    
    if (alertType === 'target_price') {
      if (!targetPrice || targetPrice <= 0) {
        newErrors.targetPrice = 'Prețul țintă trebuie să fie mai mare decât 0';
      } else if (targetPrice >= currentPrice) {
        newErrors.targetPrice = 'Prețul țintă trebuie să fie mai mic decât prețul curent';
      }
    }
    
    if (alertType === 'percentage_drop') {
      if (!percentageThreshold || percentageThreshold < 1 || percentageThreshold > 90) {
        newErrors.percentageThreshold = 'Procentul trebuie să fie între 1% și 90%';
      }
    }
    
    if (alertType === 'significant_drop') {
      if (!significantDropAmount || significantDropAmount < 1) {
        newErrors.significantDropAmount = 'Suma trebuie să fie mai mare decât 0';
      }
    }
    
    if (maxAlertsPerDay < 1 || maxAlertsPerDay > 50) {
      newErrors.maxAlertsPerDay = 'Numărul de alerte pe zi trebuie să fie între 1 și 50';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const alertData = {
        userId: userId || '',
        productId,
        email,
        alertType,
        targetPrice: alertType === 'target_price' ? targetPrice : undefined,
        percentageThreshold: alertType === 'percentage_drop' ? percentageThreshold : undefined,
        significantDropAmount: alertType === 'significant_drop' ? significantDropAmount : undefined,
        frequency,
        maxAlertsPerDay
      };
      
      await createPriceAlert(alertData);
      
      closeModal();
    } catch (error) {
      console.error('Error creating price alert:', error);
      setErrors({ submit: 'Eroare la crearea alertei. Vă rugăm încercați din nou.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAlertTypeDescription = () => {
    switch (alertType) {
      case 'target_price':
        return `Vei primi alertă când prețul ajunge la ${formatPrice(targetPrice, currency)}`;
      case 'percentage_drop':
        return `Vei primi alertă când prețul scade cu ${percentageThreshold}%`;
      case 'significant_drop':
        return `Vei primi alertă când prețul scade cu ${significantDropAmount} ${currency}`;
      case 'back_in_stock':
        return 'Vei primi alertă când produsul revine în stoc';
      case 'any_drop':
        return 'Vei primi alertă la orice scădere de preț';
      default:
        return '';
    }
  };

  return (
    <>
      <button 
        type="button" 
        className="btn w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        onClick={openModal}
      >
        <div className="flex items-center justify-center gap-2">
          <Image 
            src="/assets/icons/price-tag.svg"
            alt="price alert"
            width={20}
            height={20}
          />
          Setează Alertă de Preț
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
              <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
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
              <div className='dialog-content max-w-md w-full'>
                <div className='flex flex-col'>
                  <div className='flex justify-between items-center mb-4'>
                    <div className='p-3 border border-gray-300 rounded-lg'>
                      <Image 
                        src="/assets/icons/price-tag.svg"
                        alt="price alert"
                        width={24}
                        height={24}
                      />
                    </div>

                    <Image 
                      src="/assets/icons/x-close.svg"
                      alt="close"
                      width={24}
                      height={24}
                      className='cursor-pointer'
                      onClick={closeModal}
                    />
                  </div>

                  <h4 className='dialog-head_text mb-2'>
                    Configurează Alerta de Preț
                  </h4>
                  <p className='text-sm text-gray-600 dark:text-gray-400 mb-6'>
                    Pentru: {productTitle}
                  </p>

                  <form className='flex flex-col space-y-4' onSubmit={handleSubmit}>
                    {/* Email Input */}
                    <div>
                      <label htmlFor='email' className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block'>
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
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                          placeholder='Introduceți adresa de e-mail'
                          className='dark:bg-slate-800 dialog-input flex-1'
                        />
                      </div>
                      {errors.email && (
                        <p className='text-red-500 text-xs mt-1'>{errors.email}</p>
                      )}
                    </div>

                    {/* Alert Type Selection */}
                    <div>
                      <label className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block'>
                        Tipul alertei
                      </label>
                      <select
                        value={alertType}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setAlertType(e.target.value as AlertType)}
                        className='w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-gray-600 dark:text-white'
                      >
                        <option value="target_price">Preț țintă</option>
                        <option value="percentage_drop">Scădere procentuală</option>
                        <option value="significant_drop">Scădere semnificativă</option>
                        <option value="back_in_stock">Revine în stoc</option>
                        <option value="any_drop">Orice scădere</option>
                      </select>
                    </div>

                    {/* Alert Configuration */}
                    {alertType === 'target_price' && (
                      <div>
                        <label className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block'>
                          Preț țintă ({currency})
                        </label>
                        <input
                          type='number'
                          value={targetPrice}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setTargetPrice(Number(e.target.value))}
                          min="0"
                          step="0.01"
                          placeholder='Introduceți prețul țintă'
                          className='w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-gray-600 dark:text-white'
                        />
                        {errors.targetPrice && (
                          <p className='text-red-500 text-xs mt-1'>{errors.targetPrice}</p>
                        )}
                      </div>
                    )}

                    {alertType === 'percentage_drop' && (
                      <div>
                        <label className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block'>
                          Procentul de scădere (%)
                        </label>
                        <input
                          type='number'
                          value={percentageThreshold}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setPercentageThreshold(Number(e.target.value))}
                          min="1"
                          max="90"
                          placeholder='Introduceți procentul'
                          className='w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-gray-600 dark:text-white'
                        />
                        {errors.percentageThreshold && (
                          <p className='text-red-500 text-xs mt-1'>{errors.percentageThreshold}</p>
                        )}
                      </div>
                    )}

                    {alertType === 'significant_drop' && (
                      <div>
                        <label className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block'>
                          Suma de scădere ({currency})
                        </label>
                        <input
                          type='number'
                          value={significantDropAmount}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setSignificantDropAmount(Number(e.target.value))}
                          min="1"
                          placeholder='Introduceți suma'
                          className='w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-gray-600 dark:text-white'
                        />
                        {errors.significantDropAmount && (
                          <p className='text-red-500 text-xs mt-1'>{errors.significantDropAmount}</p>
                        )}
                      </div>
                    )}

                    {/* Frequency Selection */}
                    <div>
                      <label className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block'>
                        Frecvența alertelor
                      </label>
                      <select
                        value={frequency}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setFrequency(e.target.value as FrequencyType)}
                        className='w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-gray-600 dark:text-white'
                      >
                        <option value="immediate">Imediat</option>
                        <option value="daily">Zilnic</option>
                        <option value="weekly">Săptămânal</option>
                      </select>
                    </div>

                    {/* Max Alerts Per Day */}
                    <div>
                      <label className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block'>
                        Numărul maxim de alerte pe zi
                      </label>
                      <input
                        type='number'
                        value={maxAlertsPerDay}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setMaxAlertsPerDay(Number(e.target.value))}
                        min="1"
                        max="50"
                        className='w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-gray-600 dark:text-white'
                      />
                      {errors.maxAlertsPerDay && (
                        <p className='text-red-500 text-xs mt-1'>{errors.maxAlertsPerDay}</p>
                      )}
                    </div>

                    {/* Preview */}
                    <div className='bg-blue-50 dark:bg-slate-700 p-3 rounded-lg'>
                      <p className='text-sm text-blue-700 dark:text-blue-300'>
                        <strong>Previzualizare:</strong> {getAlertTypeDescription()}
                      </p>
                    </div>

                    {/* Submit Button */}
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className='w-full mt-6 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 font-semibold rounded-lg text-white transition-colors'
                    >
                      {isSubmitting ? 'Se creează alerta...' : 'Creează Alerta'}
                    </button>

                    {errors.submit && (
                      <p className='text-red-500 text-sm text-center mt-2'>{errors.submit}</p>
                    )}
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

export default PriceAlertModal;