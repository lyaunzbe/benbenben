import * as THREE from 'three';
import fit from 'canvas-fit';
import * as shaders from './shaders.js';
import RenderBuffer from './RenderBuffer.js';

export default class AlbumVisual {

  /**
   * constructor - Constructor for AlbumViewer
   *
   * @param  {Array<String>} trackImagePaths Path to image for each song
   */
  constructor(trackImagePaths, container) {
    this.container = container;
    this.loadImages(trackImagePaths);
  }

  loadImages(trackImagePaths) {
    this.images = [];
    let loader = new THREE.TextureLoader();
    for (let imagePath of trackImagePaths) {
      let image = loader.load(imagePath);
      this.images.push(image);
    }
  }

  sceneSetup() {
    this.scene = new THREE.Scene();
    this.renderSize = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);

    this.camera = new THREE.OrthographicCamera( this.renderSize.x / - 2, this.renderSize.x / 2, this.renderSize.y / 2, this.renderSize.y / - 2, 1, 1000 );
    this.camera.position.z = 2;

    this.renderer = new THREE.WebGLRenderer({
      preserveDrawingBuffer: true,
      antialias: true,
      alpha: true
    });

    this.renderer.setSize(this.renderSize.x, this.renderSize.y);
    this.container.appendChild(this.renderer.domElement);

    this.frame = 0;
    this.started = false;
  }

  /**
   * setupTextures - Initiate all the textures for the viewer here.
   * For reuse we could treat AlbumView like an abstract class and have
   * child classes override this method.
   */
  setupBuffers() {
    this.buffers = [];

    let imageTexture = this.images[0];

    let mainPass = new RenderBuffer(
      this.renderer,
      shaders.main,
      null,
      { iChannel1: { type: 't', value: imageTexture } },
      this.renderSize,
      this.camera,
      true
    );

    let gaussianPassHorizontal = new RenderBuffer(
      this.renderer,
      shaders.gaussianHorizontal,
      null,
      { iChannel0: { type: 't', value: mainPass.getTexture() } },
      this.renderSize,
      this.camera
    );

    let gaussianPassVertical = new RenderBuffer(
      this.renderer,
      shaders.gaussianVertical,
      null,
      { iChannel0: { type: 't', value: gaussianPassHorizontal.getTexture() } },
      this.renderSize,
      this.camera
    );

    this.finalPass = new RenderBuffer(
      this.renderer,
      shaders.final,
      null,
      {
        iChannel0: { type: 't', value: gaussianPassVertical.getTexture() },
        iChannel1: { type: 't', value: imageTexture }
      },
      this.renderSize,
      this.camera,
      false, // isFeedback
      true // renderToScreen
    );

    this.buffers.push(...[
      mainPass,
      gaussianPassHorizontal,
      gaussianPassVertical,
      this.finalPass
    ]);
  }

  updateMouse(mouse) {
    for (let buffer of this.buffers) {
      buffer.updateUniforms({
        iMouse: { type: 'v3', value: mouse }
      });
    }
  }

  updateRenderSize(resolution) {
    fit(this.renderer.domElement, this.container);
    this.renderSize = resolution;
    this.renderer.setSize(this.renderSize.x, this.renderSize.y);

    this.camera.aspect = this.renderSize.x / this.renderSize.y;
    this.camera.updateProjectionMatrix();

    this.finalPass.updateResolution(resolution);
  }

  updateTimeAndFrame() {
    if (this.started) this.frame += 1;
    let time = window.performance.now() / 1000;

    for (let buffer of this.buffers) {
      buffer.updateUniforms({
        iFrame: { type: 'i', value: this.frame },
        iGlobalTime: { type: 'f', value: time }
      });
    }
  }

  onTrackChanged(trackIndex) {
    this.started = true;
    this.frame = 0;
    for (let buffer of this.buffers) {
      buffer.updateUniforms({
        iChannel1: { type: 't', value: this.images[trackIndex] },
        iFrame: { type: 'i', value: this.frame }
      });
    }
  }

  update () {
    // Schedule the next frame.
    requestAnimationFrame(() => { this.update() });

    for (let buffer of this.buffers) {
      buffer.render();
    }

    this.updateTimeAndFrame();
  }
}
