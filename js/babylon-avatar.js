// TecSign Avatar: one visible character, cached clips and pose blending.

// Carpeta donde están tus 6 archivos .glb.
// Ajusta esta ruta si los colocas en otro lugar del proyecto.
const AVATAR_MODELS_PATH = './models/';

// Diccionario: palabra (SIN tildes, en MAYÚSCULAS) -> archivo GLB.
// La clave debe coincidir con el texto ya normalizado que usa chat-lsm.js
// (mismo proceso: mayúsculas + sin acentos).
const AVATAR_WORD_MAP = {};
let AVATAR_IDLE_FILE = "PL_Idlestance.glb";
const animationsReady = fetch("./config/animations.json").then(r => { if (!r.ok) throw Error("No se pudo cargar el catálogo de animaciones"); return r.json(); }).then(manifest => {
  AVATAR_IDLE_FILE = manifest.idle.file;
  for (const [gloss, entry] of Object.entries(manifest.animations)) {
    AVATAR_WORD_MAP[gloss] = entry.file;
    for (const alias of entry.aliases || []) AVATAR_WORD_MAP[alias.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] = entry.file;
  }
}).catch(error => console.warn(error));

class AvatarAnimationController {
  constructor(scene) {
    this.scene = scene;
    this.state = 'LOADING';
    this.cache = new Map();
    this.loads = new Map();
    this.queue = [];
    this.current = null;
    this.running = null;
    this.draining = false;
    this.transition = null;
    this.errors = [];
    this.metrics = [];
    this.blendMs = 220;
    this.ready = new Promise(resolve => { this.resolveReady = resolve; });
    scene.onBeforeAnimationsObservable.add(() => this.updateBlend());
    scene.onAfterRenderObservable.add(() => {
      const metric = this.running?.metric;
      if (metric?.startedAt != null && metric.firstRenderedAt == null) metric.firstRenderedAt = performance.now();
    });
  }

  initialize(base, idleFile) {
    this.targets = new Map([...base.transformNodes, ...base.meshes].map(node => [node.name, node]));
    this.allowed = new Set([idleFile, ...Object.values(AVATAR_WORD_MAP)]);
    this.idle = base.animationGroups[0];
    if (!this.idle?.targetedAnimations.length) throw Error('El avatar base no contiene idle');
    // The old player used this same principal clip. Auxiliary export groups stay unused.
    base.animationGroups.slice(1).forEach(group => group.dispose());
    this.idle.metadata = { ...this.idle.metadata, avatarFile: idleFile };
    this.idle.enableBlending = false;
    this.cache.set(idleFile, this.idle);
    this.current = this.idle;
    this.idle.start(true);
    this.state = 'IDLE';
    this.resolveReady(true);
  }

  recordError(file, error) {
    this.errors.push({ file, message: error.message, time: performance.now() });
    if (this.errors.length > 20) this.errors.shift();
    console.warn('TecSignAvatar: ' + file, error);
  }

  async loadClip(file) {
    if (!this.allowed.has(file)) throw Error('Seña no disponible: ' + file);
    if (this.cache.has(file)) return this.cache.get(file);
    if (this.loads.has(file)) return this.loads.get(file);
    const task = (async () => {
      let container;
      try {
        // Off-scene container: its model is never added to the visible scene.
        container = await BABYLON.LoadAssetContainerAsync(AVATAR_MODELS_PATH + encodeURIComponent(file), this.scene, {
          pluginExtension: '.glb', pluginOptions: { gltf: { animationStartMode: 0 } }
        });
        // AssetContainer order differs from ImportMesh's glTF order on some files.
        // Select the same principal clip by name, never an auxiliary end-bone clip.
        const source = container.animationGroups.find(group => group.name === this.idle.name);
        if (!source?.targetedAnimations.length) throw Error('La seña no contiene un clip');
        for (const { target } of source.targetedAnimations) {
          const destination = this.targets.get(target.name);
          if (!destination || destination.parent?.name !== target.parent?.name) throw Error('Hueso incompatible: ' + target.name);
        }
        // Clone once per file, preserving the authored keys and timing.
        const group = source.clone(file, target => this.targets.get(target.name), true);
        group.metadata = { avatarFile: file };
        this.cache.set(file, group);
        return group;
      } finally {
        // Only temporary off-scene assets are freed; the base character is untouched.
        container?.dispose();
      }
    })();
    this.loads.set(file, task);
    try { return await task; } finally { this.loads.delete(file); }
  }

