// Analytics module - now simplified since tracking happens server-side
const Analytics = {
  // Get video filename from URL parameters
  getVideoFilename: function() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('video');
  },

  // Debug function to manually track view (for testing)
  forceTrackView: function() {
    const videoFilename = this.getVideoFilename();
    console.log('[ANALYTICS] Manual tracking view for video:', videoFilename);

    if (!videoFilename) {
      console.warn('[ANALYTICS] No video filename found in URL');
      return;
    }

    const encodedFilename = encodeURIComponent(videoFilename);
    const trackUrl = `/track-view/${encodedFilename}`;
    console.log('[ANALYTICS] Sending manual track request to:', trackUrl);

    fetch(trackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      console.log('[ANALYTICS] Manual track response status:', response.status, 'ok:', response.ok);
      if (response.ok) {
        console.log(`[ANALYTICS] Manual view tracked successfully for video: ${videoFilename}`);
        return response.json();
      } else {
        console.error('[ANALYTICS] Failed to manually track view, status:', response.status);
        return response.text().then(text => {
          console.error('[ANALYTICS] Response text:', text);
          throw new Error(`HTTP ${response.status}`);
        });
      }
    })
    .then(data => {
      console.log('[ANALYTICS] Manual track response data:', data);
    })
    .catch(error => {
      console.error('[ANALYTICS] Error manually tracking view:', error);
    });
  }
};

// Initialize debug tools
document.addEventListener('DOMContentLoaded', function() {
  // Add debug buttons if in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const debugDiv = document.createElement('div');
    debugDiv.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 5px; font-size: 12px;';
    debugDiv.innerHTML = `
      <div style="margin-bottom: 5px; font-size: 10px;">Отслеживание происходит на сервере</div>
      <button onclick="Analytics.forceTrackView()" style="margin: 2px; padding: 5px;">Доп. отслеживание</button>
    `;
    document.body.appendChild(debugDiv);
  }
});
