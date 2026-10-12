import {loadScript,fetchJSON} from './loader.js';
import {topK} from './sequence-decoder.js';
import {resample} from './frame-buffer.js';
export class BaselineRuntime {
  constructor() { this.buffer=[];this.loading={};this.models={}; }
  async load(mode) {
    if(!this.loading[mode]) this.loading[mode]=(async()=>{
      if(!globalThis.tf) await loadScript('./web/vendor/tfjs/tf.min.js');
      await tf.ready();
      if(mode==='abc') {
        this.models.abc=await tf.loadLayersModel('./dataset/modelo_lsm.json');
        this.abcLabels='A,B,C,D,E,F,G,H,I,J,K,L,M,N,Ñ,O,P,Q,R,S,T,U,V,W,X,Y,Z'.split(',');
      } else {
        this.meta=await fetchJSON('./Secuencial/modelo/metadata_tecsign_secuencial.json');
        this.models.senas=await tf.loadLayersModel('./Secuencial/modelo/modelo_tecsign_secuencial.json');
      }
    })().catch(e=>{delete this.loading[mode];throw e;});
    return this.loading[mode];
  }
  reset() { this.buffer=[]; }
  async predictSequence(hands){
    if(hands.length<8 || !this.models.senas)return null;
    const values=hands.map(hand=>hand.flatMap(p=>[p.x-hand[0].x,p.y-hand[0].y,(p.z ?? 0)-(hand[0].z ?? 0)]));
    const input=tf.tensor3d(resample(values,this.meta.numFrames),[1,this.meta.numFrames,63]);
    const started=performance.now();let result;
    try{result=this.models.senas.predict(input);const probs=Array.from(await result.data());return {top:topK(probs,this.meta.labels),probabilities:probs,latencyMs:performance.now()-started};}
    finally{input.dispose();result?.dispose();}
  }
  async predict(hand,mode) {
    if(!hand || !this.models[mode]) return null;
    let values=hand.flatMap(p=>[p.x,p.y,p.z ?? 0]);
    if(mode==='senas') {
      const wrist=hand[0]; values=hand.flatMap(p=>[p.x-wrist.x,p.y-wrist.y,(p.z ?? 0)-(wrist.z ?? 0)]);
      this.buffer.push(values);if(this.buffer.length>this.meta.numFrames)this.buffer.shift();
      if(this.buffer.length<this.meta.numFrames)return null;
    }
    const started=performance.now();
    const input=mode==='abc' ? tf.tensor2d(values,[1,63]) : tf.tensor3d([this.buffer],[1,this.meta.numFrames,63]);
    let result;
    try { result=this.models[mode].predict(input); const probs=Array.from(await result.data());
      return {top:topK(probs,mode==='abc'?this.abcLabels:this.meta.labels),probabilities:probs,latencyMs:performance.now()-started};
    } finally {input.dispose();result?.dispose();}
  }
}
