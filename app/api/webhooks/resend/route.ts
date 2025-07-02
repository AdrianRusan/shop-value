import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { redis } from '@/lib/upstash';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('resend-signature');
    
    // TODO: Implement signature verification when Resend adds webhook signatures
    // For now, we'll process the webhook data
    
    const event = JSON.parse(body);
    console.log('Resend webhook received:', event);

    // Handle different webhook events
    switch (event.type) {
      case 'email.delivered':
        await handleEmailDelivered(event.data);
        break;
        
      case 'email.bounced':
        await handleEmailBounced(event.data);
        break;
        
      case 'email.complained':
        await handleEmailComplained(event.data);
        break;
        
      case 'email.clicked':
        await handleEmailClicked(event.data);
        break;
        
      case 'email.opened':
        await handleEmailOpened(event.data);
        break;
        
      default:
        console.log(`Unhandled Resend webhook type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('Error processing Resend webhook:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleEmailDelivered(data: any) {
  try {
    console.log(`Email delivered: ${data.email_id}`);
    
    // Track delivery metrics
    await redis.incr('emails:delivered:total');
    await redis.incr(`emails:delivered:${new Date().toISOString().split('T')[0]}`);
    
    // Store delivery status
    await redis.hset(`email:${data.email_id}`, {
      status: 'delivered',
      deliveredAt: new Date().toISOString(),
      recipient: data.to,
    });
    
  } catch (error) {
    console.error('Error handling email delivered:', error);
    Sentry.captureException(error);
  }
}

async function handleEmailBounced(data: any) {
  try {
    console.log(`Email bounced: ${data.email_id}, reason: ${data.bounce?.type}`);
    
    // Track bounce metrics
    await redis.incr('emails:bounced:total');
    await redis.incr(`emails:bounced:${new Date().toISOString().split('T')[0]}`);
    
    // Store bounce information
    await redis.hset(`email:${data.email_id}`, {
      status: 'bounced',
      bouncedAt: new Date().toISOString(),
      bounceType: data.bounce?.type || 'unknown',
      bounceReason: data.bounce?.reason || 'Unknown bounce reason',
      recipient: data.to,
    });
    
    // TODO: Handle hard bounces by marking email as invalid
    if (data.bounce?.type === 'permanent') {
      console.log(`Permanent bounce for ${data.to}, should mark as invalid`);
      // Could implement user email validation status update here
    }
    
  } catch (error) {
    console.error('Error handling email bounced:', error);
    Sentry.captureException(error);
  }
}

async function handleEmailComplained(data: any) {
  try {
    console.log(`Email complaint: ${data.email_id}`);
    
    // Track complaint metrics
    await redis.incr('emails:complained:total');
    await redis.incr(`emails:complained:${new Date().toISOString().split('T')[0]}`);
    
    // Store complaint information
    await redis.hset(`email:${data.email_id}`, {
      status: 'complained',
      complainedAt: new Date().toISOString(),
      recipient: data.to,
    });
    
    // TODO: Auto-unsubscribe user from marketing emails
    console.log(`Spam complaint from ${data.to}, should handle unsubscribe`);
    
  } catch (error) {
    console.error('Error handling email complained:', error);
    Sentry.captureException(error);
  }
}

async function handleEmailClicked(data: any) {
  try {
    console.log(`Email clicked: ${data.email_id}, link: ${data.link?.url}`);
    
    // Track click metrics
    await redis.incr('emails:clicked:total');
    await redis.incr(`emails:clicked:${new Date().toISOString().split('T')[0]}`);
    
    // Store click information
    await redis.hset(`email:${data.email_id}:clicks`, {
      clickedAt: new Date().toISOString(),
      linkUrl: data.link?.url || 'unknown',
      recipient: data.to,
    });
    
  } catch (error) {
    console.error('Error handling email clicked:', error);
    Sentry.captureException(error);
  }
}

async function handleEmailOpened(data: any) {
  try {
    console.log(`Email opened: ${data.email_id}`);
    
    // Track open metrics
    await redis.incr('emails:opened:total');
    await redis.incr(`emails:opened:${new Date().toISOString().split('T')[0]}`);
    
    // Store open information
    await redis.hset(`email:${data.email_id}`, {
      openedAt: new Date().toISOString(),
      recipient: data.to,
    });
    
  } catch (error) {
    console.error('Error handling email opened:', error);
    Sentry.captureException(error);
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy',
    service: 'resend-webhook-handler',
    timestamp: new Date().toISOString()
  });
}