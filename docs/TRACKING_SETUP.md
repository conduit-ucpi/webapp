# Tracking Setup for /plugins Landing Page

## Overview
Comprehensive tracking has been implemented for the `/plugins` advertising landing page to measure Reddit Ads performance and user engagement.

## What's Being Tracked

### 1. **Conversions** (Primary Goal)
- **WordPress Plugin Click**: Tracks when users click "Get WordPress Plugin"
- **Shopify Integration Click**: Tracks when users click "Install Shopify Integration"
- These are tracked as "SignUp" events in Reddit Pixel

### 2. **Page Engagement**
- **Page Views**: Automatically tracked when the page loads
- **Scroll Depth**: Tracked at 25%, 50%, 75%, and 100% milestones
- **Time on Page**: Tracked at 30s, 60s, 120s, and 300s (5min) milestones

### 3. **Video Engagement**
- **WordPress Demo Video**: Tracks play, pause, ended, and progress (25%, 50%, 75%)
- **Shopify Demo Video**: Tracks play, pause, ended, and progress (25%, 50%, 75%)

## Setup Instructions

### Step 1: Get Your Reddit Pixel ID

1. Go to **Reddit Ads Manager**: https://ads.reddit.com
2. Click on **"Pixels"** in the left sidebar
3. Click **"Create Pixel"**
4. Name it (e.g., "Plugins Landing Page")
5. Copy the **Pixel ID** (format: `t2_abc123xyz`)

### Step 2: Add to Environment Variables

Add to your `.env.local` file:
```bash
NEXT_PUBLIC_REDDIT_PIXEL_ID=t2_your_actual_pixel_id_here
```

### Step 3: Add to GitHub Actions (for deployment)

Since deployment uses GitHub Actions, you need to add the environment variable there too:

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **"New repository variable"**
4. Name: `NEXT_PUBLIC_REDDIT_PIXEL_ID`
5. Value: Your actual Reddit Pixel ID
6. Click **"Add variable"**

### Step 4: Update GitHub Actions Workflow

Edit `.github/workflows/deploy.yml` (or whatever your workflow file is named) to pass the variable to the build:

```yaml
env:
  NEXT_PUBLIC_REDDIT_PIXEL_ID: ${{ vars.NEXT_PUBLIC_REDDIT_PIXEL_ID }}
```

## How It Works

### Reddit Pixel Integration
- The Reddit Pixel script loads automatically when the page mounts
- All tracking events are sent to Reddit's conversion tracking system
- You can view performance in Reddit Ads Manager under "Conversions"

### Event Tracking
All events are sent to Reddit Pixel with detailed metadata:

**Conversion Events:**
```javascript
{
  itemCount: 1,
  conversionType: 'wordpress_plugin' | 'shopify_integration',
  buttonText: 'Get WordPress Plugin',
  targetUrl: 'https://wordpress.org/plugins/...'
}
```

**Video Engagement:**
```javascript
{
  customEventName: 'VideoEngagement',
  videoId: 'aYXG0hC7dFg',
  videoTitle: 'WordPress WooCommerce USDC Payment Plugin Demo',
  action: 'play' | 'pause' | 'ended' | '25%' | '50%' | '75%'
}
```

**Scroll Depth:**
```javascript
{
  customEventName: 'ScrollDepth',
  depth: 25 | 50 | 75 | 100
}
```

**Time on Page:**
```javascript
{
  customEventName: 'TimeOnPage',
  seconds: 30 | 60 | 120 | 300
}
```

## Viewing Your Data

### In Reddit Ads Manager:
1. Go to https://ads.reddit.com
2. Navigate to **"Pixels"**
3. Click on your pixel to see event data
4. View conversion data in your ad campaigns

### Setting Up Conversion Tracking in Ads:
1. When creating/editing a Reddit ad campaign
2. Under "Conversion Tracking", select your pixel
3. Choose "SignUp" as the conversion event
4. Reddit will now track conversions from your ads to button clicks

## Adding More Platforms (Future)

The tracking system is designed to be extensible. To add Google Analytics, Meta Pixel, or other platforms:

1. **Add pixel/tracking ID to environment variables**
2. **Update `lib/tracking.ts`** - uncomment and configure the relevant sections
3. **Each tracking function supports multiple platforms** - they fire in parallel

Example for Google Analytics (currently commented out in `lib/tracking.ts`):
```javascript
// Uncomment these sections in lib/tracking.ts
if (window.gtag) {
  window.gtag('event', 'conversion', {
    event_category: 'Plugin Install',
    event_label: event.conversionType,
  });
}
```

## Files Modified

- **`lib/tracking.ts`**: Core tracking utility (supports Reddit Pixel + extensible for others)
- **`hooks/usePageTracking.ts`**: React hooks for scroll, time, and video tracking
- **`pages/plugins.tsx`**: Landing page with tracking integration
- **`.env.example`**: Added `NEXT_PUBLIC_REDDIT_PIXEL_ID` variable

## Testing

To test tracking locally:

1. Add your Reddit Pixel ID to `.env.local`
2. Run `npm run dev`
3. Open browser DevTools → Network tab
4. Filter by "reddit"
5. Visit http://localhost:3000/plugins
6. You should see tracking requests to `redditstatic.com`
7. Click buttons, scroll, watch videos - verify events are firing

## Privacy & Compliance

- The Reddit Pixel respects user privacy settings
- Tracking can be disabled via `optOut: true` in the initialization
- Currently set to `optOut: false` for maximum tracking coverage
- Consider adding a cookie consent banner for GDPR/CCPA compliance if needed

## Performance Impact

- **Minimal**: Reddit Pixel script loads asynchronously (~10KB gzipped)
- **Non-blocking**: All tracking happens after page render
- **Efficient**: Events are batched and sent in the background
- **Passive listeners**: Scroll tracking uses passive event listeners

## Support

For questions about:
- **Reddit Pixel**: https://advertising.reddithelp.com/en/categories/measurement/reddit-pixel
- **This implementation**: Check the code comments in `lib/tracking.ts` and `hooks/usePageTracking.ts`
