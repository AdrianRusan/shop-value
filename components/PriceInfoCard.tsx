import Image from "next/image";
import { ReactNode } from "react";

interface Props {
  title: string;
  iconSrc: string;
  value: ReactNode;
  currency: string;
}

const PriceInfoCard = ({ title, iconSrc, value, currency }: Props) => {
  return (
    <div className='price-info_card'>
      <p className="text-base text-black-100 dark:text-white-100">
        {title}
      </p>
      <div className="flex gap-1">
        <Image 
          src={iconSrc}
          alt={title}
          width={24}
          height={24}
          priority
        />
        <p className="text-2xl [word-spacing:-0.125rem] font-bold text-secondary dark:text-white-200">
          {value} {currency}
        </p>
      </div>
    </div>
  )
}

export default PriceInfoCard