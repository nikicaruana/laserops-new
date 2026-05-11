// Extend the Window interface to include the GTM dataLayer array.
// This avoids TypeScript errors when pushing events from client components.
interface Window {
  dataLayer?: Record<string, unknown>[];
}
