import { UICorePlugin, Events, Browser, template } from '@clappr/core'
import * as THREE from 'three'
import WebVRPolyfill from 'webvr-polyfill'
import * as utils from './utils'
import OrbitOrientationControls from './orbit-oriention-controls'
import pluginHtml from './public/button.ejs'
import './public/style.scss'
import cardBoard from '../../icons/old/cardboard.svg'

import { isFullscreen } from '../../utils/utils'
import LogManager from '../../utils/LogManager'
import { VRControls } from './VRControls'
import { VREffect } from './VREffect'

export default class Video360 extends UICorePlugin {
  get name() {
    return 'video_360'
  }

  get supportedVersion() {
    return { min: process.env.CLAPPR_VERSION }
  }

  get mediaControl() {
    return this.core.mediaControl
  }

  get attributes() {
    return {
      class: this.name,
      'data-vr': '',
    }
  }

  get events() {
    return {
      'click [data-vr-button]': 'onVRChanged',
    }
  }

  constructor(...args) {
    super(...args)
    // custom videojs-errors integration boolean

    // IE 11 does not support enough webgl to be supported
    // older safari does not support cors, so it wont work
    if (Browser.isIE || Browser.isIE || !utils.corsSupport) {
      console.error("There isn't vr")
      this.destroy()

      return
    }

    this.active_ = false

    this.polyfill_ = new WebVRPolyfill()

    this.handleResize = this.handleResize.bind(this)
    this.handleVrDisplayActivate_ = this.handleVrDisplayActivate_.bind(this)
    this.handleVrDisplayDeactivate_ = this.handleVrDisplayDeactivate_.bind(this)
    this.handleVrDisplayPresentChange_ =
      this.handleVrDisplayPresentChange_.bind(this)
    this.animate_ = this.animate_.bind(this)
  }

  handleResize() {
    if (!this.container) {
      return
    }
    const width = this.container.$el.width()
    const height = this.container.$el.height()

    this.effect && this.effect.setSize(width, height, false)
    if (this.camera) {
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
    this.checkFullscreen()
  }

  animate_() {
    if (!this.initialized_) {
      return
    }
    try {
      if (
        !this.activated &&
        this.getVideoEl_() &&
        this.getVideoEl_().readyState === 4
      ) {
        this.activated = true

        return
      }
      if (
        this.getVideoEl_() &&
        this.getVideoEl_().readyState === this.getVideoEl_().HAVE_ENOUGH_DATA
      ) {
        if (this.videoTexture) {
          this.videoTexture.needsUpdate = true
        }
      }
    } catch (error) {
      LogManager.exception(error)
    }

    if (this.controls3d) {
      this.controls3d.update()
    }

    this.effect.render(this.scene, this.camera)

    if (window.navigator.getGamepads) {
      // Grab all gamepads
      const gamepads = window.navigator.getGamepads()

      for (let i = 0; i < gamepads.length; ++i) {
        const gamepad = gamepads[i]

        // Make sure gamepad is defined
        // Only take input if state has changed since we checked last
        if (
          !gamepad ||
          !gamepad.timestamp ||
          gamepad.timestamp === this.prevTimestamps_[i]
        ) {
          continue
        }
        for (let j = 0; j < gamepad.buttons.length; ++j) {
          if (gamepad.buttons[j].pressed) {
            this.prevTimestamps_[i] = gamepad.timestamp
            break
          }
        }
      }
    }
  }

  bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, this.onCoreReady)

    if (this.core.mediaControl) {
      this.listenTo(
        this.core.mediaControl,
        Events.MEDIACONTROL_RENDERED,
        this.render,
      )
      this.listenTo(
        this.core.mediaControl,
        Events.MEDIACONTROL_CONTAINERCHANGED,
        this.containerChanged.bind(this),
      )
    }

