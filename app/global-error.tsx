'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-600 mb-6">
                We're sorry for the inconvenience. Our team has been notified about this issue.
              </p>
              <div className="space-y-3">
                <button
                  onClick={reset}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Try again
                </button>
                <a
                  href="/"
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors text-center"
                >
                  Go to homepage
                </a>
              </div>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500">
                    Error details (development only)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {error.message}
                    {error.stack && (
                      <>
                        {'\n\n'}
                        {error.stack}
                      </>
                    )}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}