  swap(group, loop, state) {
    this.current?.stop(true); // stop keeps the current pose; never reset/dispose the avatar.
    this.current = group;
    group.enableBlending = true;
    group.blendingSpeed = 0;
    const now = performance.now();
    this.transition = { group, state, startedAt: now, lastUpdate: now };
    this.state = state;
    group.start(loop);
  }

  updateBlend() {
    const blend = this.transition;
    if (!blend) return;
    const now = performance.now();
    // Babylon blends from the pose captured at start. Scale its increment by elapsed
    // time so a slower device still transitions in about 220 ms, not a fixed frame count.
    blend.group.blendingSpeed = Math.min(1, (now - blend.lastUpdate) / this.blendMs);
    blend.lastUpdate = now;
    if (now - blend.startedAt >= this.blendMs) {
      blend.group.blendingSpeed = 1;
      if (this.state === blend.state) this.state = blend.group === this.idle ? 'IDLE' : 'SIGNING';
      this.transition = null;
    }
  }

  toIdle() {
    if (!this.idle) return;
    if (this.current === this.idle && this.idle.isStarted) {
      this.state = this.transition ? 'TRANSITION_OUT' : 'IDLE';
      return;
    }
    this.swap(this.idle, true, 'TRANSITION_OUT');
  }

  enqueue(file, callback) {
    let settle, cancel;
    const promise = new Promise(resolve => { settle = resolve; });
    const cancelled = new Promise(resolve => { cancel = () => resolve(null); });
    const job = { file, callback, settle, cancel, cancelled, wasCancelled: false,
      metric: { file, requestedAt: performance.now() } };
    this.queue.push(job);
    // Start loading queued signs early; a concurrent preload shares this same promise.
    job.clip = this.ready.then(ok => {
      if (!ok || job.wasCancelled) return null;
      job.metric.lookupAt = performance.now();
      job.metric.cacheHit = this.cache.has(file);
      return this.loadClip(file).then(group => { job.metric.preparedAt = performance.now(); return group; });
    }).catch(error => { if (!job.wasCancelled) this.recordError(file, error); return null; });
    this.drain();
    return promise;
  }

  async drain() {
    if (this.draining) return;
    this.draining = true;
    await this.ready;
    try {
      while (this.queue.length) {
        const job = this.running = this.queue.shift();
        if (!this.cache.has(job.file)) { this.toIdle(); this.state = 'LOADING'; }
        const group = await Promise.race([job.clip, job.cancelled]);
        if (group && !job.wasCancelled) {
          await new Promise(resolve => {
            let timer, observer, done = false;
            const finish = (watchdog = false) => {
              if (done) return;
              done = true; clearTimeout(timer); group.onAnimationGroupEndObservable.remove(observer);
              if (watchdog && !job.wasCancelled && group.isStarted) { group.goToFrame(group.to); group.stop(true); }
              job.finish = null; resolve();
            };
            job.finish = finish;
            observer = group.onAnimationGroupEndObservable.add(() => finish());
            this.swap(group, false, 'TRANSITION_IN');
            job.metric.startedAt = performance.now();
            const fps = group.targetedAnimations[0].animation.framePerSecond;
            timer = setTimeout(() => finish(true), (group.to - group.from) / fps * 1000 + 1500);
          });
        }
        const result = { file: job.file, status: job.wasCancelled ? 'cancelled' : group ? 'complete' : 'failed' };
        job.metric.finishedAt = performance.now();
        this.metrics.push({ ...job.metric, status: result.status });
        if (this.metrics.length > 100) this.metrics.shift();
        if (!job.wasCancelled && typeof job.callback === 'function') {
          try { job.callback(result); } catch (error) { this.recordError(job.file, error); }
        }
        job.settle(result); this.running = null;
        // Cached next word goes directly from this final pose into the next clip.
      }
    } finally {
      this.running = null; this.draining = false;
      this.toIdle();
      if (this.queue.length) this.drain();
    }
  }

