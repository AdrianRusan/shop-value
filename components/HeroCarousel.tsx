'use client'

import { isDesktop } from "react-device-detect";
import Image from "next/image";
import { useEffect, useState, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";

// Dynamically import carousel only when needed to reduce initial bundle size
const Carousel = dynamic(
  () => import('react-responsive-carousel').then((mod) => mod.Carousel),
  {
    ssr: false,
    loading: () => (
      <div className="hero-carousel flex items-center justify-center">
        <div className="loading-skeleton w-full h-full rounded-[30px]" />
      </div>
    ),
  }
);

// Lazy load carousel styles
const CarouselStyles = dynamic(
  () => import("react-responsive-carousel/lib/styles/carousel.min.css").then(() => ({ default: () => null })),
  { ssr: false }
);

const heroImages = [
  {
    imgUrl: '/assets/images/hero-1.svg',
    alt: 'smart watch',
    priority: true, // First image gets priority loading
  },
  {
    imgUrl: '/assets/images/hero-2.svg',
    alt: 'bag',
    priority: false,
  },
  {
    imgUrl: '/assets/images/hero-3.svg',
    alt: 'lamp',
    priority: false,
  },
  {
    imgUrl: '/assets/images/hero-4.svg',
    alt: 'air fryer',
    priority: false,
  },
  {
    imgUrl: '/assets/images/hero-5.svg',
    alt: 'chair',
    priority: false,
  }
];

const HeroCarousel = () => {
  const [desktop, setDesktop] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Memoize carousel settings to prevent recreating on each render
  const carouselSettings = useMemo(() => ({
    showThumbs: false,
    autoPlay: true,
    infiniteLoop: true,
    interval: 3000, // Slightly slower for better UX
    showArrows: false,
    showStatus: false,
    showIndicators: false,
    ariaLabel: "Product showcase carousel",
    labels: { leftArrow: "", rightArrow: "", item: "slide item" },
    preventMovementUntilSwipeScrollTolerance: true,
    swipeScrollTolerance: 50,
  }), []);

  useEffect(() => {
    // Check for desktop with better performance
    const checkDesktop = () => {
      setDesktop(isDesktop);
      setIsLoaded(true);
    };

    // Use requestAnimationFrame for better performance
    const timeoutId = setTimeout(checkDesktop, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Don't render on mobile to improve performance
  if (!desktop || !isLoaded) {
    return null;
  }

  return (
    <div className="hero-carousel relative">
      <Suspense fallback={
        <div className="hero-carousel flex items-center justify-center">
          <div className="loading-skeleton w-full h-full rounded-[30px]" />
        </div>
      }>
        <CarouselStyles />
        <Carousel {...carouselSettings}>
          {heroImages.map((image, index) => (
            <div 
              key={`${image.alt}-${index}`} 
              className="object-contain relative"
              style={{ height: '484px' }} // Explicit height to prevent CLS
            >
              <Image
                src={image.imgUrl}
                alt={image.alt}
                width={484}
                height={484}
                priority={image.priority}
                loading={image.priority ? 'eager' : 'lazy'}
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDg0IiBoZWlnaHQ9IjQ4NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciPjxzdG9wIHN0b3AtY29sb3I9IiNmMGYwZjAiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNlMGUwZTAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iNDg0IiBoZWlnaHQ9IjQ4NCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=="
                sizes="(max-width: 1024px) 0px, 484px"
                className="object-contain"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                }}
                onLoad={() => {
                  // Preload next image for smoother transitions
                  if (index < heroImages.length - 1 && !heroImages[index + 1].priority) {
                    const nextImage = new window.Image();
                    nextImage.src = heroImages[index + 1].imgUrl;
                  }
                }}
              />
            </div>
          ))}
        </Carousel>
      </Suspense>

      {/* Decorative arrow - lazy loaded */}
      <Image
        src="/assets/icons/hand-drawn-arrow.svg"
        alt="decorative arrow"
        width={175}
        height={175}
        className="absolute -left-[15%] bottom-0 z-0 w-auto h-auto hidden xl:block"
        loading="lazy"
        priority={false}
      />
    </div>
  );
};

export default HeroCarousel;