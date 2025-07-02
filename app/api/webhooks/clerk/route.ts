import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { 
  syncClerkUserToMongoDB, 
  updateClerkUserInMongoDB, 
  deleteClerkUserFromMongoDB,
  updateUserLoginTracking,
  type ClerkUserData 
} from '@/lib/clerk-sync';
import { emailService } from '@/lib/resend';
import * as Sentry from '@sentry/nextjs';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(request: Request) {
  try {
    if (!webhookSecret) {
      console.error('Missing CLERK_WEBHOOK_SECRET environment variable');
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const headerPayload = headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('Missing required Svix headers');
      return Response.json({ error: 'Missing required headers' }, { status: 400 });
    }

    const body = await request.text();
    const wh = new Webhook(webhookSecret);
    
    let evt: any;
    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('Error verifying webhook signature:', err);
      Sentry.captureException(err);
      return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const { type, data } = evt;
    console.log(`Received Clerk webhook: ${type}`);

    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      
      case 'session.created':
        await handleSessionCreated(data);
        break;
      
      case 'session.ended':
        // Track session end if needed
        console.log(`Session ended for user: ${data.user_id}`);
        break;
      
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return Response.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      type: type 
    });

  } catch (error) {
    console.error('Error processing Clerk webhook:', error);
    Sentry.captureException(error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

async function handleUserCreated(userData: any) {
  try {
    const clerkUserData: ClerkUserData = {
      id: userData.id,
      email_addresses: userData.email_addresses,
      first_name: userData.first_name,
      last_name: userData.last_name,
      image_url: userData.image_url,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
    };

    const user = await syncClerkUserToMongoDB(clerkUserData);
    console.log(`User created in MongoDB: ${user.email}`);

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail({
        firstName: user.firstName || '',
        email: user.email,
        dashboardUrl: `${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/dashboard`,
      }, { userId: user.clerkId });
      
      console.log(`Welcome email sent to: ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      Sentry.captureException(emailError, {
        tags: { userId: user.clerkId, email: user.email },
      });
      // Don't fail the webhook for email errors
    }

    // TODO: Track user creation event in analytics
    
  } catch (error) {
    console.error('Error handling user created webhook:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function handleUserUpdated(userData: any) {
  try {
    const clerkUserData: ClerkUserData = {
      id: userData.id,
      email_addresses: userData.email_addresses,
      first_name: userData.first_name,
      last_name: userData.last_name,
      image_url: userData.image_url,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
    };

    const user = await updateClerkUserInMongoDB(clerkUserData);
    console.log(`User updated in MongoDB: ${user.email}`);
    
    // TODO: Handle email change notifications if needed
    
  } catch (error) {
    console.error('Error handling user updated webhook:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function handleUserDeleted(userData: any) {
  try {
    await deleteClerkUserFromMongoDB(userData.id);
    console.log(`User soft deleted in MongoDB: ${userData.id}`);
    
    // TODO: Handle user deletion cleanup (cancel subscriptions, etc.)
    // TODO: Send account deletion confirmation email
    
  } catch (error) {
    console.error('Error handling user deleted webhook:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function handleSessionCreated(sessionData: any) {
  try {
    if (sessionData.user_id) {
      await updateUserLoginTracking(sessionData.user_id);
      console.log(`Updated login tracking for user: ${sessionData.user_id}`);
    }
    
    // TODO: Track session creation analytics
    
  } catch (error) {
    console.error('Error handling session created webhook:', error);
    Sentry.captureException(error);
    // Don't throw here as this is not critical
  }
}