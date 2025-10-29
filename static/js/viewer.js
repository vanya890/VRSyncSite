// Custom video controls overlay for VR environment
AFRAME.registerComponent('video-controls', {
  schema: {
    video: { type: 'selector' },
    autoStart: { default: false }
  },

  init: function() {
    this.video = this.data.video;
    this.overlayVisible = true;
    this.isPlaying = false;

    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'video-controls-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      z-index: 1000;
      min-width: 300px;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    // Controls container
    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 15px;
    `;

    // Progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      cursor: pointer;
      position: relative;
    `;

    this.progressBar = document.createElement('div');
    this.progressBar.style.cssText = `
      height: 100%;
      background: #007bff;
      border-radius: 4px;
      width: 0%;
      transition: width 0.1s ease;
    `;

    progressContainer.appendChild(this.progressBar);
    controls.appendChild(progressContainer);

    // Control buttons
    const buttonsRow = document.createElement('div');
    buttonsRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 15px;
    `;

    // Play/Pause button
    this.playPauseBtn = this.createControlButton('▶️', () => this.togglePlayPause());
    this.playPauseBtn.textContent = '▶️';
    buttonsRow.appendChild(this.playPauseBtn);

    // Restart button
    const restartBtn = this.createControlButton('↻', () => this.restart());
    buttonsRow.appendChild(restartBtn);

    // Volume control
    const volumeContainer = document.createElement('div');
    volumeContainer.style.cssText = `display: flex; align-items: center; gap: 8px;`;

    volumeContainer.innerHTML = `<span>🔊</span>`;
    this.volumeSlider = document.createElement('input');
    this.volumeSlider.type = 'range';
    this.volumeSlider.min = '0';
    this.volumeSlider.max = '1';
    this.volumeSlider.step = '0.1';
    this.volumeSlider.value = '1';
    this.volumeSlider.style.cssText = `
      width: 80px;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      outline: none;
      border-radius: 2px;
      cursor: pointer;
    `;
    this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
    volumeContainer.appendChild(this.volumeSlider);
    buttonsRow.appendChild(volumeContainer);

    // Time display
    this.timeDisplay = document.createElement('span');
    this.timeDisplay.style.cssText = `
      font-size: 12px;
      color: #ccc;
      min-width: 60px;
      text-align: right;
    `;
    this.timeDisplay.textContent = '0:00 / 0:00';
    buttonsRow.appendChild(this.timeDisplay);

    controls.appendChild(buttonsRow);

    // Toggle overlay button
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.textContent = 'Hide Controls';
    this.toggleBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      margin-top: 10px;
      transition: background 0.3s ease;
    `;
    this.toggleBtn.addEventListener('mouseenter', () => this.toggleBtn.style.background = 'rgba(255, 255, 255, 0.2)');
    this.toggleBtn.addEventListener('mouseleave', () => this.toggleBtn.style.background = 'rgba(255, 255, 255, 0.1)');
    this.toggleBtn.addEventListener('click', () => this.toggleOverlay());

    controls.appendChild(this.toggleBtn);
    this.overlay.appendChild(controls);

    // Show controls toggle
    const showToggle = document.createElement('button');
    showToggle.textContent = '🎥';
    showToggle.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: rgba(0, 0, 0, 0.8);
      border: none;
      border-radius: 50%;
      color: white;
      font-size: 18px;
      cursor: pointer;
      z-index: 999;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    showToggle.title = 'Show Video Controls';
    showToggle.addEventListener('click', () => {
      this.showOverlay();
      setTimeout(() => this.overlayVisible = false, 3000);
    });

    document.body.appendChild(this.overlay);
    document.body.appendChild(showToggle);

    this.showToggle = showToggle;

    // Video event listeners
    this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
    this.video.addEventListener('timeupdate', () => this.updateProgress());
    this.video.addEventListener('ended', () => this.onVideoEnded());
    progressContainer.addEventListener('click', (e) => this.seek(e));

    // Auto-hide controls
    this.hideTimeout = null;
    this.overlay.addEventListener('mouseenter', () => this.clearHideTimeout());
    this.overlay.addEventListener('mouseleave', () => this.setHideTimeout());
    document.addEventListener('mousemove', (e) => {
      if (e.clientX < 350 && e.clientY < 150) {
        this.showOverlay();
        this.setHideTimeout();
      }
    });

    // Start with controls visible for a few seconds
    setTimeout(() => this.hideOverlay(), 3000);
  },

  createControlButton: function(text, callback) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.3s ease, transform 0.2s ease;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.2)';
      btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.1)';
      btn.style.transform = 'scale(1)';
    });
    btn.addEventListener('click', callback);
    return btn;
  },

  togglePlayPause: function() {
    if (this.video.paused) {
      this.video.play();
      this.playPauseBtn.textContent = '⏸️';
      this.isPlaying = true;
    } else {
      this.video.pause();
      this.playPauseBtn.textContent = '▶️';
      this.isPlaying = false;
    }
  },

  restart: function() {
    this.video.currentTime = 0;
    this.video.play();
    this.playPauseBtn.textContent = '⏸️';
    this.isPlaying = true;
  },

  setVolume: function(volume) {
    this.video.volume = volume;
  },

  seek: function(e) {
    const rect = e.target.parentElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const time = percent * this.video.duration;
    this.video.currentTime = time;
  },

  updateProgress: function() {
    if (this.video.duration) {
      const percent = (this.video.currentTime / this.video.duration) * 100;
      this.progressBar.style.width = percent + '%';
      this.timeDisplay.textContent = this.formatTime(this.video.currentTime) + ' / ' + this.formatTime(this.video.duration);
    }
  },

  onVideoLoaded: function() {
    this.video.currentTime = 0;
    this.video.volume = 1;
    this.volumeSlider.value = '1';
  },

  onVideoEnded: function() {
    this.playPauseBtn.textContent = '▶️';
    this.isPlaying = false;
  },

  formatTime: function(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  },

  toggleOverlay: function() {
    if (this.overlayVisible) {
      this.hideOverlay();
    } else {
      this.showOverlay();
      this.setHideTimeout();
    }
  },

  showOverlay: function() {
    this.overlay.style.opacity = '1';
    this.overlayVisible = true;
    this.showToggle.style.opacity = '0';
  },

  hideOverlay: function() {
    this.overlay.style.opacity = '0';
    this.overlayVisible = false;
    this.showToggle.style.opacity = '1';
  },

  setHideTimeout: function() {
    this.clearHideTimeout();
    this.hideTimeout = setTimeout(() => this.hideOverlay(), 3000);
  },

  clearHideTimeout: function() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
});



