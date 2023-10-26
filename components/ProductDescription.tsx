'use client'

import Image from 'next/image';
import React, { useState } from 'react';

type ProductDescriptionProps = {
  description: string;
};

const ProductDescription: React.FC<ProductDescriptionProps> = ({ description }) => {
  const [showAll, setShowAll] = useState(false);
  const characterLimit = 1500;
  const isTextOverLimit = description.length > characterLimit;

  let displayedDescription = description;

  if (!showAll && isTextOverLimit) {
    displayedDescription = description.slice(0, characterLimit) + '...';
  }
  const regex = /(?<=[.!?])\s+(?=[A-ZĂÎȘÂȚ\d])|\d+\.\s+|\n+(?!\d+\.\s+)|(?<=[a-z])(?=[A-Z](?![a-z]))|(?<=[?])(?=[A-ZĂÎȘÂȚĂÎȘÂȚ\d])/;

  return (
    <div className="flex flex-col gap-4 whitespace-pre-line" style={{ position: 'relative' }}>
      {displayedDescription.split(regex).map((paragraph, index) => (
        <p key={index} className="[&:nth-child(1)]:text-3xl [&:nth-child(1)]:font-bold [&:nth-child(2)]:text-xl [&:nth-child(2)]:font-bold [&:nth-child(3)]:text-lg [&:nth-child(3)]:font-bold text-elipsis overflow-ellipsis">
          {paragraph}
        </p>
      ))}

      {isTextOverLimit && (
        <button onClick={() => setShowAll(!showAll)} className="w-fit text-[#066FE3] font-bold">
          {showAll ? (
              <div className='flex'>
                View Less
                <Image 
                  src="/assets/icons/arrow-up-small.svg"
                  alt="arrow-up"
                  width={20}
                  height={20}
                  className="w-5 h-5"
                /> 
              </div>
            ) : (
              <div className='flex'>
                View More
                <Image 
                  src="/assets/icons/arrow-down-small.svg"
                  alt="arrow-down"
                  width={20}
                  height={20}
                  className="w-5 h-5"
                /> 
              </div>
            )
          }
        </button>
      )}
    </div>
  );
};

export default ProductDescription;