    this.listenTo(this.core, 'core:advertisement:start', this.onStartAd)
    this.listenTo(this.core, 'core:advertisement:finish', this.onFinishAd)
    this.listenTo(this.core, Events.CORE_RESIZE, this.handleResize)
  }

  bindContainerEvents() {
    if (this.container) {
      this.listenTo(this.container, 'container:destroyed', this.destroy)
      this.listenTo(this.container, Events.CONTAINER_LOADEDMETADATA, () => {
        this.loadMetadata = true
      })
      this.listenTo(this.container, Events.CONTAINER_LOADEDMETADATA, this.init)
      this.listenTo(this.container, Events.CONTAINER_STOP, () => {
        this.loadMetadata = false
      })
      this.listenTo(this.container, Events.CONTAINER_STOP, this.reset)
      this.listenTo(
        this.container,
        Events.CONTAINER_FULLSCREEN,
        this.onFullscreenChange,
      )
    }
  }

  unbindContainerEvents() {
    if (this.container) {
      this.stopListening(this.container, 'container:destroyed')
      this.stopListening(this.container, Events.CONTAINER_LOADEDMETADATA)
      this.stopListening(this.container, Events.CONTAINER_STOP)
      this.stopListening(this.container, Events.CONTAINER_FULLSCREEN)
    }
  }

  onCoreReady() {
    const element = this.findElementBySource(this.options.source)

    if (!this.options.video360) {
      this.options.video360 = {}
    }
    this.options.video360.projection = element.projection
    this.container = this.core.activeContainer
    if (
      window.DeviceOrientationEvent &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      if (this.container && this.container.$el) {
        this.container.$el.click(() => {
          DeviceOrientationEvent.requestPermission()
            .then(() => {})
            .catch((error) => {
              LogManager.exception(error)
            })
        })
      }
    }
  }

  containerChanged() {
    this.container = this.core.activeContainer
    const element = this.findElementBySource(this.options.source)

    if (
      Object.prototype.hasOwnProperty.call(element, 'projection') &&
      element.projection &&
      this.container &&
      this.container.el
    ) {
      this.container.el.style.touchAction = 'none'
      this.container.el.addEventListener(
        'touchmove',
        function (event) {
          event.preventDefault()
        },
        false,
      )
      this.container.playback.el.setAttribute('crossorigin', 'anonymous')
      this.unbindContainerEvents()
      this.bindContainerEvents()
      this.render()
    } else {
      this.listenToOnce(
        this.container,
        Events.CONTAINER_LOADEDMETADATA,
        this.reset,
      )
    }
  }

  findElementBySource(source) {
    return this.options.multisources.find((element) => {
      if (element.source === source) {
        return element
      }

      return false
    })
  }

  onVRChanged() {
    this.vrSwitch()
  }

  vrSwitch() {
    if (this.shouldRender()) {
      this.active_ = !this.active_
      if (this.active_) {
        // This starts playback mode when the cardboard button
        // is clicked on Andriod. We need to do this as the controls
        // disappear
        if (
          this.container &&
          !this.container.playback.isPlaying() &&
          Browser.isAndroid
        ) {
          this.container.play()
        }
        window.dispatchEvent(new window.Event('vrdisplayactivate'))
      } else {
        window.dispatchEvent(new window.Event('vrdisplaydeactivate'))
      }
    }
  }

  onFullscreenChange() {
    this.checkFullscreen()
  }

  checkFullscreen() {
    if (this.container && this.container.el) {
      const fs = isFullscreen(this.container.el)

      if (Browser.isAndroid && fs) {
        this.$el.hide()
      } else {
        this.$el.show()
      }
    }
  }

  init() {
    if (this.initialized_) {
      return
    }
    if (this.advertisement) {
      return
    }
    this.reset()

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.$el.width() / this.container.$el.height(),
      1,
      1100,
    )
    // Store vector representing the direction in which the camera is looking, in world space.
    this.cameraVector = new THREE.Vector3()

    if (
      this.options.video360.projection === '360_LR' ||
      this.options.video360.projection === '360_TB' ||
      this.options.video360.projection === '180' ||
      this.options.video360.projection === 'EAC_LR'
    ) {
      // Render left eye when not in VR mode
      this.camera.layers.enable(1)
    }

    this.scene = new THREE.Scene()
    this.videoTexture = new THREE.VideoTexture(this.getVideoEl_())

    // shared regardless of wether THREE.VideoTexture is used or
    // an image canvas is used
    this.videoTexture.generateMipmaps = false
    this.videoTexture.minFilter = THREE.LinearFilter
    this.videoTexture.magFilter = THREE.LinearFilter
    this.videoTexture.format = THREE.RGBFormat

    this.changeProjection_(this.options.video360.projection)

    if (this.options.video360.projection === 'NONE') {
      console.warn('Projection is NONE, dont init')
      this.reset()

      return
    }

    this.camera.position.set(0, 0, 0)
    this.renderer = new THREE.WebGLRenderer({
      devicePixelRatio: window.devicePixelRatio,
      alpha: false,
      clearColor: 0xffffff,
      antialias: true,
    })

    this.renderer.setAnimationLoop(this.animate_)

    const webglContext = this.renderer.getContext('webgl')
    const oldTexImage2D = webglContext.texImage2D

    /* this is a workaround since threejs uses try catch */
    webglContext.texImage2D = (...args) => {
      try {
        return oldTexImage2D.apply(webglContext, args)
      } catch (error) {
        LogManager.exception(error)
        this.reset()
        this.container.pause()

        throw new Error(error)
      }
    }

    this.renderer.setSize(
      this.container.$el.width(),
      this.container.$el.height(),
      false,
    )
    this.effect = new VREffect(this.renderer)

    this.effect.setSize(
      this.container.$el.width(),
      this.container.$el.height(),
      false,
    )

    // Previous timestamps for gamepad updates
    this.prevTimestamps_ = []
    this.renderedCanvas = this.renderer.domElement
    this.renderedCanvas.setAttribute(
      'style',
      'width:100%;height:100%;position:absolute;top:0;left:0;z-index:3;',
    )

    // TODO: fix that hack
    if (Browser.isiOS) {
      this.renderedCanvas.style.pointerEvents = 'none'
    }

    const videoElStyle = this.getVideoEl_().style

    this.container.el.appendChild(this.renderedCanvas)
    videoElStyle.zIndex = '-1'
    videoElStyle.opacity = '0'

    if (window.navigator.getVRDisplays) {
      this.getVRDisplays((device) => {
        if (device) {
          this.vrDisplay = device
          if (window.self !== window.top) {
            this.vrDisplay.poseSensor_.useDeviceMotion()
          }
          if (!device.isPolyfilled) {
            this.controls3d = new VRControls(this.camera)
          } else {
            const options = {
              camera: this.camera,
              canvas: this.renderedCanvas,
              // check if its a half sphere view projection
              halfView: this.options.video360.projection === '180',
              orientation: Browser.isiOS || Browser.isAndroid || false,
            }

            this.controls3d = new OrbitOrientationControls(options)
          }
        } else {
          const options = {
            camera: this.camera,
            canvas: this.renderedCanvas,
            // check if its a half sphere view projection
            halfView: this.options.video360.projection === '180',
            orientation: Browser.isiOS || Browser.isAndroid || false,
          }

          this.controls3d = new OrbitOrientationControls(options)
        }
      })
    } else if (window.navigator.getVRDevices) {
      console.error("There isn't vr")
    } else {
      console.error("There isn't vr")
    }

    window.addEventListener('vrdisplaypresentchange', this.handleResize, true)
    window.addEventListener(
      'vrdisplayactivate',
      this.handleVrDisplayActivate_,
      true,
    )
    window.addEventListener(
      'vrdisplaydeactivate',
      this.handleVrDisplayDeactivate_,
      true,
    )
    window.addEventListener(
      'vrdisplaypresentchange',
      this.handleVrDisplayPresentChange_,
      true,
    )

    this.initialized_ = true
  }

  getVRDisplays(onDisplay) {
    if ('getVRDisplays' in navigator) {
      navigator.getVRDisplays().then(function (displays) {
        onDisplay(displays[0])
      })
    }
  }

  getVideoEl_() {
    return this.container.$el.find('video')[0]
  }

  reset() {
    if (this.controls3d) {
      this.controls3d.dispose()
      this.controls3d = null
    }

    // reset the ios touch to click workaround
    if (this.iosRevertTouchToClick_) {
      this.iosRevertTouchToClick_()
    }

    if (this.effect) {
      this.effect.dispose()
      this.effect = null
    }

    if (this.movieGeometry) {
      this.movieGeometry.dispose()
    }
    if (this.movieMaterial) {
      this.movieMaterial.dispose()
    }

    if (this.videoTexture) {
      this.videoTexture.dispose()
    }

    window.removeEventListener('resize', this.handleResize, true)
    window.removeEventListener(
      'vrdisplaypresentchange',
      this.handleResize,
      true,
    )
    window.removeEventListener(
      'vrdisplaypresentchange',
      this.handleResize,
      true,
    )
    window.removeEventListener(
      'vrdisplayactivate',
      this.handleVrDisplayPresentChange_,
      true,
    )
    window.removeEventListener(
      'vrdisplaydeactivate',
      this.handleVrDisplayDeactivate_,
      true,
    )

    // reset the video element style so that it will be displayed
    if (this.getVideoEl_()) {
      const videoElStyle = this.getVideoEl_().style

      videoElStyle.zIndex = ''
      videoElStyle.opacity = ''
    }

    // reset the ios touch to click workaround
    if (this.iosRevertTouchToClick_) {
      this.iosRevertTouchToClick_()
    }

    if (this.renderer) {
      this.renderer.setAnimationLoop(null)
      this.renderer = null
    }

    // remove the old canvas
    if (this.renderedCanvas && this.container && this.container.el) {
      try {
        this.container.el.removeChild(this.renderedCanvas)
        this.renderedCanvas = null
      } catch (error) {
        LogManager.exception(error)
      }
    }
    this.initialized_ = false
  }

  handleVrDisplayPresentChange_() {
    if (this.vrDisplay) {
      if (!this.vrDisplay.isPresenting && this.active_) {
        this.handleVrDisplayDeactivate_()
      }
      if (this.vrDisplay.isPresenting && !this.active_) {
        this.handleVrDisplayActivate_()
      }
    }
  }

  handleVrDisplayDeactivate_() {
    if (!this.vrDisplay) {
      return
    }
    this.active_ = false
    if (this.iosRevertTouchToClick_) {
      this.iosRevertTouchToClick_()
    }

    setTimeout(() => {
      this.vrDisplay
        .exitPresent()
        .then(() => {})
        .catch((error) => {
          LogManager.exception(error)
        })
    }, 0)
  }

  handleVrDisplayActivate_() {
    if (!this.vrDisplay) {
      return
    }
    this.vrDisplay
      .requestPresent([{ source: this.renderedCanvas }])
      .then(() => {
        if (!this.vrDisplay.cardboardUI_ || !Browser.isiOS) {
          return
        }
        this.container.play()
        // webvr-polyfill/cardboard ui only watches for click events
        // to tell that the back arrow button is pressed during cardboard vr.
        // but somewhere along the line these events are silenced with preventDefault
        // but only on iOS, so we translate them ourselves here
        let touches = []
        const iosCardboardTouchStart_ = (e) => {
          for (let i = 0; i < e.touches.length; i++) {
            touches.push(e.touches[i])
          }
        }

        const iosCardboardTouchEnd_ = () => {
          if (!touches.length) {
            return
          }

          touches.forEach((t) => {
            const simulatedClick = new window.MouseEvent('click', {
              screenX: t.screenX,
              screenY: t.screenY,
              clientX: t.clientX,
              clientY: t.clientY,
            })

            this.renderedCanvas.dispatchEvent(simulatedClick)
          })

          touches = []
        }

        this.renderedCanvas.addEventListener(
          'touchstart',
          iosCardboardTouchStart_,
        )
        this.renderedCanvas.addEventListener('touchend', iosCardboardTouchEnd_)

        this.iosRevertTouchToClick_ = () => {
          this.renderedCanvas.removeEventListener(
            'touchstart',
            iosCardboardTouchStart_,
          )
          this.renderedCanvas.removeEventListener(
            'touchend',
            iosCardboardTouchEnd_,
          )
          this.iosRevertTouchToClick_ = null
        }
      })
  }

  changeProjection_(projection) {
    // don't change to an invalid projection
    if (!projection) {
      console.error('none projection')

      return
    }
    const position = { x: 0, y: 0, z: 0 }

    if (this.scene) {
      this.scene.remove(this.movieScreen)
    }
    if (projection === 'AUTO') {
      // mediainfo cannot be set to auto or we would infinite loop here
      // each source should know wether they are 360 or not, if using AUTO
      return this.changeProjection_('NONE')
    } else if (projection === '360') {
      this.movieGeometry = new THREE.SphereBufferGeometry(256, 32, 32)
      this.movieMaterial = new THREE.MeshBasicMaterial({
        map: this.videoTexture,
        side: THREE.BackSide,
      })

      this.movieScreen = new THREE.Mesh(this.movieGeometry, this.movieMaterial)
      this.movieScreen.position.set(position.x, position.y, position.z)

      this.movieScreen.scale.x = -1
      this.movieScreen.quaternion.setFromAxisAngle(
        { x: 0, y: 1, z: 0 },
        -Math.PI / 2,
      )
      this.scene.add(this.movieScreen)
    } else if (projection === '360_LR' || projection === '360_TB') {
      // Left eye view
      let geometry = new THREE.SphereGeometry(256, 32, 32)

      let uvs = geometry.faceVertexUvs[0]

      for (let i = 0; i < uvs.length; i++) {
        for (let j = 0; j < 3; j++) {
          if (projection === '360_LR') {
            uvs[i][j].x *= 0.5
          } else {
            uvs[i][j].y *= 0.5
            uvs[i][j].y += 0.5
          }
        }
      }

      this.movieGeometry = new THREE.BufferGeometry().fromGeometry(geometry)
      this.movieMaterial = new THREE.MeshBasicMaterial({
        map: this.videoTexture,
        side: THREE.BackSide,
      })

      this.movieScreen = new THREE.Mesh(this.movieGeometry, this.movieMaterial)
      this.movieScreen.scale.x = -1
      this.movieScreen.quaternion.setFromAxisAngle(
        { x: 0, y: 1, z: 0 },
        -Math.PI / 2,
      )
      // display in left eye only
      this.movieScreen.layers.set(1)
      this.scene.add(this.movieScreen)

      // Right eye view
      geometry = new THREE.SphereGeometry(256, 32, 32)

      uvs = geometry.faceVertexUvs[0]

      for (let i = 0; i < uvs.length; i++) {
        for (let j = 0; j < 3; j++) {
          if (projection === '360_LR') {
            uvs[i][j].x *= 0.5
            uvs[i][j].x += 0.5
          } else {
            uvs[i][j].y *= 0.5
          }
        }
      }

      this.movieGeometry = new THREE.BufferGeometry().fromGeometry(geometry)
      this.movieMaterial = new THREE.MeshBasicMaterial({
        map: this.videoTexture,
        side: THREE.BackSide,
      })

      this.movieScreen = new THREE.Mesh(this.movieGeometry, this.movieMaterial)
      this.movieScreen.scale.x = -1
      this.movieScreen.quaternion.setFromAxisAngle(
        { x: 0, y: 1, z: 0 },
        -Math.PI / 2,
      )
      // display in right eye only
      this.movieScreen.layers.set(2)
      this.scene.add(this.movieScreen)
    } else if (projection === '360_CUBE') {
      this.movieGeometry = new THREE.BoxGeometry(256, 256, 256)
      this.movieMaterial = new THREE.MeshBasicMaterial({
        map: this.videoTexture,
        side: THREE.BackSide,
      })

      const left = [
        new THREE.Vector2(0, 0.5),
        new THREE.Vector2(0.333, 0.5),
        new THREE.Vector2(0.333, 1),
        new THREE.Vector2(0, 1),
      ]
      const right = [
        new THREE.Vector2(0.333, 0.5),
        new THREE.Vector2(0.666, 0.5),
        new THREE.Vector2(0.666, 1),
        new THREE.Vector2(0.333, 1),
      ]
      const top = [
        new THREE.Vector2(0.666, 0.5),
        new THREE.Vector2(1, 0.5),
        new THREE.Vector2(1, 1),
        new THREE.Vector2(0.666, 1),
      ]
      const bottom = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.333, 0),
        new THREE.Vector2(0.333, 0.5),
        new THREE.Vector2(0, 0.5),
      ]
      const front = [
        new THREE.Vector2(0.333, 0),
        new THREE.Vector2(0.666, 0),
        new THREE.Vector2(0.666, 0.5),
        new THREE.Vector2(0.333, 0.5),
      ]
      const back = [
        new THREE.Vector2(0.666, 0),
        new THREE.Vector2(1, 0),
        new THREE.Vector2(1, 0.5),
        new THREE.Vector2(0.666, 0.5),
      ]

      this.movieGeometry.faceVertexUvs[0] = []

      this.movieGeometry.faceVertexUvs[0][0] = [right[2], right[1], right[3]]
      this.movieGeometry.faceVertexUvs[0][1] = [right[1], right[0], right[3]]

      this.movieGeometry.faceVertexUvs[0][2] = [left[2], left[1], left[3]]
      this.movieGeometry.faceVertexUvs[0][3] = [left[1], left[0], left[3]]

      this.movieGeometry.faceVertexUvs[0][4] = [top[2], top[1], top[3]]
      this.movieGeometry.faceVertexUvs[0][5] = [top[1], top[0], top[3]]

      this.movieGeometry.faceVertexUvs[0][6] = [bottom[2], bottom[1], bottom[3]]
      this.movieGeometry.faceVertexUvs[0][7] = [bottom[1], bottom[0], bottom[3]]

      this.movieGeometry.faceVertexUvs[0][8] = [front[2], front[1], front[3]]
      this.movieGeometry.faceVertexUvs[0][9] = [front[1], front[0], front[3]]

      this.movieGeometry.faceVertexUvs[0][10] = [back[2], back[1], back[3]]
      this.movieGeometry.faceVertexUvs[0][11] = [back[1], back[0], back[3]]

      this.movieScreen = new THREE.Mesh(this.movieGeometry, this.movieMaterial)
      this.movieScreen.position.set(position.x, position.y, position.z)
      this.movieScreen.rotation.y = -Math.PI

      this.scene.add(this.movieScreen)
    } else if (projection === '180') {
      let geometry = new THREE.SphereGeometry(256, 32, 32, Math.PI, Math.PI)

      // Left eye view
      geometry.scale(-1, 1, 1)
      let uvs = geometry.faceVertexUvs[0]

      for (let i = 0; i < uvs.length; i++) {
        for (let j = 0; j < 3; j++) {
          uvs[i][j].x *= 0.5
        }
      }

      this.movieGeometry = new THREE.BufferGeometry().fromGeometry(geometry)
      this.movieMaterial = new THREE.MeshBasicMaterial({
        map: this.videoTexture,
      })
      this.movieScreen = new THREE.Mesh(this.movieGeometry, this.movieMaterial)
      // display in left eye only
      this.movieScreen.layers.set(1)
      this.scene.add(this.movieScreen)

      // Right eye view
      geometry = new THREE.SphereGeometry(256, 32, 32, Math.PI, Math.PI)
      geometry.scale(-1, 1, 1)
      uvs = geometry.faceVertexUvs[0]

      for (let i = 0; i < uvs.length; i++) {
        for (let j = 0; j < 3; j++) {
          uvs[i][j].x *= 0.5
          uvs[i][j].x += 0.5
        }
      }

      this.movieGeometry = new THREE.BufferGeometry().fromGeometry(geometry)
      this.movieMaterial = new THREE.MeshBasicMaterial({
        map: this.videoTexture,
      })
      this.movieScreen = new THREE.Mesh(this.movieGeometry, this.movieMaterial)
      // display in right eye only
      this.movieScreen.layers.set(2)
      this.scene.add(this.movieScreen)
    } else if (projection === 'EAC' || projection === 'EAC_LR') {
      const makeScreen = (mapMatrix, scaleMatrix) => {
        // "Continuity correction?": because of discontinuous faces and aliasing,
        // we truncate the 2-pixel-wide strips on all discontinuous edges,
        const contCorrect = 2

        this.movieGeometry = new THREE.BoxGeometry(256, 256, 256)
        this.movieMaterial = new THREE.ShaderMaterial({
          side: THREE.BackSide,
          uniforms: {
            mapped: {
              value: this.videoTexture,
            },
            mapMatrix: {
              value: mapMatrix,
            },
            contCorrect: {
              value: contCorrect,
            },
            faceWH: {
              value: new THREE.Vector2(1 / 3, 1 / 2).applyMatrix3(scaleMatrix),
            },
            vidWH: {
              value: new THREE.Vector2(
                this.videoTexture.image.videoWidth,
                this.videoTexture.image.videoHeight,
              ).applyMatrix3(scaleMatrix),
            },
          },
          vertexShader: `
            varying vec2 vUv;
            uniform mat3 mapMatrix;

            void main() {
              vUv = (mapMatrix * vec3(uv, 1.)).xy;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
            }`,
          fragmentShader: `
            varying vec2 vUv;
            uniform sampler2D mapped;
            uniform vec2 faceWH;
            uniform vec2 vidWH;
            uniform float contCorrect;

            const float PI = 3.1415926535897932384626433832795;

            void main() {
              vec2 corner = vUv - mod(vUv, faceWH) + vec2(0, contCorrect / vidWH.y);

              vec2 faceWHadj = faceWH - vec2(0, contCorrect * 2. / vidWH.y);

              vec2 p = (vUv - corner) / faceWHadj - .5;
              vec2 q = 2. / PI * atan(2. * p) + .5;

              vec2 eUv = corner + q * faceWHadj;

              gl_FragColor = texture2D(mapped, eUv);
            }`,
        })

        const right = [
          new THREE.Vector2(0, 1 / 2),
          new THREE.Vector2(1 / 3, 1 / 2),
          new THREE.Vector2(1 / 3, 1),
          new THREE.Vector2(0, 1),
        ]
        const front = [
          new THREE.Vector2(1 / 3, 1 / 2),
          new THREE.Vector2(2 / 3, 1 / 2),
          new THREE.Vector2(2 / 3, 1),
          new THREE.Vector2(1 / 3, 1),
        ]
        const left = [
          new THREE.Vector2(2 / 3, 1 / 2),
          new THREE.Vector2(1, 1 / 2),
          new THREE.Vector2(1, 1),
          new THREE.Vector2(2 / 3, 1),
        ]
        const bottom = [
          new THREE.Vector2(1 / 3, 0),
          new THREE.Vector2(1 / 3, 1 / 2),
          new THREE.Vector2(0, 1 / 2),
          new THREE.Vector2(0, 0),
        ]
        const back = [
          new THREE.Vector2(1 / 3, 1 / 2),
          new THREE.Vector2(1 / 3, 0),
          new THREE.Vector2(2 / 3, 0),
          new THREE.Vector2(2 / 3, 1 / 2),
        ]
        const top = [
          new THREE.Vector2(1, 0),
          new THREE.Vector2(1, 1 / 2),
          new THREE.Vector2(2 / 3, 1 / 2),
          new THREE.Vector2(2 / 3, 0),
        ]

        for (const face of [right, front, left, bottom, back, top]) {
          const height = this.videoTexture.image.videoHeight
          let lowY = 1
          let highY = 0

          for (const vector of face) {
            if (vector.y < lowY) {
              lowY = vector.y
            }
            if (vector.y > highY) {
              highY = vector.y
            }
          }

          for (const vector of face) {
            if (Math.abs(vector.y - lowY) < Number.EPSILON) {
              vector.y += contCorrect / height
            }
            if (Math.abs(vector.y - highY) < Number.EPSILON) {
              vector.y -= contCorrect / height
            }

            vector.x =
              (vector.x / height) * (height - contCorrect * 2) +
              contCorrect / height
          }
        }

        this.movieGeometry.faceVertexUvs[0] = []

        this.movieGeometry.faceVertexUvs[0][0] = [right[2], right[1], right[3]]
        this.movieGeometry.faceVertexUvs[0][1] = [right[1], right[0], right[3]]

        this.movieGeometry.faceVertexUvs[0][2] = [left[2], left[1], left[3]]
        this.movieGeometry.faceVertexUvs[0][3] = [left[1], left[0], left[3]]

        this.movieGeometry.faceVertexUvs[0][4] = [top[2], top[1], top[3]]
        this.movieGeometry.faceVertexUvs[0][5] = [top[1], top[0], top[3]]

        this.movieGeometry.faceVertexUvs[0][6] = [
          bottom[2],
          bottom[1],
          bottom[3],
        ]
        this.movieGeometry.faceVertexUvs[0][7] = [
          bottom[1],
          bottom[0],
          bottom[3],
        ]

        this.movieGeometry.faceVertexUvs[0][8] = [front[2], front[1], front[3]]
        this.movieGeometry.faceVertexUvs[0][9] = [front[1], front[0], front[3]]

        this.movieGeometry.faceVertexUvs[0][10] = [back[2], back[1], back[3]]
        this.movieGeometry.faceVertexUvs[0][11] = [back[1], back[0], back[3]]

        this.movieScreen = new THREE.Mesh(
          this.movieGeometry,
          this.movieMaterial,
        )
        this.movieScreen.position.set(position.x, position.y, position.z)
        this.movieScreen.rotation.y = -Math.PI

        return this.movieScreen
      }

      if (projection === 'EAC') {
        this.scene.add(makeScreen(new THREE.Matrix3(), new THREE.Matrix3()))
      } else {
        const scaleMatrix = new THREE.Matrix3().set(0, 0.5, 0, 1, 0, 0, 0, 0, 1)

        makeScreen(
          new THREE.Matrix3().set(0, -0.5, 0.5, 1, 0, 0, 0, 0, 1),
          scaleMatrix,
        )
        // display in left eye only
        this.movieScreen.layers.set(1)
        this.scene.add(this.movieScreen)

        makeScreen(
          new THREE.Matrix3().set(0, -0.5, 1, 1, 0, 0, 0, 0, 1),
          scaleMatrix,
        )
        // display in right eye only
        this.movieScreen.layers.set(2)
        this.scene.add(this.movieScreen)
      }
    }
  }

  destroy() {
    this.reset()
  }

  shouldRender() {
    if (!this.container) {
      return false
    }

    this.currentPlayback = this.core.activePlayback
    if (
      this.currentPlayback &&
      this.currentPlayback.tagName !== 'video' &&
      this.currentPlayback.tagName !== 'audio'
    ) {
      //console.warn('PlaybackRatePlugin#shouldRender: Cannot affect rate for playback', currentPlayback);
      return false
    }

    try {
      const { video360 } = this.options

      if (
        !video360 ||
        !video360.projection ||
        (!video360.forceCardboard && !Browser.isiOS && !Browser.isAndroid)
      ) {
        return false
      }
    } catch (error) {
      LogManager.exception(error)

      return false
    }

    return true
  }

  render() {
    //console.log('PlaybackRatePlugin#render()');
    if (this.shouldRender()) {
      const t = template(pluginHtml)
      const html = t()

      this.$el.html(html)

      if (
        Object.prototype.hasOwnProperty.call(
          this.core.mediaControl,
          '$vrButton',
        ) &&
        this.core.mediaControl.$vrButton.length > 0
      ) {
        this.$el.find('.vr-button').append(cardBoard)
        this.core.mediaControl.$vrButton.append(this.$el)
      } else {
        this.core.mediaControl.$('.media-control-right-panel').append(this.el)
      }
    }
  }

  get template() {
    return template(pluginHtml)
  }

  onStartAd() {
    this.advertisement = true
    this.reset()
  }

  onFinishAd() {
    this.advertisement = false
    if (this.loadMetadata) {
      this.init()
    }
  }
}
