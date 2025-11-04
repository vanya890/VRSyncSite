// Analytics module for tracking video views
const Analytics = {
  // Check if user already viewed today
  hasViewedToday: function() {
    const lastViewDate = localStorage.getItem('lastViewDate');
    if (!lastViewDate) return false;

    const today = new Date().toDateString();
    return lastViewDate === today;
  },

  // Track a view
  trackView: function() {
    if (this.hasViewedToday()) {
      console.log('View already tracked today');
      return;
    }

    fetch('/track-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (response.ok) {
        // Mark as viewed today
        const today = new Date().toDateString();
        localStorage.setItem('lastViewDate', today);
        console.log('View tracked successfully');
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
