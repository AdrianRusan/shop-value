import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Creează cont nou
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Începe să economisești cu monitorizarea prețurilor
          </p>
        </div>
        
        <div className="mt-8">
          <SignUp
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-2xl border-0",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "border-gray-200 hover:bg-gray-50",
                formButtonPrimary: "bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-lg",
                formFieldInput: "rounded-lg border-gray-300 focus:border-primary focus:ring-primary",
                footerActionLink: "text-primary hover:text-primary/80",
              },
              variables: {
                colorPrimary: "#FF6B35",
                colorText: "#1F2937",
                colorBackground: "#FFFFFF",
                colorInputBackground: "#F9FAFB",
                colorInputText: "#1F2937",
                borderRadius: "0.5rem",
              },
            }}
            redirectUrl="/dashboard"
            signInUrl="/sign-in"
          />
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ai deja cont?{' '}
            <a 
              href="/sign-in" 
              className="font-medium text-primary hover:text-primary/80"
            >
              Conectează-te aici
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}