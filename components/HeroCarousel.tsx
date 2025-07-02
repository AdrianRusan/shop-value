'use client'

import Image from "next/image";
import { useEffect, useState } from "react";

const heroImages = [
  '/assets/images/hero-1.svg',
  '/assets/images/hero-2.svg',
  '/assets/images/hero-3.svg',
  '/assets/images/hero-4.svg',
  '/assets/images/hero-5.svg'
];

const HeroCarousel = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    // Only run on client side
    setIsMounted(true);
    
    // Check if it's desktop without external libraries
    const checkDesktop = () => {
      if (typeof window !== 'undefined') {
        setIsDesktop(window.innerWidth >= 1024);
      }
    };

    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    
    return () => {
      window.removeEventListener('resize', checkDesktop);
    };
  }, []);

  useEffect(() => {
    if (!isMounted || !isDesktop) return;

    // Simple auto-rotation
    const interval = setInterval(() => {
      setCurrentImage((prev: number) => (prev + 1) % heroImages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isMounted, isDesktop]);

  // Don't render anything during SSR or on mobile
  if (!isMounted || !isDesktop) {
    return null;
  }

  return (
    <div className="hero-carousel relative">
      <div className="w-[484px] h-[484px] relative overflow-hidden rounded-[30px] bg-[#F2F4F7]">
        {heroImages.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentImage ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={image}
              alt={`Product showcase ${index + 1}`}
              width={484}
              height={484}
              priority={index === 0}
              placeholder="blur"
              blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDg0IiBoZWlnaHQ9IjQ4NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciPjxzdG9wIHN0b3AtY29sb3I9IiNmMGYwZjAiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNlMGUwZTAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iNDg0IiBoZWlnaHQ9IjQ4NCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=="
              className="object-contain w-full h-full"
              style={{
                objectFit: 'contain',
                objectPosition: 'center',
              }}
            />
          </div>
        ))}
      </div>

      {/* Decorative arrow */}
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