  forceIdle() {
    for (const job of this.queue.splice(0)) {
      job.wasCancelled = true; job.cancel(); job.settle({ file: job.file, status: 'cancelled' });
    }
    if (this.running) {
      this.running.wasCancelled = true; this.running.cancel(); this.running.finish?.();
    }
    this.toIdle();
  }

  prefetchCommon(files) {
    const pending = [...new Set(files)].filter(file => file && file !== this.idle.metadata.avatarFile);
    const schedule = () => {
      if (!pending.length) return;
      const step = async () => {
        if (this.state !== 'IDLE' || this.draining || document.hidden) { setTimeout(schedule, 500); return; }
        const file = pending.shift();
        try { await this.loadClip(file); } catch (error) { this.recordError(file, error); }
        schedule();
      };
      if (window.requestIdleCallback) requestIdleCallback(step, { timeout: 2000 });
      else setTimeout(step, 250);
    };
    schedule();
  }

  snapshot() {
    return { state: this.state, current: this.current?.metadata.avatarFile, queue: this.queue.map(job => job.file),
      cache: [...this.cache.keys()], loading: [...this.loads.keys()],
      clips: [...this.cache].map(([file, group]) => ({ file, from: group.from, to: group.to,
        fps: group.targetedAnimations[0].animation.framePerSecond, tracks: group.targetedAnimations.length })),
      activeGroups: this.scene.animationGroups.filter(group => group.isStarted).map(group => group.metadata?.avatarFile || group.name),
      errors: this.errors.map(error => ({ ...error })), metrics: this.metrics.map(metric => ({ ...metric })) };
  }
}

