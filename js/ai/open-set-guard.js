export class OpenSetGuard {
  constructor(reference){
    if(reference?.schema!=='tecsign-embedding-rejection-v1' || reference.dimensions!==128)throw Error('Contrato de rechazo incompatible');
    this.reference=reference;
  }
  check(embedding,label){
    const entry=this.reference.classes[label];
    if(!entry || embedding?.length!==128 || !Array.from(embedding).every(Number.isFinite))return {supported:false,reason:'NO_REFERENCE'};
    const norm=Math.hypot(...embedding);if(norm<1e-8)return {supported:false,reason:'INVALID_EMBEDDING'};
    let distance=Infinity;
    for(const vector of entry.references){let dot=0;for(let i=0;i<128;i++)dot+=vector[i]*embedding[i]/norm;distance=Math.min(distance,Math.max(0,1-dot));}
    return {supported:distance<=entry.radius,distance,radius:entry.radius,reason:distance<=entry.radius?'SUPPORTED':'OUTSIDE_REFERENCE'};
  }
}
