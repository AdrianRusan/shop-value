import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';

interface Props {
  src: string;
  alt: string;
  product?: Product;
}

const ProductButtons = ({ src, alt, product }: Props) => {
  const facebookShareUrl = product
    ? `https://www.facebook.com/sharer/sharer.php?u=${product.url}&quote=${product.title}`
    : '#';

  return (
    <div className="p-2 bg-white-200 rounded-10">
      <Link target="_blank" href={facebookShareUrl}>
        <Image 
          src={src}
          alt={alt}
          width={20}
          height={20}
        /> 
      </Link>
    </div>
  );
}

export default ProductButtons;
