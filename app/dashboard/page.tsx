import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrCreateUserByClerkId } from '@/lib/clerk-sync';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { SavingsCalculator } from '@/components/dashboard/SavingsCalculator';

export default async function DashboardPage() {
  // Check authentication
  const { userId } = await auth();
  
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

  // Serialize user data to prevent serialization errors
  const serializedUser = mongoUser ? {
    _id: mongoUser._id?.toString(),
    email: mongoUser.email,
    firstName: mongoUser.firstName,
    lastName: mongoUser.lastName,
    subscription: mongoUser.subscription ? {
      plan: mongoUser.subscription.plan,
      status: mongoUser.subscription.status,
      stripeCustomerId: mongoUser.subscription.stripeCustomerId
    } : null,
    usage: mongoUser.usage ? {
      productsTracked: mongoUser.usage.productsTracked || 0,
      maxProducts: mongoUser.usage.maxProducts || 5,
      emailsSent: mongoUser.usage.emailsSent || 0,
      maxEmails: mongoUser.usage.maxEmails || 10
    } : null,
    role: mongoUser.role,
    lastLoginAt: mongoUser.lastLoginAt?.toISOString(),
    loginCount: mongoUser.loginCount || 0
  } : null;

  // Serialize clerk user data
  const serializedClerkUser = {
    id: clerkUser.id,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    emailAddresses: clerkUser.emailAddresses.map(email => ({
      emailAddress: email.emailAddress,
      verification: {
        status: email.verification?.status || 'unverified'
      }
    }))
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bună ziua, {serializedClerkUser.firstName || 'Utilizator'}! 👋
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Gestionează produsele urmărite și vezi istoricul prețurilor
          </p>
        </div>

        {/* User Info Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Clerk User Info */}
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Informații Cont
              </h3>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Email:</span> {serializedClerkUser.emailAddresses[0]?.emailAddress}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Nume:</span> {serializedClerkUser.firstName} {serializedClerkUser.lastName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Verificat:</span> {
                    serializedClerkUser.emailAddresses[0]?.verification?.status === 'verified' 
                      ? '✅ Da' 
                      : '❌ Nu'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Subscription Info */}
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Abonament
              </h3>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Plan:</span> {
                    serializedUser?.subscription?.plan ? 
                    serializedUser.subscription.plan.toUpperCase() : 
                    'FREE'
                  }
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Status:</span> {
                    serializedUser?.subscription?.status ? 
                    serializedUser.subscription.status.toUpperCase() : 
                    'ACTIVE'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Utilizare
              </h3>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Produse urmărite:</span> {
                    serializedUser?.usage?.productsTracked || 0
                  } / {
                    serializedUser?.usage?.maxProducts || 5
                  }
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Email-uri trimise:</span> {
                    serializedUser?.usage?.emailsSent || 0
                  } / {
                    serializedUser?.usage?.maxEmails || 10
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Savings Calculator Section */}
        <div className="mb-8">
          <SavingsCalculator />
        </div>

        {/* Main Dashboard Content - Tracked Products */}
        <DashboardContent clerkUser={serializedClerkUser} mongoUser={serializedUser} />

        {/* Quick Actions */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Acțiuni Rapide
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/produse"
              className="block rounded-lg bg-primary px-4 py-3 text-center text-white shadow hover:bg-primary/90 transition-colors"
            >
              Explorează Produse
            </a>
            <a
              href="/dashboard?view=analytics"
              className="block rounded-lg bg-blue-600 px-4 py-3 text-center text-white shadow hover:bg-blue-700 transition-colors"
            >
              Analize Prețuri
            </a>
            <a
              href="/customer-portal"
              className="block rounded-lg bg-green-600 px-4 py-3 text-center text-white shadow hover:bg-green-700 transition-colors"
            >
              Gestionează Abonament
            </a>
            <a
              href="/dashboard?view=settings"
              className="block rounded-lg bg-gray-600 px-4 py-3 text-center text-white shadow hover:bg-gray-700 transition-colors"
            >
              Setări Alerte
            </a>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
            💡 <strong>Nou:</strong> Poți exporta datele produselor urmărite în format CSV sau PDF direct din secțiunea "Produsele Tale Urmărite".
          </p>
        </div>

        {/* Debug Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Debug Info (Development)
            </h2>
            <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-4">
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                {JSON.stringify({
                  clerkUserId: userId,
                  mongoUserExists: !!serializedUser,
                  mongoUserId: serializedUser?._id,
                  lastLogin: serializedUser?.lastLoginAt,
                  loginCount: serializedUser?.loginCount
                }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}