import Image from "next/image";
import { ReactNode } from "react";

interface Props {
  title: string;
  iconSrc: string;
  value: ReactNode;
  currency: string;
  outOfStock: Boolean;
  date?: Date;
  differentPrices?: Boolean;
}

const PriceInfoCard = ({ title, iconSrc, value, currency, outOfStock, date, differentPrices }: Props) => {
  const formatDate = (date: Date) => {
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };


  return (
    <div className='price-info_card justify-center items-center'>
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
          className="w-auto h-auto"
        />
        {(outOfStock && title === "Current Price") ? (
          <p className="text-lg text-primary font-semibold">
            Stoc Epuizat
          </p>
        ) : (
          <p className="text-2xl [word-spacing:-0.125rem] font-bold text-secondary dark:text-white-200">
            {value} {currency}
          </p>
        )}
      </div>
      {differentPrices && (
        <p >{date ? `${formatDate(date)}` : ''}</p>
      )}
    </div>
  )
}

export default PriceInfoCard