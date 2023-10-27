import { getProductById } from "@/lib/actions"
import { ImageResponse } from "next/server"

export const size = {
  width: 850,
  height: 1100,
}

export const contentType = 'image/png'

interface Props {
  params: {
    id: string
  }
}

export default async function og({ params }: Props) {
  const product = await getProductById(params.id);

  return new ImageResponse((
    <div tw="relative flex items-center justify-center">
      <img src={product?.image} alt={product?.title} />
      <div tw="absolute flex bg-black opacity-50 inset-0" />
      <div tw="absolute flex items-center top-5 w-full justify-center">
        <p tw="text-white text-4xl flex font-bold m-5">{product?.title}</p>
      </div>
    </div>
    ),
    size
  )
}