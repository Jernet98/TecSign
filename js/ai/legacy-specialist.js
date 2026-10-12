import {fetchJSON} from './loader.js';
import {topK} from './sequence-decoder.js';
import {resample} from './frame-buffer.js';
import {OpenSetGuard} from './open-set-guard.js';

export function canonicalLabel(label){return label==='ninguna'?'NO_SIGN':label.normalize('NFD').replace(/[\u0300-\u036f¿?]/g,'').toUpperCase().replaceAll(' ','_');}
export class LegacySpecialist {
  constructor(baseline){this.baseline=baseline;}
  async load(){
    await this.baseline.load('senas');const model=this.baseline.models.senas;
    this.labels=this.baseline.meta.labels.map(canonicalLabel);
    this.model=globalThis.tf.model({inputs:model.inputs,outputs:[model.outputs[0],model.getLayer('dense_Dense1').output]});
    this.references=await fetchJSON('./web/models/legacy-rejection.json');this.guard=new OpenSetGuard(this.references);
    await this.predictVectors(Array.from({length:50},()=>new Float32Array(63)));
    return this;
  }
  async predictVectors(vectors,applyGuard=true){
    const input=tf.tensor3d(resample(vectors,50),[1,50,63]);let outputs;const start=performance.now();
    try{
      outputs=this.model.predict(input);const [probs,embedding]=await Promise.all(outputs.map(x=>x.data()));
      const probabilities=Array.from(probs),top=topK(probabilities,this.labels);
      return {probabilities,top,rawConfidence:top[0].confidence,support:applyGuard?this.guard.check(embedding,top[0].label):{supported:true},embedding:applyGuard?undefined:Array.from(embedding),latencyMs:performance.now()-start,engine:'legacy'};
    }finally{input.dispose();outputs?.forEach(x=>x.dispose());}
  }
  async predict(hands){
    if(hands.length<8)return null;
    return this.predictVectors(hands.map(h=>h.flatMap(p=>[p.x-h[0].x,p.y-h[0].y,(p.z ?? 0)-(h[0].z ?? 0)])));
  }
}
