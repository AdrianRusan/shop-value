import Image from "next/image";

interface Props {
  title: string;
  iconSrc: string;
  wholeValue: string;
  decimalValue: string;
  currency: string;
}

const PriceInfoCard = ({ title, iconSrc, wholeValue, decimalValue, currency }: Props) => {
  return (
    <div className='price-info_card'>
      <p className="text-base text-black-100">
        {title}
      </p>
      <div className="flex gap-1">
        <Image 
          src={iconSrc}
          alt={title}
          width={24}
          height={24}
        />
        <p className="text-2xl [word-spacing:-0.125rem] font-bold text-secondary">
          {wholeValue} <sup>{decimalValue}</sup> {currency}
        </p>
      </div>
    </div>
  )
}

export default PriceInfoCard