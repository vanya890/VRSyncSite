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
    this.overlay.appendChild(controls);

    // Controls always visible, no toggle or show-toggle needed

    document.body.appendChild(this.overlay);

    // Video event listeners
    this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
    this.video.addEventListener('timeupdate', () => this.updateProgress());
    this.video.addEventListener('ended', () => this.onVideoEnded());
    progressContainer.addEventListener(this.isTouchDevice ? 'touchstart' : 'click', (e) => this.seek(e));

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

  togglePlayPause: function() {
    if (this.video.paused) {
      userClickedStart = true;
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
    userClickedStart = true;
    this.video.currentTime = 0;
    this.video.play();
    this.playPauseBtn.textContent = '⏸️';
    this.isPlaying = true;
  },

  setVolume: function(volume) {
    this.video.volume = volume;
    // If user adjusts volume, they probably want sound
    this.video.muted = volume === '0' || volume === 0;
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

    // Start overlay click handler - begin loading
    const startHandler = async () => {
      if (!hasStartedLoading) {
        startOverlay.style.display = 'none';
        startOverlay.hasBeenShown = true;
        hasStartedLoading = true;

        // Show loading overlay immediately
        loadingOverlay.style.display = 'flex';
        loadingProgress.textContent = 'Подготовка...';

        try {
          // Load video with mobile-friendly approach
          await loadVideoMobile();

          // Show loading progress and start buffering
          loadingProgress.textContent = '0%';

          // Adaptive timeout based on connection speed
          loadingTimeout = setTimeout(() => {
            if (!canPlayThroughHappened) {
              loadingProgress.textContent = 'Оптимизация загрузки...';
              // Allow to proceed with partial buffer on mobile
              const videosphere = document.querySelector('a-videosphere');
              if (videosphere) {
                videosphere.setAttribute('src', '#video');
                video.play().then(() => {
                  // Hide overlay when video starts playing despite timeout
                  loadingOverlay.style.display = 'none';
                }).catch(() => {});
              }
            }
          }, criticalLoadTimeout);

        } catch (error) {
          console.error('Video loading error:', error);
          loadingProgress.textContent = 'Ошибка загрузки';
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
