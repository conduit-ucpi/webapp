/**
 * React hooks for automatic page engagement tracking
 */

import { useEffect, useRef } from 'react';
import {
  trackScrollDepth,
  trackTimeOnPage,
  trackVideoEngagement,
  type ScrollDepthEvent,
  type VideoEngagementEvent,
} from '@/lib/tracking';

/**
 * Hook to track scroll depth milestones (25%, 50%, 75%, 100%)
 */
export function useScrollTracking() {
  const trackedDepths = useRef<Set<number>>(new Set());

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollPercentage = ((scrollTop + windowHeight) / documentHeight) * 100;

      // Track milestones: 25%, 50%, 75%, 100%
      const milestones: ScrollDepthEvent['depth'][] = [25, 50, 75, 100];

      for (const milestone of milestones) {
        if (scrollPercentage >= milestone && !trackedDepths.current.has(milestone)) {
          trackedDepths.current.add(milestone);
          trackScrollDepth({ depth: milestone });
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
}

/**
 * Hook to track time spent on page (30s, 60s, 120s, 300s milestones)
 */
export function useTimeTracking() {
  const startTime = useRef<number>(Date.now());
  const trackedTimes = useRef<Set<number>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime.current) / 1000);

      // Track milestones: 30s, 60s, 120s, 300s
      const milestones = [30, 60, 120, 300];

      for (const milestone of milestones) {
        if (elapsedSeconds >= milestone && !trackedTimes.current.has(milestone)) {
          trackedTimes.current.add(milestone);
          trackTimeOnPage(milestone);
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);
}

/**
 * Hook to track YouTube video engagement
 * Returns ref to attach to YouTube iframe wrapper div
 */
export function useVideoTracking(videoId: string, videoTitle: string) {
  const videoRef = useRef<HTMLDivElement>(null);
  const trackedMilestones = useRef<Set<string>>(new Set());

  useEffect(() => {
    // YouTube IFrame API tracking
    if (typeof window === 'undefined') return;

    // Load YouTube IFrame API if not already loaded
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Wait for API to be ready
    const initPlayer = () => {
      if (!(window as any).YT || !(window as any).YT.Player) {
        setTimeout(initPlayer, 100);
        return;
      }

      const iframe = videoRef.current?.querySelector('iframe');
      if (!iframe) return;

      const player = new (window as any).YT.Player(iframe, {
        events: {
          onStateChange: (event: any) => {
            const track = (action: VideoEngagementEvent['action']) => {
              if (!trackedMilestones.current.has(action)) {
                trackedMilestones.current.add(action);
                trackVideoEngagement({ videoId, videoTitle, action });
              }
            };

            // Track play/pause/ended
            if (event.data === (window as any).YT.PlayerState.PLAYING) {
              track('play');
            } else if (event.data === (window as any).YT.PlayerState.PAUSED) {
              track('pause');
            } else if (event.data === (window as any).YT.PlayerState.ENDED) {
              track('ended');
            }

            // Track progress milestones
            if (event.data === (window as any).YT.PlayerState.PLAYING) {
              const checkProgress = setInterval(() => {
                if (player.getPlayerState() !== (window as any).YT.PlayerState.PLAYING) {
                  clearInterval(checkProgress);
                  return;
                }

                const currentTime = player.getCurrentTime();
                const duration = player.getDuration();
                const percentage = (currentTime / duration) * 100;

                if (percentage >= 25 && !trackedMilestones.current.has('25%')) {
                  trackedMilestones.current.add('25%');
                  trackVideoEngagement({ videoId, videoTitle, action: '25%' });
                }
                if (percentage >= 50 && !trackedMilestones.current.has('50%')) {
                  trackedMilestones.current.add('50%');
                  trackVideoEngagement({ videoId, videoTitle, action: '50%' });
                }
                if (percentage >= 75 && !trackedMilestones.current.has('75%')) {
                  trackedMilestones.current.add('75%');
                  trackVideoEngagement({ videoId, videoTitle, action: '75%' });
                }
              }, 1000);
            }
          },
        },
      });
    };

    // Small delay to ensure iframe is rendered
    setTimeout(initPlayer, 1000);
  }, [videoId, videoTitle]);

  return videoRef;
}
