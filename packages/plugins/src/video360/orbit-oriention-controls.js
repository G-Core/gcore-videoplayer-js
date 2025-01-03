/**
 * Convert a quaternion to an angle
 *
 * Taken from https://stackoverflow.com/a/35448946
 * Thanks P. Ellul
 */

import * as THREE from 'three';

function Quat2Angle(x, y, z, w) {
  const test = x * y + z * w;

  // singularity at North Pole
  if (test > 0.499) {
    const yaw = 2 * Math.atan2(x, w);
    const pitch = Math.PI / 2;
    const roll = 0;

    return new THREE.Vector3(pitch, roll, yaw);
  }

  // singularity at South Pole
  if (test < -0.499) {
    const yaw = -2 * Math.atan2(x, w);
    const pitch = -Math.PI / 2;
    const roll = 0;

    return new THREE.Vector3(pitch, roll, yaw);
  }

  const sqx = x * x;
  const sqy = y * y;
  const sqz = z * z;
  const yaw = Math.atan2(2 * y * w - 2 * x * z, 1 - 2 * sqy - 2 * sqz);
  const pitch = Math.asin(2 * test);
  const roll = Math.atan2(2 * x * w - 2 * y * z, 1 - 2 * sqx - 2 * sqz);

  return new THREE.Vector3(pitch, roll, yaw);
}

class OrbitOrientationControls {
  constructor(options) {
    //https://github.com/mrdoob/three.js/issues/9562
    this.initLibraryCauseThreeJSDumbguys();
    this.object = options.camera;
    this.domElement = options.canvas;
    this.orbit = new THREE.OrbitControls(this.object, this.domElement);
    this.speed = 0.5;
    this.orbit.target.set(0, 0, -1);
    this.orbit.enableZoom = false;
    this.orbit.enablePan = false;
    this.orbit.rotateSpeed = -this.speed;

    // if orientation is supported
    if (options.orientation) {
      this.orientation = new THREE.DeviceOrientationControls(this.object);
    }

    // if projection is not full view
    // limit the rotation angle in order to not display back half view
    if (options.halfView) {
      this.orbit.minAzimuthAngle = -Math.PI / 4;
      this.orbit.maxAzimuthAngle = Math.PI / 4;
    }
  }

  update() {
    // orientation updates the camera using quaternions and
    // orbit updates the camera using angles. They are incompatible
    // and one update overrides the other. So before
    // orbit overrides orientation we convert our quaternion changes to
    // an angle change. Then save the angle into orbit so that
    // it will take those into account when it updates the camera and overrides
    // our changes

    if (this.orientation) {
      this.orientation.update();

      const quat = this.orientation.object.quaternion;
      const currentAngle = Quat2Angle(quat.x, quat.y, quat.z, quat.w);

      // we also have to store the last angle since quaternions are b
      if (typeof this.lastAngle_ === 'undefined') {
        this.lastAngle_ = currentAngle;
      }
      this.orbit.rotateLeft((this.lastAngle_.z - currentAngle.z));
      this.orbit.rotateUp((this.lastAngle_.y - currentAngle.y));
      this.lastAngle_ = currentAngle;
    }

    this.orbit.update();
  }

  dispose() {
    this.orbit.dispose();

    if (this.orientation) {
      this.orientation.dispose();
    }
  }

