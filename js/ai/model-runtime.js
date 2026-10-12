import { fetchJSON } from './loader.js';
import { probabilities,topK } from './sequence-decoder.js';
import {OpenSetGuard} from './open-set-guard.js';
export class ModelRuntime {
  load(){if(!this.loading)this.loading=this.initialize().catch(e=>{this.loading=null;throw e;});return this.loading;}
  async initialize() {
    this.meta=await fetchJSON('./web/models/tecsign-isolated-v1/metadata.json');
    if(this.meta.features!==174 || this.meta.frames!==32 || this.meta.preprocessing!=='tecsign-body-v1') throw Error('Contrato de modelo incompatible');
    const reference=await fetchJSON('./web/models/tecsign-isolated-v1/'+this.meta.rejection);
    if(reference.model_sha256!==this.meta.sha256)throw Error('Modelo y referencias de rechazo no corresponden');
    this.guard=new OpenSetGuard(reference);
    this.ort=await import('../../web/vendor/ort/ort.wasm.min.mjs');
    this.ort.env.wasm.numThreads=1;
    this.ort.env.wasm.wasmPaths=new URL('../../web/vendor/ort/',import.meta.url).href;
    const started=performance.now();
    const modelURL=new URL('../../web/models/tecsign-isolated-v1/model.onnx',import.meta.url);modelURL.searchParams.set('v',this.meta.sha256);
    this.session=await this.ort.InferenceSession.create(modelURL.href,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    this.backend='WASM';this.loadMs=performance.now()-started;
    // Run a warmup. Invalid exports must fail before enabling the new path.
    await this.predict(new Float32Array(this.meta.frames*this.meta.features));
    return this;
  }
  async predict(values) {
    if(values.length!==this.meta.frames*this.meta.features) throw Error('Dimensiones de secuencia incompatibles');
    const input=new this.ort.Tensor('float32',values,[1,this.meta.frames,this.meta.features]);
    const started=performance.now();
    let output;
    try {
      output=await this.session.run({landmarks:input});const inferenceMs=performance.now()-started,logits=output.logits;
      const probs=probabilities(logits.data,this.meta.temperature);
      if(output.embedding?.data.length!==128)throw Error('Falta la representación neuronal para rechazo');
      const top=topK(probs,this.meta.labels),uncalibrated=probabilities(logits.data,1);
      return {top,probabilities:probs,rawConfidence:uncalibrated[top[0].index],support:this.guard.check(output.embedding?.data,top[0].label),inferenceMs,latencyMs:performance.now()-started};
    } finally { input.dispose();Object.values(output || {}).forEach(t=>t.dispose()); }
  }
  async dispose() { if(this.session) await this.session.release();this.session=null; }
}
