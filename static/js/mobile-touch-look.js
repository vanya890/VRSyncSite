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
