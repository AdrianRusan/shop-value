import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

export default clerkMiddleware((auth, request) => {
  // Protect routes that require authentication
  if (isProtectedRoute(request) && !auth().userId) {
    return auth().redirectToSignIn();
  }
  
  // Redirect authenticated users away from public auth pages
  if (auth().userId && (request.nextUrl.pathname === '/sign-in' || request.nextUrl.pathname === '/sign-up')) {
    return Response.redirect(new URL('/dashboard', request.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};