import {ModelRuntime} from './model-runtime.js';
import {fetchJSON} from './loader.js';
import {OpenSetGuard} from './open-set-guard.js';

/** Optional, single-label adapter. All other v2 predictions are discarded. */
export class NeedSpecialist extends ModelRuntime {
  constructor(config){super();this.config=config;this.available=false;this.calls=0;}
  async load(){
    let timer;
    try{return await Promise.race([super.load(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tiempo de carga NECESITAR agotado')),8000);})]);}
    catch(error){this.disabled=true;this.available=false;this.failure=error.message;throw error;}
    finally{clearTimeout(timer);}
  }
  async initialize(){
    this.meta=await fetchJSON('./web/models/tecsign-isolated-v2/metadata.json');
    if(this.meta.id!=='tecsign-isolated-v2' || this.meta.frames!==32 || this.meta.features!==174 ||
      this.meta.preprocessing!=='tecsign-body-v1' || this.meta.labels[13]!=='NECESITAR')throw Error('Contrato de especialista NECESITAR incompatible');
    const reference=await fetchJSON('./web/models/tecsign-isolated-v2/'+this.meta.rejection);
    if(reference.model_sha256!==this.meta.sha256)throw Error('Modelo y rechazo NECESITAR no corresponden');
    this.guard=new OpenSetGuard(reference);
    this.ort=await import('../../web/vendor/ort/ort.wasm.min.mjs');
    this.ort.env.wasm.numThreads=1;
    this.ort.env.wasm.wasmPaths=new URL('../../web/vendor/ort/',import.meta.url).href;
    const url=new URL('../../web/models/tecsign-isolated-v2/model.onnx',import.meta.url);url.searchParams.set('v',this.meta.sha256);
    this.session=await this.ort.InferenceSession.create(url.href,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    if(this.disabled){await this.dispose();throw Error('Especialista NECESITAR deshabilitado');}
    await super.predict(new Float32Array(32*174));
    if(this.disabled){await this.dispose();throw Error('Especialista NECESITAR deshabilitado');}
    this.available=true;return this;
  }
  qualify(prediction){
    const best=prediction?.top?.[0],second=prediction?.top?.[1];
    if(best?.label!=='NECESITAR' || !prediction.support?.supported || best.confidence<this.config.gruThreshold ||
      prediction.rawConfidence<this.config.gruRawThreshold || best.confidence-(second?.confidence || 0)<this.config.gruMargin)return null;
    // The 13 other v2 labels never leave this adapter. Preserve the real NEED
    // softmax probability, raw confidence and class-specific open-set evidence.
    return {label:'NECESITAR',confidence:best.confidence,rawConfidence:prediction.rawConfidence,
      support:prediction.support,margin:best.confidence-(second?.confidence || 0),inferenceMs:prediction.inferenceMs};
  }
  async predict(values){
    if(!this.available)return null;
    try{this.calls++;return this.qualify(await super.predict(values));}
    catch(error){this.available=false;this.failure=error.message;return null;}
  }
}
