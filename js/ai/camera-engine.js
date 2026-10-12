export class CameraEngine {
  constructor(video,onFrame,onError) { Object.assign(this,{video,onFrame,onError});this.running=false;this.last=-1;this.lastFrame=-Infinity;this.generation=0;this.maxFPS=15;this.fileFPS=12; }
  async start() {
    this.stop();const generation=this.generation;
    await this.processing?.catch(()=>{});
    if(generation!==this.generation)return false;
    if(!navigator.mediaDevices?.getUserMedia) throw Error('La cámara requiere localhost o una conexión HTTPS.');
    const requested=performance.now();
    const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:960},height:{ideal:540},facingMode:'user'},audio:false});
    this.startup={permissionAndStreamMs:performance.now()-requested};
    if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}
    this.stream=stream;
    this.video.srcObject=this.stream;this.video.muted=true;this.video.loop=false;
    const playStarted=performance.now();await this.video.play();this.startup.playMs=performance.now()-playStarted;
    if(generation!==this.generation)return false;
    const detectorStarted=performance.now();await this.beforeWarmup?.();this.startup.detectorReadyMs=performance.now()-detectorStarted;if(generation!==this.generation)return false;
    // Compile visual kernels on a real frame before enabling the sampling loop.
    const warmStarted=performance.now();this.warming=true;this.processing=this.onFrame(this.video,this.video.currentTime*1000);
    try{await this.processing;}finally{this.processing=null;this.warming=false;}
    this.startup.visualWarmupMs=performance.now()-warmStarted;this.startup.totalMs=performance.now()-requested;
    if(generation!==this.generation)return false;
    this.run(generation);return true;
  }
  async file(file) {
    this.stop();const generation=this.generation;
    await this.processing?.catch(()=>{});
    if(generation!==this.generation)return false;
    this.fileURL=URL.createObjectURL(file);this.video.autoplay=false;this.video.src=this.fileURL;this.video.muted=true;this.video.loop=false;
    if(!await this.waitForVideo('loadeddata',()=>this.video.load(),generation))return false;
    this.video.pause();
    // First Holistic inference can compile shaders for seconds. Do not let the
    // isolated clip elapse while compiling, or the sign would never be observed.
    this.processing=this.onFrame(this.video,0);
    try{await this.processing;}finally{this.processing=null;}
    if(generation!==this.generation)return false;
    this.video.currentTime=0;this.running=true;this.fileComplete=false;
    this.fileTask=this.runFile(generation).catch(e=>this.onError(e));
    return true;
  }
  waitForVideo(event,action,generation) {
    if(generation!==this.generation)return Promise.resolve(false);
    return new Promise((resolve,reject)=>{
      const ready=()=>{cleanup();resolve(generation===this.generation);};
      const failed=()=>{cleanup();reject(Error('Este formato de video no se pudo abrir. Prueba MP4 H.264.'));};
      const cancel=()=>{cleanup();resolve(false);};
      const cleanup=()=>{this.video.removeEventListener(event,ready);this.video.removeEventListener('error',failed);if(this.cancelWait===cancel)this.cancelWait=null;};
      this.cancelWait=cancel;this.video.addEventListener(event,ready,{once:true});this.video.addEventListener('error',failed,{once:true});
      try{action();}catch(e){cleanup();reject(e);}
    });
  }
  async runFile(generation) {
    // File analysis retains the entire temporal sequence even below real time.
    const duration=this.video.duration;
    for(let time=0;time<duration;time+=1/this.fileFPS){
      if(!this.running || generation!==this.generation)return;
      if(Math.abs(this.video.currentTime-time)>.001){
        if(!await this.waitForVideo('seeked',()=>{this.video.currentTime=time;},generation))return;
      }
      if(!this.running || generation!==this.generation)return;
      this.last=time;this.processing=this.onFrame(this.video,time*1000);
      try{await this.processing;}finally{this.processing=null;}
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    if(generation===this.generation){this.running=false;this.fileComplete=true;this.video.dispatchEvent(new Event('ended'));}
  }
  run(generation=this.generation) { if(generation!==this.generation)return;this.running=true;this.last=-1;this.lastFrame=-Infinity;this.tick(generation); }
  async tick(generation) {
    if(!this.running || generation!==this.generation)return;
    const now=performance.now();
    if(!this.video.paused && this.video.readyState>=2 && this.video.currentTime!==this.last && now-this.lastFrame>=1000/this.maxFPS) {
      this.last=this.video.currentTime;this.lastFrame=now;
      try {this.processing=this.onFrame(this.video,this.video.currentTime*1000);await this.processing;} catch(e) {this.onError(e);} finally {this.processing=null;}
    }
    if(this.running && generation===this.generation)this.frameId=requestAnimationFrame(()=>this.tick(generation));
  }
  stop() {
    this.running=false;this.fileComplete=false;this.generation++;this.cancelWait?.();cancelAnimationFrame(this.frameId);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
    this.video.pause();this.video.srcObject=null;this.video.removeAttribute('src');
    if(this.fileURL)URL.revokeObjectURL(this.fileURL);this.fileURL=null;
  }
}
