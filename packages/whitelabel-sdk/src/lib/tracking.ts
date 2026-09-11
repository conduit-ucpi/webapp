/**
 * Tracking utility for advertising and analytics platforms
 * Currently supports: Reddit Pixel
 * Easy to extend for: Google Analytics, Meta Pixel, Google Ads, etc.
 */

// Type definitions for Reddit Pixel
declare global {
  interface Window {
    rdt?: (command: string, eventName: string, eventData?: Record<string, unknown>) => void;
  }
}

export interface ConversionEvent {
  conversionType: 'wordpress_plugin' | 'shopify_integration';
  buttonText: string;
  targetUrl: string;
}

export interface VideoEngagementEvent {
  videoId: string;
  videoTitle: string;
  action: 'play' | 'pause' | 'ended' | '25%' | '50%' | '75%';
}

export interface ScrollDepthEvent {
  depth: 25 | 50 | 75 | 100;
}

/**
 * Initialize Reddit Pixel tracking
 * @param pixelId - Your Reddit Pixel ID (get this from Reddit Ads Manager)
 */
export function initRedditPixel(pixelId: string): void {
  if (typeof window === 'undefined') return;

  // Check if already initialized
  if (window.rdt) return;

  // Create Reddit Pixel script
  const script = document.createElement('script');
  script.innerHTML = `
    !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
    rdt('init','${pixelId}', {"optOut":false,"useDecimalCurrencyValues":true});
    rdt('track', 'PageVisit');
  `;
  document.head.appendChild(script);
}

/**
 * Track conversion event (button click leading to plugin installation)
 */
export function trackConversion(event: ConversionEvent): void {
  if (typeof window === 'undefined') return;

  // Reddit Pixel conversion tracking
  if (window.rdt) {
    window.rdt('track', 'SignUp', {
      itemCount: 1,
      conversionType: event.conversionType,
      buttonText: event.buttonText,
      targetUrl: event.targetUrl,
    });
  }

  // Add Google Analytics tracking here when ready
  // if (window.gtag) {
  //   window.gtag('event', 'conversion', {
  //     event_category: 'Plugin Install',
  //     event_label: event.conversionType,
  //   });
  // }

  // Add Meta Pixel tracking here when ready
  // if (window.fbq) {
  //   window.fbq('track', 'Lead', {
  //     content_name: event.conversionType,
  //   });
  // }
}

/**
 * Track video engagement events
 */
export function trackVideoEngagement(event: VideoEngagementEvent): void {
  if (typeof window === 'undefined') return;

  // Reddit Pixel custom event
  if (window.rdt) {
    window.rdt('track', 'Custom', {
      customEventName: 'VideoEngagement',
      videoId: event.videoId,
      videoTitle: event.videoTitle,
      action: event.action,
    });
  }

  // Add Google Analytics tracking here when ready
  // if (window.gtag) {
  //   window.gtag('event', event.action, {
  //     event_category: 'Video',
  //     event_label: event.videoTitle,
  //   });
  // }
}

/**
 * Track scroll depth milestones
 */
export function trackScrollDepth(event: ScrollDepthEvent): void {
  if (typeof window === 'undefined') return;

  // Reddit Pixel custom event
  if (window.rdt) {
    window.rdt('track', 'Custom', {
      customEventName: 'ScrollDepth',
      depth: event.depth,
    });
  }

  // Add Google Analytics tracking here when ready
  // if (window.gtag) {
  //   window.gtag('event', 'scroll', {
  //     event_category: 'Engagement',
  //     event_label: `${event.depth}%`,
  //   });
  // }
}

/**
 * Track time on page
 * @param seconds - Total seconds spent on page
 */
export function trackTimeOnPage(seconds: number): void {
  if (typeof window === 'undefined') return;

  // Only track at significant milestones (30s, 60s, 120s, etc.)
  const milestones = [30, 60, 120, 300];
  if (!milestones.includes(seconds)) return;

  // Reddit Pixel custom event
  if (window.rdt) {
    window.rdt('track', 'Custom', {
      customEventName: 'TimeOnPage',
      seconds: seconds,
    });
  }

  // Add Google Analytics tracking here when ready
  // if (window.gtag) {
  //   window.gtag('event', 'timing_complete', {
  //     name: 'page_engagement',
  //     value: seconds * 1000, // GA expects milliseconds
  //   });
  // }
}

/**
 * Generic page view tracking (called automatically by initRedditPixel)
 */
export function trackPageView(pagePath: string): void {
  if (typeof window === 'undefined') return;

  // Reddit Pixel already tracks PageVisit on init
  // Add other platforms here when ready

  // Add Google Analytics tracking here when ready
  // if (window.gtag) {
  //   window.gtag('event', 'page_view', {
  //     page_path: pagePath,
  //   });
  // }
}
