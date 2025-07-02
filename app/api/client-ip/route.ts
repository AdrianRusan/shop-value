import { NextRequest, NextResponse } from 'next/server';

interface ClientIPResponse {
  success: boolean;
  ip: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ClientIPResponse>> {
  try {
    // Get client IP from various possible headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    
    let clientIP = 'unknown';
    
    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one
      clientIP = forwarded.split(',')[0].trim();
    } else if (realIP) {
      clientIP = realIP;
    } else if (cfConnectingIP) {
      clientIP = cfConnectingIP;
    }

    return NextResponse.json({
      success: true,
      ip: clientIP
    });

  } catch (error) {
    console.error('Error getting client IP:', error);
    
    return NextResponse.json({
      success: true,
      ip: 'unknown'
    });
  }
}