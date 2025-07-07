import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrCreateUserByClerkId } from '@/lib/clerk-sync';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { SavingsCalculator } from '@/components/dashboard/SavingsCalculator';

export default async function DashboardPage() {
  // Check authentication
  const { userId } = auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  // Get Clerk user data
  const clerkUser = await currentUser();
  
  if (!clerkUser) {
    redirect('/sign-in');
  }

  let mongoUser;
  try {
    // Get or create MongoDB user
    mongoUser = await getOrCreateUserByClerkId(userId);
  } catch (error) {
    console.error('Error fetching user data:', error);
    mongoUser = null;
  }

  return (
    // <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
    //   <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    //     {/* Header */}
    //     <div className="mb-8">
    //       <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
    //         Bună ziua, {clerkUser.firstName || 'Utilizator'}! 👋
    //       </h1>
    //       <p className="mt-2 text-gray-600 dark:text-gray-400">
    //         Gestionează produsele urmărite și vezi istoricul prețurilor
    //       </p>
    //     </div>

    //     {/* User Info Cards */}
    //     <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
    //       {/* Clerk User Info */}
    //       <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow">
    //         <div className="p-6">
    //           <h3 className="text-lg font-medium text-gray-900 dark:text-white">
    //             Informații Cont
    //           </h3>
    //           <div className="mt-4 space-y-2">
    //             <p className="text-sm text-gray-600 dark:text-gray-400">
    //               <span className="font-medium">Email:</span> {clerkUser.emailAddresses[0]?.emailAddress}
    //             </p>
    //             <p className="text-sm text-gray-600 dark:text-gray-400">
    //               <span className="font-medium">Nume:</span> {clerkUser.firstName} {clerkUser.lastName}
    //             </p>
    //             <p className="text-sm text-gray-600 dark:text-gray-400">
    //               <span className="font-medium">Verificat:</span> {
    //                 clerkUser.emailAddresses[0]?.verification?.status === 'verified' 
    //                   ? '✅ Da' 
    //                   : '❌ Nu'
    //               }
    //             </p>
    //           </div>
    //         </div>
    //       </div>

    //       {/* Subscription Info */}
    //       <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow">
    //         <div className="p-6">
    //           <h3 className="text-lg font-medium text-gray-900 dark:text-white">
    //             Abonament
    //           </h3>
    //           <div className="mt-4 space-y-2">
    //             <p className="text-sm text-gray-600 dark:text-gray-400">
    //               <span className="font-medium">Plan:</span> {
    //                 mongoUser?.subscription?.plan ? 
    //                 mongoUser.subscription.plan.toUpperCase() : 
    //                 'FREE'
    //               }
    //             </p>
    //             <p className="text-sm text-gray-600 dark:text-gray-400">
    //               <span className="font-medium">Status:</span> {
    //                 mongoUser?.subscription?.status ? 
    //                 mongoUser.subscription.status.toUpperCase() : 
    //                 'ACTIVE'
    //               }
    //             </p>
    //           </div>
    //         </div>
    //       </div>

    //       {/* Usage Stats */}
    //       <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow">
    //         <div className="p-6">
    //           <h3 className="text-lg font-medium text-gray-900 dark:text-white">
    //             Utilizare
    //           </h3>
    //           <div className="mt-4 space-y-2">
    //             <p className="text-sm text-gray-600 dark:text-gray-400">
    //               <span className="font-medium">Produse urmărite:</span> {
    //                 mongoUser?.usage?.productsTracked || 0
    //               } / {
    //                 mongoUser?.usage?.maxProducts || 5
    //               }
    //             </p>
    //             <p className="text-sm text-gray-600 dark:text-gray-400">
    //               <span className="font-medium">Email-uri trimise:</span> {
    //                 mongoUser?.usage?.emailsSent || 0
    //               } / {
    //                 mongoUser?.usage?.maxEmails || 10
    //               }
    //             </p>
    //           </div>
    //         </div>
    //       </div>
    //     </div>

    //     {/* Savings Calculator Section */}
    //     <div className="mb-8">
    //       <SavingsCalculator />
    //     </div>

    //     {/* Main Dashboard Content - Tracked Products */}
    //     <div className="mb-8">
    //       <div className="flex items-center justify-between mb-6">
    //         <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
    //           Produsele Tale Urmărite
    //         </h2>
    //         <a
    //           href="/produse"
    //           className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
    //         >
    //           <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    //           </svg>
    //           Adaugă Produs Nou
    //         </a>
    //       </div>
          
    //       {/* Enhanced Tracked Products Grid */}
    //       <TrackedProductsGrid />
    //     </div>

    //     {/* Quick Actions */}
    //     <div className="mt-12">
    //       <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
    //         Acțiuni Rapide
    //       </h2>
    //       <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    //         <a
    //           href="/produse"
    //           className="block rounded-lg bg-primary px-4 py-3 text-center text-white shadow hover:bg-primary/90 transition-colors"
    //         >
    //           Explorează Produse
    //         </a>
    //         <a
    //           href="/dashboard?view=analytics"
    //           className="block rounded-lg bg-blue-600 px-4 py-3 text-center text-white shadow hover:bg-blue-700 transition-colors"
    //         >
    //           Analize Prețuri
    //         </a>
    //         <a
    //           href="/customer-portal"
    //           className="block rounded-lg bg-green-600 px-4 py-3 text-center text-white shadow hover:bg-green-700 transition-colors"
    //         >
    //           Gestionează Abonament
    //         </a>
    //         <a
    //           href="/dashboard?view=settings"
    //           className="block rounded-lg bg-gray-600 px-4 py-3 text-center text-white shadow hover:bg-gray-700 transition-colors"
    //         >
    //           Setări Alerte
    //         </a>
    //       </div>
    //     </div>

    //     {/* Debug Info (Development Only) */}
    //     {process.env.NODE_ENV === 'development' && (
    //       <div className="mt-8">
    //         <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
    //           Debug Info (Development)
    //         </h2>
    //         <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-4">
    //           <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
    //             {JSON.stringify({
    //               clerkUserId: userId,
    //               mongoUserExists: !!mongoUser,
    //               mongoUserId: mongoUser?._id,
    //               lastLogin: mongoUser?.lastLoginAt,
    //               loginCount: mongoUser?.loginCount
    //             }, null, 2)}
    //           </pre>
    //         </div>
    //       </div>
    //     )}
    //   </div>
    // </div>
    <DashboardContent 
      clerkUser={clerkUser} 
      mongoUser={mongoUser}
    />
  );
}