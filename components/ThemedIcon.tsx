'use client'

import React from 'react';
import Image from 'next/image';
import { useTheme } from '@/app/theme-provider';

type Props = {
  alt: string;
};

const ThemedIcon = ({ alt }: Props) => {
  const { theme } = useTheme();

  return (
      <Image
        src={`/assets/icons/${alt}-${theme}.svg`}
        alt={alt}
        width={28}
        height={28}
        className="object-contain"
        priority
      />
  );
};

export default ThemedIcon;