  initLibraryCauseThreeJSDumbguys() {
    /**
     * @author richt / http://richt.me
     * @author WestLangley / http://github.com/WestLangley
     *
     * W3C Device Orientation control (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
     */

    /**
     * @author richt / http://richt.me
     * @author WestLangley / http://github.com/WestLangley
     *
     * W3C Device Orientation control (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
     */

    // eslint-disable-next-line no-import-assign
    THREE.DeviceOrientationControls = function (object) {
      const scope = this;

      this.object = object;
      this.object.rotation.reorder('YXZ');

      this.enabled = true;

      this.deviceOrientation = {};
      this.screenOrientation = 0;

      this.alphaOffset = 0; // radians

      const onDeviceOrientationChangeEvent = function (event) {
        scope.deviceOrientation = event;
      };

      const onScreenOrientationChangeEvent = function () {
        scope.screenOrientation = window.orientation || 0;
      };

      // The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''

      const setObjectQuaternion = function () {
        const zee = new THREE.Vector3(0, 0, 1);

        const euler = new THREE.Euler();

        const q0 = new THREE.Quaternion();

        const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around the x-axis

        return function (quaternion, alpha, beta, gamma, orient) {
          euler.set(beta, alpha, -gamma, 'YXZ'); // 'ZXY' for the device, but 'YXZ' for us

          quaternion.setFromEuler(euler); // orient the device

          quaternion.multiply(q1); // camera looks out the back of the device, not the top

          quaternion.multiply(q0.setFromAxisAngle(zee, -orient)); // adjust for screen orientation
        };
      }();

      this.connect = function () {
        onScreenOrientationChangeEvent(); // run once on load

        window.addEventListener('orientationchange', onScreenOrientationChangeEvent, false);
        window.addEventListener('deviceorientation', onDeviceOrientationChangeEvent, false);

        scope.enabled = true;
      };

      this.disconnect = function () {
        window.removeEventListener('orientationchange', onScreenOrientationChangeEvent, false);
        window.removeEventListener('deviceorientation', onDeviceOrientationChangeEvent, false);

        scope.enabled = false;
      };

      this.update = function () {
        if (scope.enabled === false) {
          return;
        }

        const device = scope.deviceOrientation;

        if (device) {
          const alpha = device.alpha ? THREE.Math.degToRad(device.alpha) + scope.alphaOffset : 0; // Z

          const beta = device.beta ? THREE.Math.degToRad(device.beta) : 0; // X'

          const gamma = device.gamma ? THREE.Math.degToRad(device.gamma) : 0; // Y''

          const orient = scope.screenOrientation ? THREE.Math.degToRad(scope.screenOrientation) : 0; // O

          if (alpha === 0 || beta === 0 || gamma === 0) {
            return;
          }

          setObjectQuaternion(scope.object.quaternion, alpha, beta, gamma, orient);
        }
      };

      this.dispose = function () {
        scope.disconnect();
      };

      this.connect();
    };

    /**
     * @author qiao / https://github.com/qiao
     * @author mrdoob / http://mrdoob.com
     * @author alteredq / http://alteredqualia.com/
     * @author WestLangley / http://github.com/WestLangley
     * @author erich666 / http://erichaines.com
     * @author ScieCode / http://github.com/sciecode
     */

    // This set of controls performs orbiting, dollying (zooming), and panning.
    // Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
    //
    //    Orbit - left mouse / touch: one-finger move
    //    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
    //    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

    // eslint-disable-next-line no-import-assign
    THREE.OrbitControls = function (object, domElement) {
      let zoomChanged;
      const panOffset = new THREE.Vector3();
      let scale;
      const sphericalDelta = new THREE.Spherical();
      // current position in spherical coordinates
      const spherical = new THREE.Spherical();

      const EPS = 0.000001;
      // internals
      const changeEvent = { type: 'change' };

      const scope = this;

      this.object = object;

      this.domElement = (domElement !== undefined) ? domElement : document;

      // Set to false to disable this control
      this.enabled = true;

      // "target" sets the location of focus, where the object orbits around
      this.target = new THREE.Vector3();

      // How far you can dolly in and out ( PerspectiveCamera only )
      this.minDistance = 0;
      this.maxDistance = Infinity;

      // How far you can zoom in and out ( OrthographicCamera only )
      this.minZoom = 0;
      this.maxZoom = Infinity;

      // How far you can orbit vertically, upper and lower limits.
      // Range is 0 to Math.PI radians.
      this.minPolarAngle = 0; // radians
      this.maxPolarAngle = Math.PI; // radians

      // How far you can orbit horizontally, upper and lower limits.
      // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
      this.minAzimuthAngle = -Infinity; // radians
      this.maxAzimuthAngle = Infinity; // radians

      // Set to true to enable damping (inertia)
      // If damping is enabled, you must call controls.update() in your animation loop
      this.enableDamping = false;
      this.dampingFactor = 0.25;

      // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
      // Set to false to disable zooming
      this.enableZoom = true;
      this.zoomSpeed = 1.0;

      // Set to false to disable rotating
      this.enableRotate = true;
      this.rotateSpeed = 1.0;

      // Set to false to disable panning
      this.enablePan = true;
      this.panSpeed = 1.0;
      this.screenSpacePanning = false; // if true, pan in screen-space
      this.keyPanSpeed = 7.0; // pixels moved per arrow key push

      // Set to true to automatically rotate around the target
      // If auto-rotate is enabled, you must call controls.update() in your animation loop
      this.autoRotate = false;
      this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

      // Set to false to disable use of the keys
      this.enableKeys = true;

      // The four arrow keys
      this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

      // Mouse buttons
      this.mouseButtons = { ORBIT: THREE.MOUSE.LEFT, ZOOM: THREE.MOUSE.MIDDLE, PAN: THREE.MOUSE.RIGHT };

      // for reset
      this.target0 = this.target.clone();
      this.position0 = this.object.position.clone();
      this.zoom0 = this.object.zoom;

      //
      // public methods
      //

      this.getPolarAngle = function () {
        return spherical.phi;
      };

      this.getAzimuthalAngle = function () {
        return spherical.theta;
      };

      this.saveState = function () {
        scope.target0.copy(scope.target);
        scope.position0.copy(scope.object.position);
        scope.zoom0 = scope.object.zoom;
      };

      this.reset = function () {
        scope.target.copy(scope.target0);
        scope.object.position.copy(scope.position0);
        scope.object.zoom = scope.zoom0;

        scope.object.updateProjectionMatrix();
        scope.dispatchEvent(changeEvent);

        scope.update();

        state = STATE.NONE;
      };

      // this method is exposed, but perhaps it would be better if we can make it private...
      this.update = function () {
        const offset = new THREE.Vector3();

        // so camera.up is the orbit axis
        const quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
        const quatInverse = quat.clone().inverse();

        const lastPosition = new THREE.Vector3();
        const lastQuaternion = new THREE.Quaternion();

        return function update() {
          const position = scope.object.position;

          offset.copy(position).sub(scope.target);

          // rotate offset to "y-axis-is-up" space
          offset.applyQuaternion(quat);

          // angle from z-axis around y-axis
          spherical.setFromVector3(offset);

          if (scope.autoRotate && state === STATE.NONE) {
            this.rotateLeft(getAutoRotationAngle());
          }

          spherical.theta += sphericalDelta.theta;
          spherical.phi += sphericalDelta.phi;

          // restrict theta to be between desired limits
          spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));

          // restrict phi to be between desired limits
          spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));

