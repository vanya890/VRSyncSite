// Global references
let videoControlsComponent = null;
let userClickedStart = false;
let canPlayThroughHappened = false;

// Get video parameter from URL
const urlParams = new URLSearchParams(window.location.search);
const videoParam = urlParams.get('video');

// Function to restore video position from localStorage
const restoreVideoPosition = (video) => {
  if (videoParam) {
    const positionKey = 'videoPosition_' + videoParam;
    const savedPosition = localStorage.getItem(positionKey);
    if (savedPosition) {
      const position = parseFloat(savedPosition);
      if (!isNaN(position) && position > 0) {
        video.currentTime = position;
        console.log('Restored video position:', position);
        // Clear the saved position after restoring
        localStorage.removeItem(positionKey);
      }
    }
  }
};

// Add component to scene automatically
document.addEventListener('DOMContentLoaded', function() {
  const scene = document.querySelector('a-scene');
  const camera = document.querySelector('a-camera');
  const video = document.querySelector('#video');

  // Camera already configured in HTML for full rotation on mobile

  if (scene && video) {
    scene.setAttribute('video-controls', `video: #video`);

    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingProgress = document.getElementById('loading-progress');
    const bufferingOverlay = document.getElementById('buffering-overlay');
    const startOverlay = document.getElementById('start-overlay');

    // Hide overlays initially
    loadingOverlay.style.display = 'none';
    bufferingOverlay.style.display = 'none';

    // Flags
    let hasStartedLoading = false;
    let loadingTimeout = null;

    // Connection speed detection and adaptive loading
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const effectiveType = connection ? connection.effectiveType : null;
    let bufferSizeMultiplier = 1.2; // Default buffer size
    let criticalLoadTimeout = 15000; // Default critical load timeout

    // Adaptive settings based on connection speed
    if (effectiveType) {
      switch (effectiveType) {
        case '4g':
          bufferSizeMultiplier = 1.5;
          criticalLoadTimeout = 10000;
          break;
        case '3g':
          bufferSizeMultiplier = 1.0;
          criticalLoadTimeout = 20000;
          break;
        case '2g':
        case 'slow-2g':
          bufferSizeMultiplier = 0.8;
          criticalLoadTimeout = 30000;
          break;
        default:
          bufferSizeMultiplier = 1.2;
          criticalLoadTimeout = 15000;
      }
    }

    // Progressive loading strategy - load critical segments first
    const optimizeBuffering = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        // Ensure we have enough buffer ahead of current time
        const bufferAhead = bufferedEnd - video.currentTime;
        const optimalBuffer = Math.min(video.duration * 0.1, 30) * bufferSizeMultiplier; // 10% of video or 30s max

        if (bufferAhead < optimalBuffer) {
          // Increase buffer for better realtime experience
          video.preload = 'auto';
        } else {
          // Reduce buffer when we have enough for smooth playback
          video.preload = 'metadata';
        }
      }
    };

    // Function to properly load video on mobile
    const loadVideoMobile = () => {
      // Force video to load after user gesture
      video.load();

      // Ensure video is muted for mobile autoplay compatibility
      video.muted = true;

      return new Promise((resolve, reject) => {
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          resolve();
        };

        const onError = (e) => {
          video.removeEventListener('error', onError);
          reject(e);
        };

        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('error', onError);

        // Fallback timeout
        setTimeout(() => {
          resolve();
        }, 3000);
      });
    };

    // Start overlay click handler - begin loading and start video immediately
    const startHandler = async () => {
      if (!hasStartedLoading) {
        startOverlay.style.display = 'none';
        startOverlay.hasBeenShown = true;
        hasStartedLoading = true;

        // Show minimal loading indicator
        if (loadingOverlay) {
          loadingOverlay.style.display = 'flex';
          loadingProgress.textContent = 'Запуск...';
        }

        try {
          // Load video with mobile-friendly approach
          await loadVideoMobile();

          // Immediately try to start video playback
          const videosphere = document.querySelector('a-videosphere');
          if (videosphere) {
            videosphere.setAttribute('src', '#video');
          }

          // Start video immediately after user interaction
          video.play().then(() => {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            console.log('Video started immediately');
          }).catch((error) => {
            console.log('Video play failed, waiting for canplaythrough:', error);
            // Fallback: wait for canplaythrough if immediate play fails
          });

        } catch (error) {
          console.error('Video loading error:', error);
          if (loadingProgress) loadingProgress.textContent = 'Ошибка загрузки';
        }
      }
    };

    startOverlay.addEventListener('click', startHandler);
    startOverlay.addEventListener('touchstart', startHandler, { passive: true });

    // Loading progress - use 'progress' event for more accurate updates
    video.addEventListener('loadstart', () => {
      loadingProgress.textContent = 'Инициализация...';
    });

    video.addEventListener('progress', () => {
      if (video.buffered.length > 0 && video.duration) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const downloadPercent = (bufferedEnd / video.duration) * 100;
        loadingProgress.textContent = Math.round(downloadPercent) + '%';

        // Also show buffered time if available
        if (bufferedEnd < video.duration) {
          loadingProgress.textContent += ` (буфер: ${Math.round(bufferedEnd)}с)`;
        }
      }
    });

    // Video can play event - show start overlay
    video.addEventListener('canplay', () => {
      if (hasStartedLoading && startOverlay && startOverlay.hasBeenShown !== true) {
        startOverlay.style.display = 'flex';
      }
    });

    // Video can play through - assign to videosphere
    video.addEventListener('canplaythrough', () => {
      canPlayThroughHappened = true;
      if (loadingTimeout) clearTimeout(loadingTimeout);
      if (hasStartedLoading) {
        loadingOverlay.style.display = 'none';

        const videosphere = document.querySelector('a-videosphere');
        if (videosphere && !videosphere.hasAttribute('src')) {
          videosphere.setAttribute('src', '#video');
        }

        // Restore video position from localStorage
        restoreVideoPosition(video);

        if (userClickedStart) {
          video.play().catch(() => {});
        }
      }
    });

    // Buffering during playback
    video.addEventListener('waiting', () => {
      if (userClickedStart && !video.seeking) {
        bufferingOverlay.style.display = 'flex';
      }
    });

    video.addEventListener('playing', () => {
      bufferingOverlay.style.display = 'none';
      // Also hide loading overlay if video started playing during loading
      loadingOverlay.style.display = 'none';
    });

    video.addEventListener('seeked', () => {
      bufferingOverlay.style.display = 'none';
    });

    // Adaptive buffering optimization during playback
    video.addEventListener('timeupdate', () => {
      optimizeBuffering();
    });

    // Re-optimize on connection changes if supported
    if (connection && connection.addEventListener) {
      connection.addEventListener('change', () => {
        // Re-evaluate connection speed and adjust buffering strategy
        optimizeBuffering();
      });
    }

    // Error handling
    video.addEventListener('error', (e) => {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      loadingOverlay.style.display = 'none';
      bufferingOverlay.style.display = 'none';
      loadingProgress.textContent = 'Ошибка загрузки';

      console.error('Video loading error:', e);
    });

    // Abort loading if needed
    video.addEventListener('abort', () => {
      if (loadingTimeout) clearTimeout(loadingTimeout);
    });
  }
});
