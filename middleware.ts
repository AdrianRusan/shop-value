import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { securityHeaders } from "@/lib/security-headers";

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/profile(.*)',
  '/settings(.*)',
  '/billing(.*)',
  '/admin(.*)',
  '/api/products/user(.*)',
  '/api/checkout(.*)',
  '/api/customer-portal(.*)',
  '/api/alerts(.*)',
  '/api/gdpr(.*)',
  '/api/notifications(.*)',
]);

// Helper function to apply security headers to any response
function applySecurityHeaders(response: Response): Response {
  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

export default clerkMiddleware((auth, request) => {
  const url = request.nextUrl;
  
  // Skip middleware for static files and Next.js internals
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/_next/') ||
    url.pathname.includes('.') // Skip files with extensions
  ) {
    return NextResponse.next();
  }

  let response: Response;
  
  try {
    // Handle protected routes that require authentication
    if (isProtectedRoute(request)) {
      const authState = auth();
      if (!authState.userId) {
        response = authState.redirectToSignIn();
      } else {
        response = NextResponse.next();
      }
    }
    // Handle authenticated users trying to access auth pages
    else if (url.pathname === '/sign-in' || url.pathname === '/sign-up') {
      const authState = auth();
      if (authState.userId) {
        response = Response.redirect(new URL('/dashboard', request.url));
      } else {
        response = NextResponse.next();
      }
    }
    // Handle all other routes
    else {
      response = NextResponse.next();
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    // Fallback to allowing the request through
    response = NextResponse.next();
  }
  
  // Apply security headers to all responses
  response = applySecurityHeaders(response);
  
  // Additional security measures for API routes
  if (url.pathname.startsWith('/api/')) {
    // Add API-specific security headers
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    
    // Rate limiting headers (will be set by individual API routes)
    if (!response.headers.has('X-RateLimit-Limit')) {
      response.headers.set('X-RateLimit-Limit', '60');
    }
  }
  
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};