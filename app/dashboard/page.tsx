import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrCreateUserByClerkId } from '@/lib/clerk-sync';
import { DashboardLayoutCustomizer } from '@/components/dashboard/DashboardLayoutCustomizer';

// Force this page to be dynamic due to auth() and headers usage
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  try {
    // Check authentication with proper error handling
    const authResult = await auth();
    const { userId } = authResult;
    
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
      firstName: clerkUser.firstName || null,
      lastName: clerkUser.lastName || null,
      emailAddresses: clerkUser.emailAddresses?.map(email => ({
        emailAddress: email.emailAddress,
        verification: {
          status: email.verification?.status || 'unverified'
        }
      })) || []
    };

    return (
      <DashboardLayoutCustomizer 
        clerkUser={serializedClerkUser} 
        mongoUser={serializedUser}
      />
    );
  } catch (error) {
    console.error('Error in DashboardPage:', error);
    return (
      <div>Error loading dashboard. Please try again later.</div>
    );
  }
}