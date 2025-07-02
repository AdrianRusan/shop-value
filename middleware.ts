import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { securityHeaders } from "@/lib/security-headers";

// Define route matchers for different types of routes
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/profile(.*)',
  '/settings(.*)',
  '/billing(.*)',
  '/products(.*)',
  '/api/user(.*)',
  '/api/products(.*)',
  '/api/checkout(.*)',
]);

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/health',
  '/api/cron(.*)',
  '/produse(.*)',
  '/pricing',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/sitemap.xml',
  '/robots.txt',
  '/favicon.ico',
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
  let response: Response;
  
  // Handle protected routes that require authentication
  if (isProtectedRoute(request) && !auth().userId) {
    response = auth().redirectToSignIn();
  }
  // Handle authenticated users on public auth pages
  else if (auth().userId && (request.nextUrl.pathname === '/sign-in' || request.nextUrl.pathname === '/sign-up')) {
    response = Response.redirect(new URL('/dashboard', request.url));
  }
  // Handle normal requests
  else {
    response = NextResponse.next();
  }
  
  // Apply security headers to all responses
  response = applySecurityHeaders(response);
  
  // Additional security measures for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
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