const TecSignAvatar = (function () {
  let engine, scene, camera;
  let currentMeshes = [];
  let visualRoot = null;
  let controller, initialization;
  let ready = false;

  function init(canvasId) {
    if (initialization) return initialization;
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('TecSignAvatar: no encontré el canvas #' + canvasId);
      return;
    }

    engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      alpha: true,
      premultipliedAlpha: false
    });
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // fondo transparente, se ve el CSS de atrás
    scene.autoClear = true;

    camera = new BABYLON.ArcRotateCamera(
      'avatarCamera',
      BABYLON.Tools.ToRadians(90),
      BABYLON.Tools.ToRadians(80),
      2.2,
      new BABYLON.Vector3(0, 1, 0),
      scene
    );

    // Cámara casi fija: no se puede arrastrar para rotar, pero SÍ se permite
    // hacer zoom con la rueda del mouse para ver mejor los detalles.
    camera.inputs.clear();
    camera.inputs.addMouseWheel();
    camera.wheelPrecision = 80;
    camera.pinchPrecision = 80; // zoom con dos dedos en pantallas táctiles

    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 1.0;
    hemi.groundColor = new BABYLON.Color3(0.55, 0.55, 0.6);

    const key = new BABYLON.DirectionalLight('key', new BABYLON.Vector3(-0.35, -0.75, -0.35), scene);
    key.position = new BABYLON.Vector3(4, 6, 4);
    key.intensity = 1.05;

    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => resize());

    ready = true;
    controller = new AvatarAnimationController(scene);
    initialization = animationsReady.then(async () => {
      const base = await BABYLON.ImportMeshAsync(AVATAR_MODELS_PATH + encodeURIComponent(AVATAR_IDLE_FILE), scene, {
        pluginExtension: '.glb', pluginOptions: { gltf: { animationStartMode: 0 } }
      });
      currentMeshes = base.meshes;
      visualRoot = new BABYLON.TransformNode('avatarRoot', scene);
      currentMeshes.forEach(mesh => { if (!mesh.parent && mesh.name !== '__root__') mesh.parent = visualRoot; });
      centerCamera();
      controller.initialize(base, AVATAR_IDLE_FILE);
      controller.prefetchCommon(['HOLA', 'ADIOS', 'BUENOS DIAS', 'BUENAS TARDES', 'BUENAS NOCHES'].map(word => AVATAR_WORD_MAP[word]));
      return true;
    }).catch(error => { ready = false; controller.recordError(AVATAR_IDLE_FILE, error); controller.resolveReady(false); return false; });
    return initialization;
  }

  // ── Qué tanto del cuerpo se recorta desde abajo ──
  // 0 = se ve el cuerpo completo (pies incluidos)
  // 0.45 = se recorta aprox. desde la cadera hacia arriba (recomendado para señas)
  // Ajusta este número si quieres ver más o menos cuerpo.
  const AVATAR_FRAME_HIP_RATIO = 0.45;

  function centerCamera() {
    const meshes = currentMeshes.filter(m =>
      m && m.getTotalVertices && m.getTotalVertices() > 0 && m.isVisible
    );
    if (!meshes.length) return;

    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    meshes.forEach(mesh => {
      mesh.computeWorldMatrix(true);
      const info = mesh.getBoundingInfo();
      min = BABYLON.Vector3.Minimize(min, info.boundingBox.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, info.boundingBox.maximumWorld);
    });

    const center = min.add(max).scale(0.5);
    const size = max.subtract(min);
    const fullHeight = size.y || 2;

    // Recorta la parte de abajo (piernas) para enfocar torso/manos/cara.
    const visibleBottom = min.y + fullHeight * AVATAR_FRAME_HIP_RATIO;
    const visibleTop = max.y + fullHeight * 0.05; // pequeño margen arriba de la cabeza
    const visibleHeight = Math.max(visibleTop - visibleBottom, 0.5);
    const targetY = (visibleTop + visibleBottom) / 2;

    camera.setTarget(new BABYLON.Vector3(center.x, targetY, center.z));

    const framingSize = Math.max(size.x, visibleHeight) || 2;
    camera.radius = framingSize * 1.25;

    // Límites de zoom relativos al tamaño encuadrado, para no acercarse
    // demasiado (se ve la textura fea) ni alejarse demasiado.
    camera.lowerRadiusLimit = framingSize * 0.55;
    camera.upperRadiusLimit = framingSize * 2.5;
  }

  function playWord(fileName, callback) {
    return controller?.enqueue(fileName, callback);
  }

  function isBusy() {
    return !!controller && (controller.draining || controller.queue.length > 0 || controller.state !== 'IDLE');
  }

  // Fuerza el regreso a la pose base (Idle), sin importar qué esté pasando.
  // Se usa cuando el usuario escribe una palabra sin animación 3D, para
  // asegurar que el avatar nunca se quede "pegado" en la última pose.
  function forceIdle() {
    controller?.forceIdle();
  }

  // Avisa al motor de Babylon que el tamaño del canvas cambió, y reencuadra
  // la cámara para el nuevo tamaño/proporción del contenedor.
  // (úsalo después de agrandar o achicar el contenedor por CSS).
  function resize() {
    if (!engine) return;
    engine.resize();
    centerCamera();
  }

  return { init, playWord, isBusy, forceIdle, resize, AVATAR_WORD_MAP, isAvailable: () => ready,
    preload: async file => (await controller?.ready) ? controller.loadClip(file) : null,
    snapshot: () => controller?.snapshot() };
})();
