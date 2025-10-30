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
    this.isFullscreen = false;
    this.isTouchDevice = 'ontouchstart' in window;

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

    // Fullscreen button
    this.fullscreenBtn = document.createElement('button');
    this.fullscreenBtn.id = 'fullscreen-btn';
    this.fullscreenBtn.title = 'Toggle Fullscreen';
    this.fullscreenBtn.innerHTML = '⛶';
    this.fullscreenBtn.addEventListener(this.isTouchDevice ? 'touchstart' : 'click', () => this.toggleFullscreen());
    buttonsRow.appendChild(this.fullscreenBtn);

    controls.appendChild(buttonsRow);

    // Toggle overlay button
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.className = 'toggle-controls-btn';
    this.toggleBtn.textContent = 'Hide Controls';
    this.toggleBtn.addEventListener(this.isTouchDevice ? 'touchstart' : 'click', () => this.toggleOverlay());

    controls.appendChild(this.toggleBtn);
    this.overlay.appendChild(controls);

    // Show controls toggle
    const showToggle = document.createElement('button');
    showToggle.className = 'show-toggle';
    showToggle.textContent = '🎥';
    showToggle.title = 'Show Video Controls';
    showToggle.addEventListener('click', () => {
      this.showOverlay();
      setTimeout(() => {
        this.overlayVisible = false;
        this.hideOverlay();
      }, 3000);
    });

    document.body.appendChild(this.overlay);
    document.body.appendChild(showToggle);

    this.showToggle = showToggle;

    // Touch events for better mobile support
    if (this.isTouchDevice) {
      // Add touch events for overlay
      this.overlay.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.clearHideTimeout();
      }, { passive: false });

      this.overlay.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.setHideTimeout();
      }, { passive: false });

      // Add touch events for show toggle
      showToggle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.showOverlay();
        setTimeout(() => {
          this.overlayVisible = false;
          this.hideOverlay();
        }, 3000);
      }, { passive: false });

      // Prevent context menu on long press
      this.overlay.addEventListener('contextmenu', (e) => e.preventDefault());
      showToggle.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Video event listeners
    this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
    this.video.addEventListener('timeupdate', () => this.updateProgress());
    this.video.addEventListener('ended', () => this.onVideoEnded());
    progressContainer.addEventListener(this.isTouchDevice ? 'touchstart' : 'click', (e) => this.seek(e));

    // Auto-hide controls
    this.hideTimeout = null;
    this.overlay.addEventListener('mouseenter', () => this.clearHideTimeout());
    this.overlay.addEventListener('mouseleave', () => this.setHideTimeout());

    // On mobile, show controls on touch
    if (this.isTouchDevice) {
      document.addEventListener('touchstart', (e) => {
        const rect = this.overlay.getBoundingClientRect();
        if (e.touches[0].clientX < rect.left || e.touches[0].clientY < rect.top ||
            e.touches[0].clientX > rect.right || e.touches[0].clientY > rect.bottom) {
          this.showOverlay();
          this.setHideTimeout();
        }
      }, { passive: true });
    } else {
      document.addEventListener('mousemove', (e) => {
        if (e.clientX < 350 && e.clientY < 150) {
          this.showOverlay();
          this.setHideTimeout();
        }
      });
    }

    // Fullscreen change listener
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('mozfullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('MSFullscreenChange', () => this.onFullscreenChange());

    // Start with controls visible for a few seconds
    setTimeout(() => this.hideOverlay(), 3000);
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

// Custom touch/mouse look controls component
AFRAME.registerComponent('mobile-touch-look', {
  init: function() {
    this.isTouchDevice = 'ontouchstart' in window;

    this.camera = this.el;
    this.start = { x: 0, y: 0 };
    this.isDragging = false;
    this.sensitivity = 0.005; // Adjust for comfortable feel

    this.onStart = this.onStart.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onEnd = this.onEnd.bind(this);

    const sceneEl = this.el.sceneEl;

    if (this.isTouchDevice) {
      // Mobile: touch events
      sceneEl.addEventListener('touchstart', this.onStart, { passive: false });
      sceneEl.addEventListener('touchmove', this.onMove, { passive: false });
      sceneEl.addEventListener('touchend', this.onEnd);
    } else {
      // Desktop: mouse events
      sceneEl.addEventListener('mousedown', this.onStart);
      sceneEl.addEventListener('mousemove', this.onMove);
      sceneEl.addEventListener('mouseup', this.onEnd);
      sceneEl.addEventListener('mouseleave', this.onEnd);
    }
  },

  onStart: function(e) {
    e.preventDefault();
    let clientX, clientY;
    if (this.isTouchDevice) {
      if (e.touches.length !== 1) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    this.isDragging = true;
    this.start.x = clientX;
    this.start.y = clientY;
    this.initialRotation = {
      y: this.camera.object3D.rotation.y,
      x: this.camera.object3D.rotation.x
    };
  },

  onMove: function(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    let clientX, clientY;
    if (this.isTouchDevice) {
      if (e.touches.length !== 1) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    var deltaX = clientX - this.start.x;
    var deltaY = clientY - this.start.y;

    // Horizontal rotation (azimuth - left/right)
    this.camera.object3D.rotation.y = this.initialRotation.y - deltaX * this.sensitivity;

    // Vertical rotation (polar - up/down)
    var newPolar = this.initialRotation.x - deltaY * this.sensitivity;
    // Allow full vertical rotation
    this.camera.object3D.rotation.x = newPolar;

    // Keep no roll
    this.camera.object3D.rotation.z = 0;
  },

  onEnd: function(e) {
    this.isDragging = false;
  }
});

// Global reference to the component (needed for start overlay click handler)
let videoControlsComponent = null;
let userClickedStart = false;
let canPlayThroughHappened = false;

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
      // Video can start playing - show start overlay only once at the very beginning
      const startOverlay = document.getElementById('start-overlay');
      if (startOverlay && startOverlay.hasBeenShown !== true) {
        startOverlay.style.display = 'flex';

        // Add click handler to start overlay
        const startHandler = () => {
          startOverlay.style.display = 'none';
          startOverlay.hasBeenShown = true;

          if (canPlayThroughHappened) {
            // Ready to play immediately
            video.play().then(() => {
              // Update UI state - video is playing
              if (videoControlsComponent) {
                videoControlsComponent.isPlaying = true;
                videoControlsComponent.playPauseBtn.textContent = '⏸️';
                videoControlsComponent.showOverlay();
                videoControlsComponent.setHideTimeout();
              }
            }).catch(console.error);
          } else {
            // Not fully ready, show loading and wait for canplaythrough
            loadingOverlay.style.display = 'flex';
            userClickedStart = true;
          }
        };

        startOverlay.addEventListener('click', startHandler);
        startOverlay.addEventListener('touchstart', startHandler, { passive: true });
      }
    });

    video.addEventListener('canplaythrough', () => {
      canPlayThroughHappened = true;
      if (loadingTimer) clearInterval(loadingTimer);

      if (userClickedStart) {
        // User clicked start before canplaythrough, now auto-play
        loadingOverlay.style.display = 'none';
        video.play().then(() => {
          // Update UI state - video is playing
          if (videoControlsComponent) {
            videoControlsComponent.isPlaying = true;
            videoControlsComponent.playPauseBtn.textContent = '⏸️';
            videoControlsComponent.showOverlay();
            videoControlsComponent.setHideTimeout();
          }
        }).catch(console.error);
        userClickedStart = false;
      } else {
        // No early click, just hide loading
        loadingOverlay.style.display = 'none';
      }
    });

    video.addEventListener('error', () => {
      if (loadingTimer) clearInterval(loadingTimer);
      loadingOverlay.style.display = 'none';
      loadingProgress.textContent = 'Ошибка загрузки';
    });
  }
});
