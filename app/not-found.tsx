import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-167.5px)] md:min-h-[calc(100vh-72px)] px-6">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary dark:text-primary">404</h1>
        <h2 className="text-3xl font-semibold text-secondary dark:text-white-200 mt-4">
          Pagina nu a fost găsită
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-4 max-w-md mx-auto">
          Ne pare rău, dar pagina pe care o căutați nu există sau a fost mutată.
        </p>

        <div className="flex gap-4 justify-center mt-8">
          <Link
            href="/"
            className="btn bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            Înapoi la pagina principală
          </Link>
          <Link
            href="/produse"
            className="btn bg-secondary text-white hover:bg-secondary/90 transition-colors dark:bg-white-200 dark:text-black"
          >
            Vezi toate produsele
          </Link>
        </div>

        <div className="mt-12">
          <Image
            src="/assets/icons/search.svg"
            alt="Search illustration"
            width={100}
            height={100}
            className="mx-auto opacity-20"
          />
        </div>
      </div>
    </div>
  )
}
