'use client'

import { useState, useEffect } from 'react';
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { Carousel } from 'react-responsive-carousel';
import Image from "next/image";

const heroImages = [
  {
    imgUrl: 'assets/images/hero-1.svg',
    alt: 'smart watch'
  },
  {
    imgUrl: 'assets/images/hero-2.svg',
    alt: 'bag'
  },
  {
    imgUrl: 'assets/images/hero-3.svg',
    alt: 'lamp'
  },
  {
    imgUrl: 'assets/images/hero-4.svg',
    alt: 'air fryer'
  },
  {
    imgUrl: 'assets/images/hero-5.svg',
    alt: 'chair'
  }
]

const HeroCarousel = () => {

  return (
    <>
      <div className="hero-carousel hidden lg:block">
        <Carousel
          showThumbs={false}
          autoPlay
          infiniteLoop
          interval={2000}
          showArrows={false}
          showStatus={false}
          showIndicators={false}
          ariaLabel="carousel"
          labels={{ leftArrow: "", rightArrow: "", item:  "slide item" }}
          className="hidden lg:block"
        >
          {heroImages.map((image, index) => (
            <div key={image.alt} className="object-contain hidden lg:block">
              <Image
                src={image.imgUrl}
                alt={image.alt}
                width={484}
                height={484}
                priority={index === 0}
              />
            </div>
          ))}
        </Carousel>

        <Image 
          src="assets/icons/hand-drawn-arrow.svg"
          alt="arrow"
          width={175}
          height={175}
          className="absolute -left-[15%] bottom-0 z-0 w-auto h-auto hidden xl:block"
        />
      </div>
    </>
  )
}

export default HeroCarousel