// Add component to scene automatically
document.addEventListener('DOMContentLoaded', function() {
  const scene = document.querySelector('a-scene');
  const video = document.querySelector('#video');

  if (scene && video) {
    scene.setAttribute('video-controls', `video: #video`);

    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingProgress = document.getElementById('loading-progress');

    // Loading progress indicator
    let loadingTimer = null;
    video.addEventListener('loadstart', () => {
      loadingOverlay.style.display = 'flex';
      loadingProgress.textContent = '0%';
      let progress = 0;
      loadingTimer = setInterval(() => {
        if (video.buffered.length > 0) {
          progress = (video.buffered.end(0) / video.duration) * 100;
          loadingProgress.textContent = Math.round(progress) + '%';
          if (progress >= 100) {
            clearInterval(loadingTimer);
            loadingOverlay.style.display = 'none';
          }
        }
      }, 200);
    });

    video.addEventListener('canplay', () => {
      // Show big play button when video is ready
      bigPlayButton.style.display = 'flex';
    });

    video.addEventListener('canplaythrough', () => {
      if (loadingTimer) clearInterval(loadingTimer);
      loadingOverlay.style.display = 'none';
    });

    // Big play button
    const bigPlayButton = document.getElementById('big-play-button');
    bigPlayButton.addEventListener('click', () => {
      bigPlayButton.style.display = 'none';
      video.play().then(() => {
        scene.setAttribute('video-controls', `video: #video`);
      }).catch(console.error);
    });

    video.addEventListener('error', () => {
      if (loadingTimer) clearInterval(loadingTimer);
      loadingOverlay.style.display = 'none';
      loadingProgress.textContent = 'Ошибка загрузки';
    });
  }
});
