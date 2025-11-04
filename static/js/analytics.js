// Analytics module for tracking video views per video
const Analytics = {
  // Get video filename from URL parameters
  getVideoFilename: function() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('video');
  },

  // Check if user already viewed this video today
  hasViewedVideoToday: function(videoFilename) {
    const key = `viewed_${videoFilename}`;
    const lastViewDate = localStorage.getItem(key);
    if (!lastViewDate) return false;

    const today = new Date().toDateString();
    return lastViewDate === today;
  },

  // Track a view for specific video
  trackView: function() {
    const videoFilename = this.getVideoFilename();
    if (!videoFilename) {
      console.warn('No video filename found in URL');
      return;
    }

    if (this.hasViewedVideoToday(videoFilename)) {
      console.log(`View already tracked today for video: ${videoFilename}`);
      return;
    }

    fetch(`/track-view/${encodeURIComponent(videoFilename)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (response.ok) {
        // Mark as viewed today for this video
        const today = new Date().toDateString();
        const key = `viewed_${videoFilename}`;
        localStorage.setItem(key, today);
        console.log(`View tracked successfully for video: ${videoFilename}`);
      } else {
        console.error('Failed to track view');
      }
    })
    .catch(error => {
      console.error('Error tracking view:', error);
    });
  }
};

// Auto-track view when video starts playing
document.addEventListener('DOMContentLoaded', function() {
  const video = document.querySelector('#video');
  if (video) {
    video.addEventListener('play', function() {
      Analytics.trackView();
    });
  }
});
