// Custom video controls overlay for VR environment
AFRAME.registerComponent('video-controls', {
  schema: {
    video: { type: 'selector' },
    autoStart: { default: false }
  },

  init: function() {
    this.video = this.data.video;
    this.isPlaying = false;
    this.isFullscreen = false;
    this.isTouchDevice = 'ontouchstart' in window;
    this.userMuted = false; // To track if user manually muted the video
    this.isControlsVisible = true; // Track controls visibility

    // Store global reference for start overlay handler
    videoControlsComponent = this;

    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'video-controls-overlay';

    // Controls container
    const controls = document.createElement('div');

    // Progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';

    this.progressBar = document.createElement('div');
    this.progressBar.className = 'progress-bar';

    progressContainer.appendChild(this.progressBar);
    controls.appendChild(progressContainer);

    // Control buttons row
    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'control-buttons';

    // Play/Pause button
    this.playPauseBtn = this.createControlButton('▶️', () => this.togglePlayPause());
    buttonsRow.appendChild(this.playPauseBtn);

    // Restart button
    const restartBtn = this.createControlButton('↻', () => this.restart());
    buttonsRow.appendChild(restartBtn);

    // Volume control
    const volumeContainer = document.createElement('div');
    volumeContainer.className = 'volume-container';
    volumeContainer.innerHTML = `<span>🔊</span>`;
    this.volumeSlider = document.createElement('input');
    this.volumeSlider.className = 'volume-slider';
    this.volumeSlider.type = 'range';
    this.volumeSlider.min = '0';
    this.volumeSlider.max = '1';
    this.volumeSlider.step = '0.1';
    this.volumeSlider.value = '1';
    this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
    volumeContainer.appendChild(this.volumeSlider);
    buttonsRow.appendChild(volumeContainer);

    // Time display
    this.timeDisplay = document.createElement('span');
    this.timeDisplay.className = 'time-display';
    this.timeDisplay.textContent = '0:00 / 0:00';
    buttonsRow.appendChild(this.timeDisplay);

    // Toggle controls button
    const toggleControlsBtn = this.createControlButton('👁️', () => this.toggleControls());
    toggleControlsBtn.title = 'Toggle Controls Visibility';
    buttonsRow.appendChild(toggleControlsBtn);

    // Fullscreen button
    this.fullscreenBtn = document.createElement('button');
    this.fullscreenBtn.id = 'fullscreen-btn';
    this.fullscreenBtn.title = 'Toggle Fullscreen';
    this.fullscreenBtn.innerHTML = '⛶';
    this.fullscreenBtn.addEventListener(this.isTouchDevice ? 'touchstart' : 'click', () => this.toggleFullscreen());
    buttonsRow.appendChild(this.fullscreenBtn);

    controls.appendChild(buttonsRow);
    this.overlay.appendChild(controls);

    // Create floating show controls button (hidden by default)
    this.showControlsBtn = document.createElement('button');
    this.showControlsBtn.className = 'show-toggle';
    this.showControlsBtn.title = 'Show Controls';
    this.showControlsBtn.innerHTML = '⏯️';
    this.showControlsBtn.addEventListener(this.isTouchDevice ? 'touchstart' : 'click', () => this.toggleControls());
    document.body.appendChild(this.showControlsBtn);

    // Controls always visible, no toggle or show-toggle needed

    document.body.appendChild(this.overlay);

    // Video event listeners
    this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
    this.video.addEventListener('timeupdate', () => this.updateProgress());
    this.video.addEventListener('ended', () => this.onVideoEnded());
    this.video.addEventListener('play', () => {
      this.playPauseBtn.textContent = '⏸️';
      this.isPlaying = true;
      if (!this.userMuted) this.video.muted = false;
    });
    this.video.addEventListener('pause', () => {
      this.playPauseBtn.textContent = '▶️';
      this.isPlaying = false;
    });

    // Seek functionality - support both click and drag
    this.isDragging = false;
    this.handleSeek = this.handleSeek.bind(this);
    this.stopSeek = this.stopSeek.bind(this);
    progressContainer.addEventListener(this.isTouchDevice ? 'touchstart' : 'mousedown', (e) => this.startSeek(e));
    progressContainer.addEventListener(this.isTouchDevice ? 'touchstart' : 'click', (e) => this.seek(e)); // keep click for non-drag seeking

    // Fullscreen change listener
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('mozfullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('MSFullscreenChange', () => this.onFullscreenChange());
  },

  createControlButton: function(text, callback) {
    const btn = document.createElement('button');
    btn.className = 'control-button';
    btn.textContent = text;

    // Add hover effects for non-touch devices
    if (!this.isTouchDevice) {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255, 255, 255, 0.2)';
        btn.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
        btn.style.transform = 'scale(1)';
      });
    } else {
      // Add touch feedback for mobile
      btn.addEventListener('touchstart', () => {
        btn.style.background = 'rgba(255, 255, 255, 0.2)';
        btn.style.transform = 'scale(0.95)';
      }, { passive: true });
      btn.addEventListener('touchend', () => {
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
        btn.style.transform = 'scale(1)';
      }, { passive: true });
    }

    btn.addEventListener(this.isTouchDevice ? 'touchstart' : 'click', callback);
    return btn;
  },

  toggleFullscreen: function() {
    const doc = document;
    const docEl = doc.documentElement;

    const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen ||
                              docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    const exitFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen ||
                           doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement &&
        !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
      requestFullScreen.call(docEl);
    } else {
      exitFullScreen.call(doc);
    }
  },

  onFullscreenChange: function() {
    this.isFullscreen = !!(document.fullscreenElement || document.mozFullScreenElement ||
                          document.webkitFullscreenElement || document.msFullscreenElement);

    // Update fullscreen button icon
    this.fullscreenBtn.innerHTML = this.isFullscreen ? '⛶' : '⛶';

    // Adjust controls positioning for fullscreen
    if (this.isFullscreen) {
      // In fullscreen, controls might need repositioning
    } else {
      // Normal mode
    }
  },

  toggleControls: function() {
    this.isControlsVisible = !this.isControlsVisible;
    if (this.isControlsVisible) {
      this.overlay.style.display = 'block';
      this.showControlsBtn.style.opacity = '0';
      this.showControlsBtn.style.pointerEvents = 'none';
    } else {
      this.overlay.style.display = 'none';
      this.showControlsBtn.style.opacity = '1';
      this.showControlsBtn.style.pointerEvents = 'auto';
    }
  },

  togglePlayPause: function() {
    if (this.video.paused) {
      userClickedStart = true;
      this.video.play();
    } else {
      this.video.pause();
    }
  },

  restart: function() {
    userClickedStart = true;
    this.video.currentTime = 0;
    this.video.play();
  },

  setVolume: function(volume) {
    this.video.volume = volume;
    if (volume === '0' || volume === 0) {
      this.video.muted = true;
      this.userMuted = true;
    } else {
      this.video.muted = false;
      this.userMuted = false;
    }
  },

  seek: function(e) {
    const rect = e.target.parentElement.getBoundingClientRect();
    let clickX;

    if (this.isTouchDevice && e.changedTouches) {
      clickX = e.changedTouches[0].clientX - rect.left;
    } else if (e.clientX !== undefined) {
      clickX = e.clientX - rect.left;
    } else {
      return; // No valid position
    }

    const percent = Math.max(0, Math.min(1, clickX / rect.width)); // Clamp between 0 and 1
    const time = percent * this.video.duration;
    this.video.currentTime = time;
  },

  startSeek: function(e) {
    this.isDragging = true;
    this.performSeek(e);
    document.addEventListener(this.isTouchDevice ? 'touchmove' : 'mousemove', this.handleSeek);
    document.addEventListener(this.isTouchDevice ? 'touchend' : 'mouseup', this.stopSeek);
    e.preventDefault();
  },

  handleSeek: function(e) {
    if (this.isDragging) {
      this.performSeek(e);
    }
  },

  stopSeek: function(e) {
    this.isDragging = false;
    document.removeEventListener(this.isTouchDevice ? 'touchmove' : 'mousemove', this.handleSeek);
    document.removeEventListener(this.isTouchDevice ? 'touchend' : 'mouseup', this.stopSeek);
  },

  performSeek: function(e) {
    const rect = this.progressBar.parentElement.getBoundingClientRect();
    let clickX;

    if (this.isTouchDevice && e.changedTouches) {
      clickX = e.changedTouches[0].clientX - rect.left;
    } else if (e.clientX !== undefined) {
      clickX = e.clientX - rect.left;
    } else {
      return;
    }

    const percent = Math.max(0, Math.min(1, clickX / rect.width));
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
  }
});
