import User from '@/lib/models/user.model';
import { connectToDB } from '@/lib/mongoose';
import { clerkClient } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';

export interface ClerkUserData {
  id: string;
  email_addresses: Array<{
    email_address: string;
    verification?: {
      status: string;
    };
  }>;
  first_name: string | null;
  last_name: string | null;
  image_url?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Create or update a user in MongoDB based on Clerk user data
 */
export async function syncClerkUserToMongoDB(clerkUser: ClerkUserData): Promise<any> {
  try {
    await connectToDB();

    const primaryEmail = clerkUser.email_addresses[0];
    if (!primaryEmail) {
      throw new Error('No email address found for Clerk user');
    }

    const isEmailVerified = primaryEmail.verification?.status === 'verified';

    // Check if user already exists
    let user = await User.findOne({ clerkId: clerkUser.id });

    if (user) {
      // Update existing user
      user.email = primaryEmail.email_address;
      user.emailVerified = isEmailVerified;
      user.firstName = clerkUser.first_name || '';
      user.lastName = clerkUser.last_name || '';
      user.avatar = clerkUser.image_url;
      user.lastLoginAt = new Date();
      user.loginCount += 1;

      await user.save();
      return user;
    } else {
      // Create new user with default values
      user = new User({
        clerkId: clerkUser.id,
        email: primaryEmail.email_address,
        emailVerified: isEmailVerified,
        firstName: clerkUser.first_name || '',
        lastName: clerkUser.last_name || '',
        avatar: clerkUser.image_url,
        role: 'user',
        status: 'active',
        subscription: {
          plan: 'free',
          status: 'active',
          cancelAtPeriodEnd: false,
        },
        usage: {
          productsTracked: 0,
          maxProducts: 5,
          apiCalls: 0,
          maxApiCalls: 0,
          emailsSent: 0,
          maxEmails: 10,
          resetDate: new Date(),
        },
        preferences: {
          notifications: {
            email: true,
            priceAlerts: false,
            weeklyReport: false,
            marketingEmails: false,
          },
          currency: 'RON',
          language: 'ro',
          timezone: 'Europe/Bucharest',
          dashboard: {
            defaultView: 'grid',
            itemsPerPage: 12,
          },
        },
        consent: {
          functional: {
            granted: true,
            timestamp: new Date(),
          },
          analytics: {
            granted: false,
          },
          marketing: {
            granted: false,
          },
          lastUpdated: new Date(),
        },
        lastLoginAt: new Date(),
        loginCount: 1,
      });

      await user.save();
      
      // Log successful user creation
      console.log(`New user created for Clerk ID: ${clerkUser.id}`);
      
      return user;
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error syncing Clerk user to MongoDB:', error);
    throw error;
  }
}

/**
 * Update user in MongoDB when Clerk user is updated
 */
export async function updateClerkUserInMongoDB(clerkUser: ClerkUserData): Promise<any> {
  try {
    await connectToDB();

    const primaryEmail = clerkUser.email_addresses[0];
    if (!primaryEmail) {
      throw new Error('No email address found for Clerk user');
    }

    const isEmailVerified = primaryEmail.verification?.status === 'verified';

    const user = await User.findOne({ clerkId: clerkUser.id });
    
    if (!user) {
      // If user doesn't exist, create it
      return await syncClerkUserToMongoDB(clerkUser);
    }

    // Update user fields
    user.email = primaryEmail.email_address;
    user.emailVerified = isEmailVerified;
    user.firstName = clerkUser.first_name || '';
    user.lastName = clerkUser.last_name || '';
    user.avatar = clerkUser.image_url;

    await user.save();
    
    console.log(`User updated for Clerk ID: ${clerkUser.id}`);
    
    return user;
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating Clerk user in MongoDB:', error);
    throw error;
  }
}

/**
 * Delete user from MongoDB when Clerk user is deleted
 */
export async function deleteClerkUserFromMongoDB(clerkUserId: string): Promise<void> {
  try {
    await connectToDB();

    const user = await User.findOne({ clerkId: clerkUserId });
    
    if (user) {
      // Soft delete - set deletedAt timestamp and status
      user.deletedAt = new Date();
      user.status = 'deleted';
      await user.save();
      
      console.log(`User soft deleted for Clerk ID: ${clerkUserId}`);
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting Clerk user from MongoDB:', error);
    throw error;
  }
}

/**
 * Get or create user by Clerk ID
 */
export async function getOrCreateUserByClerkId(clerkUserId: string): Promise<any> {
  try {
    await connectToDB();

    // First try to find existing user
    let user = await User.findOne({ 
      clerkId: clerkUserId, 
      status: { $ne: 'deleted' },
      deletedAt: { $exists: false }
    });

    if (user) {
      return user;
    }

    // If user doesn't exist, fetch from Clerk and create
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    
    const clerkUserData: ClerkUserData = {
      id: clerkUser.id,
      email_addresses: clerkUser.emailAddresses.map(email => ({
        email_address: email.emailAddress,
        verification: {
          status: email.verification?.status || 'unverified'
        }
      })),
      first_name: clerkUser.firstName,
      last_name: clerkUser.lastName,
      image_url: clerkUser.imageUrl,
      created_at: clerkUser.createdAt,
      updated_at: clerkUser.updatedAt,
    };

    return await syncClerkUserToMongoDB(clerkUserData);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error getting or creating user by Clerk ID:', error);
    throw error;
  }
}

/**
 * Update user login tracking
 */
export async function updateUserLoginTracking(clerkUserId: string): Promise<void> {
  try {
    await connectToDB();

    await User.findOneAndUpdate(
      { clerkId: clerkUserId },
      { 
        lastLoginAt: new Date(),
        $inc: { loginCount: 1 }
      }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating user login tracking:', error);
  }
}