          spherical.makeSafe();

          spherical.radius *= scale;

          // restrict radius to be between desired limits
          spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

          // move target to panned location
          scope.target.add(panOffset);

          offset.setFromSpherical(spherical);

          // rotate offset back to "camera-up-vector-is-up" space
          offset.applyQuaternion(quatInverse);

          position.copy(scope.target).add(offset);

          scope.object.lookAt(scope.target);

          if (scope.enableDamping === true) {
            sphericalDelta.theta *= (1 - scope.dampingFactor);
            sphericalDelta.phi *= (1 - scope.dampingFactor);

            panOffset.multiplyScalar(1 - scope.dampingFactor);
          } else {
            sphericalDelta.set(0, 0, 0);

            panOffset.set(0, 0, 0);
          }

          scale = 1;

          // update condition is:
          // min(camera displacement, camera rotation in radians)^2 > EPS
          // using small-angle approximation cos(x/2) = 1 - x^2 / 8
          if (zoomChanged ||
            lastPosition.distanceToSquared(scope.object.position) > EPS ||
            8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {
            scope.dispatchEvent(changeEvent);

            lastPosition.copy(scope.object.position);
            lastQuaternion.copy(scope.object.quaternion);
            zoomChanged = false;

            return true;
          }

          return false;
        };
      }();

      this.dispose = function () {
        scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
        scope.domElement.removeEventListener('mousedown', onMouseDown, false);
        scope.domElement.removeEventListener('wheel', onMouseWheel, false);

        scope.domElement.removeEventListener('touchstart', onTouchStart, false);
        scope.domElement.removeEventListener('touchend', onTouchEnd, false);
        scope.domElement.removeEventListener('touchmove', onTouchMove, false);

        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mouseup', onMouseUp, false);

        window.removeEventListener('keydown', onKeyDown, false);
      };

      const startEvent = { type: 'start' };
      const endEvent = { type: 'end' };

      const STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY_PAN: 4 };

      let state = STATE.NONE;

      scale = 1;
      zoomChanged = false;

      const rotateStart = new THREE.Vector2();
      const rotateEnd = new THREE.Vector2();
      const rotateDelta = new THREE.Vector2();

      const panStart = new THREE.Vector2();
      const panEnd = new THREE.Vector2();
      const panDelta = new THREE.Vector2();

      const dollyStart = new THREE.Vector2();
      const dollyEnd = new THREE.Vector2();
      const dollyDelta = new THREE.Vector2();

      function getAutoRotationAngle() {
        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
      }

      function getZoomScale() {
        return Math.pow(0.95, scope.zoomSpeed);
      }

      function rotateLeft(angle) {
        sphericalDelta.theta -= angle;
      }

      function rotateUp(angle) {
        sphericalDelta.phi -= angle;
      }

      this.rotateLeft = function (angle) {
        sphericalDelta.theta -= angle;
      };

      this.rotateUp = function (angle) {
        sphericalDelta.phi -= angle;
      };

      const panLeft = function () {
        const v = new THREE.Vector3();

        return function panLeft(distance, objectMatrix) {
          v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
          v.multiplyScalar(-distance);

          panOffset.add(v);
        };
      }();

      const panUp = function () {
        const v = new THREE.Vector3();

        return function panUp(distance, objectMatrix) {
          if (scope.screenSpacePanning === true) {
            v.setFromMatrixColumn(objectMatrix, 1);
          } else {
            v.setFromMatrixColumn(objectMatrix, 0);
            v.crossVectors(scope.object.up, v);
          }

          v.multiplyScalar(distance);

          panOffset.add(v);
        };
      }();

      // deltaX and deltaY are in pixels; right and down are positive
      const pan = function () {
        const offset = new THREE.Vector3();

        return function pan(deltaX, deltaY) {
          const element = scope.domElement === document ? scope.domElement.body : scope.domElement;

          if (scope.object.isPerspectiveCamera) {
            // perspective
            const position = scope.object.position;

            offset.copy(position).sub(scope.target);
            let targetDistance = offset.length();

            // half of the fov is center to top of screen
            targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0);

            // we use only clientHeight here so aspect ratio does not distort speed
            panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
            panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);
          } else if (scope.object.isOrthographicCamera) {
            // orthographic
            panLeft(
              deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth,
              scope.object.matrix
            );
            panUp(
              deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight,
              scope.object.matrix
            );
          } else {
            // camera neither orthographic nor perspective
            console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
            scope.enablePan = false;
          }
        };
      }();

      function dollyIn(dollyScale) {
        if (scope.object.isPerspectiveCamera) {
          scale /= dollyScale;
        } else if (scope.object.isOrthographicCamera) {
          scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale));
          scope.object.updateProjectionMatrix();
          zoomChanged = true;
        } else {
          console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
          scope.enableZoom = false;
        }
      }

      function dollyOut(dollyScale) {
        if (scope.object.isPerspectiveCamera) {
          scale *= dollyScale;
        } else if (scope.object.isOrthographicCamera) {
          scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale));
          scope.object.updateProjectionMatrix();
          zoomChanged = true;
        } else {
          console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
          scope.enableZoom = false;
        }
      }

      //
      // event callbacks - update the object state
      //
      function handleMouseDownRotate(event) {
        rotateStart.set(event.clientX, event.clientY);
      }

      function handleMouseDownDolly(event) {
        dollyStart.set(event.clientX, event.clientY);
      }

      function handleMouseDownPan(event) {
        panStart.set(event.clientX, event.clientY);
      }

      function handleMouseMoveRotate(event) {
        rotateEnd.set(event.clientX, event.clientY);

        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

        const element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height

        rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

        rotateStart.copy(rotateEnd);

        scope.update();
      }

      function handleMouseMoveDolly(event) {
        dollyEnd.set(event.clientX, event.clientY);

        dollyDelta.subVectors(dollyEnd, dollyStart);

        if (dollyDelta.y > 0) {
          dollyIn(getZoomScale());
        } else if (dollyDelta.y < 0) {
          dollyOut(getZoomScale());
        }

        dollyStart.copy(dollyEnd);

        scope.update();
      }

      function handleMouseMovePan(event) {
        panEnd.set(event.clientX, event.clientY);

        panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

        pan(panDelta.x, panDelta.y);

        panStart.copy(panEnd);

        scope.update();
      }

      function handleMouseUp() {}

      function handleMouseWheel(event) {
        if (event.deltaY < 0) {
          dollyOut(getZoomScale());
        } else if (event.deltaY > 0) {
          dollyIn(getZoomScale());
        }

        scope.update();
      }

      function handleKeyDown(event) {
        switch (event.keyCode) {
          case scope.keys.UP:
            pan(0, scope.keyPanSpeed);
            scope.update();
            break;

          case scope.keys.BOTTOM:
            pan(0, -scope.keyPanSpeed);
            scope.update();
            break;

          case scope.keys.LEFT:
            pan(scope.keyPanSpeed, 0);
            scope.update();
            break;

          case scope.keys.RIGHT:
            pan(-scope.keyPanSpeed, 0);
            scope.update();
            break;
        }
      }

      function handleTouchStartRotate(event) {
        rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
      }

      function handleTouchStartDollyPan(event) {
        if (scope.enableZoom) {
          const dx = event.touches[0].pageX - event.touches[1].pageX;
          const dy = event.touches[0].pageY - event.touches[1].pageY;

          const distance = Math.sqrt(dx * dx + dy * dy);

          dollyStart.set(0, distance);
        }

        if (scope.enablePan) {
          const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
          const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

          panStart.set(x, y);
        }
      }

      function handleTouchMoveRotate(event) {
        rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);

        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

        const element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height

        rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

        rotateStart.copy(rotateEnd);

        scope.update();
      }

      function handleTouchMoveDollyPan(event) {
        if (scope.enableZoom) {
          const dx = event.touches[0].pageX - event.touches[1].pageX;
          const dy = event.touches[0].pageY - event.touches[1].pageY;

          const distance = Math.sqrt(dx * dx + dy * dy);

          dollyEnd.set(0, distance);

          dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed));

          dollyIn(dollyDelta.y);

          dollyStart.copy(dollyEnd);
        }

        if (scope.enablePan) {
          const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
          const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

          panEnd.set(x, y);

          panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

          pan(panDelta.x, panDelta.y);

          panStart.copy(panEnd);
        }

        scope.update();
      }

      function handleTouchEnd() {}

      //
      // event handlers - FSM: listen for events and reset state
      //
      function onMouseDown(event) {
        if (scope.enabled === false) {
          return;
        }

        event.preventDefault();

        switch (event.button) {
          case scope.mouseButtons.ORBIT:
            if (scope.enableRotate === false) {
              return;
            }

            handleMouseDownRotate(event);

            state = STATE.ROTATE;

            break;
          case scope.mouseButtons.ZOOM:
            if (scope.enableZoom === false) {
              return;
            }

            handleMouseDownDolly(event);

            state = STATE.DOLLY;

            break;
          case scope.mouseButtons.PAN:
            if (scope.enablePan === false) {
              return;
            }

            handleMouseDownPan(event);

            state = STATE.PAN;

            break;
        }

        if (state !== STATE.NONE) {
          document.addEventListener('mousemove', onMouseMove, false);
          document.addEventListener('mouseup', onMouseUp, false);

          scope.dispatchEvent(startEvent);
        }
      }

      function onMouseMove(event) {
        if (scope.enabled === false) {
          return;
        }

        event.preventDefault();

        switch (state) {
          case STATE.ROTATE:
            if (scope.enableRotate === false) {
              return;
            }

            handleMouseMoveRotate(event);

            break;
          case STATE.DOLLY:
            if (scope.enableZoom === false) {
              return;
            }

            handleMouseMoveDolly(event);

            break;
          case STATE.PAN:
            if (scope.enablePan === false) {
              return;
            }

            handleMouseMovePan(event);

            break;
        }
      }

      function onMouseUp(event) {
        if (scope.enabled === false) {
          return;
        }

        handleMouseUp(event);

        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mouseup', onMouseUp, false);

        scope.dispatchEvent(endEvent);

        state = STATE.NONE;
      }

      function onMouseWheel(event) {
        if (scope.enabled === false || scope.enableZoom === false || (state !== STATE.NONE && state !== STATE.ROTATE)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        scope.dispatchEvent(startEvent);

        handleMouseWheel(event);

        scope.dispatchEvent(endEvent);
      }

      function onKeyDown(event) {
        if (scope.enabled === false || scope.enableKeys === false || scope.enablePan === false) {
          return;
        }

        handleKeyDown(event);
      }

      function onTouchStart(event) {
        if (scope.enabled === false) {
          return;
        }

        event.preventDefault();

        switch (event.touches.length) {
          case 1: // one-fingered touch: rotate
            if (scope.enableRotate === false) {
              return;
            }

            handleTouchStartRotate(event);

            state = STATE.TOUCH_ROTATE;

            break;
          case 2: // two-fingered touch: dolly-pan
            if (scope.enableZoom === false && scope.enablePan === false) {
              return;
            }

            handleTouchStartDollyPan(event);

            state = STATE.TOUCH_DOLLY_PAN;

            break;
          default:
            state = STATE.NONE;
        }

        if (state !== STATE.NONE) {
          scope.dispatchEvent(startEvent);
        }
      }

      function onTouchMove(event) {
        if (scope.enabled === false) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        switch (event.touches.length) {
          case 1: // one-fingered touch: rotate
            if (scope.enableRotate === false) {
              return;
            }
            if (state !== STATE.TOUCH_ROTATE) {
              return;
            } // is this needed?

            handleTouchMoveRotate(event);

            break;
          case 2: // two-fingered touch: dolly-pan
            if (scope.enableZoom === false && scope.enablePan === false) {
              return;
            }
            if (state !== STATE.TOUCH_DOLLY_PAN) {
              return;
            } // is this needed?

            handleTouchMoveDollyPan(event);

            break;
          default:
            state = STATE.NONE;
        }
      }

      function onTouchEnd(event) {
        if (scope.enabled === false) {
          return;
        }

        handleTouchEnd(event);

        scope.dispatchEvent(endEvent);

        state = STATE.NONE;
      }

      function onContextMenu(event) {
        if (scope.enabled === false) {
          return;
        }

        event.preventDefault();
      }

      scope.domElement.addEventListener('contextmenu', onContextMenu, false);

      scope.domElement.addEventListener('mousedown', onMouseDown, false);
      scope.domElement.addEventListener('wheel', onMouseWheel, false);

      scope.domElement.addEventListener('touchstart', onTouchStart, false);
      scope.domElement.addEventListener('touchend', onTouchEnd, false);
      scope.domElement.addEventListener('touchmove', onTouchMove, false);

      window.addEventListener('keydown', onKeyDown, false);

      // force an update at start
      this.update();
    };

    THREE.OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
    THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

    // This set of controls performs orbiting, dollying (zooming), and panning.
    // Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
    // This is very similar to OrbitControls, another set of touch behavior
    //
    //    Orbit - right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate
    //    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
    //    Pan - left mouse, or arrow keys / touch: one-finger move

    // eslint-disable-next-line no-import-assign
    THREE.MapControls = function (object, domElement) {
      THREE.OrbitControls.call(this, object, domElement);

      this.mouseButtons.LEFT = THREE.MOUSE.PAN;
      this.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;

      this.touches.ONE = THREE.TOUCH.PAN;
      this.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    };

    THREE.MapControls.prototype = Object.create(THREE.EventDispatcher.prototype);
    THREE.MapControls.prototype.constructor = THREE.MapControls;
  }
}

export default OrbitOrientationControls;
