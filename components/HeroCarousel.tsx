'use client'

import { isDesktop } from "react-device-detect";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { Carousel } from 'react-responsive-carousel';
import Image from "next/image";
import { useEffect, useState } from "react";

const heroImages = [
  {
    imgUrl: '/assets/images/hero-1.svg',
    alt: 'smart watch',
  },
  {
    imgUrl: '/assets/images/hero-2.svg',
    alt: 'bag',
  },
  {
    imgUrl: '/assets/images/hero-3.svg',
    alt: 'lamp',
  },
  {
    imgUrl: '/assets/images/hero-4.svg',
    alt: 'air fryer',
  },
  {
    imgUrl: '/assets/images/hero-5.svg',
    alt: 'chair',
  }
];

const HeroCarousel = () => {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(isDesktop);
  }, []);

  // Don't render on mobile to improve performance
  if (!desktop) {
    return null;
  }

  return (
    <div className="hero-carousel relative">
      <Carousel
        showThumbs={false}
        autoPlay
        infiniteLoop
        interval={3000}
        showArrows={false}
        showStatus={false}
        showIndicators={false}
        ariaLabel="Product showcase carousel"
        labels={{ leftArrow: "", rightArrow: "", item: "slide item" }}
        preventMovementUntilSwipeScrollTolerance={true}
        swipeScrollTolerance={50}
      >
        {heroImages.map((image, index) => (
          <div 
            key={`${image.alt}-${index}`} 
            className="object-contain relative"
            style={{ height: '484px' }}
          >
            <Image
              src={image.imgUrl}
              alt={image.alt}
              width={484}
              height={484}
              priority={index === 0}
              placeholder="blur"
              blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDg0IiBoZWlnaHQ9IjQ4NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciPjxzdG9wIHN0b3AtY29sb3I9IiNmMGYwZjAiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNlMGUwZTAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iNDg0IiBoZWlnaHQ9IjQ4NCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=="
              sizes="(max-width: 1024px) 0px, 484px"
              className="object-contain"
              style={{
                maxWidth: '100%',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>
        ))}
      </Carousel>

      {/* Decorative arrow - lazy loaded */}
      <Image
        src="/assets/icons/hand-drawn-arrow.svg"
        alt="decorative arrow"
        width={175}
        height={175}
        className="absolute -left-[15%] bottom-0 z-0 w-auto h-auto hidden xl:block"
        priority={false}
      />
    </div>
  );
};

export default HeroCarousel;