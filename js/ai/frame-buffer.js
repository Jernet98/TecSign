export function resample(sequence,length=32) {
  if (!sequence.length) throw new Error('Secuencia vacía');
  const features=sequence[0].length,out=new Float32Array(length*features);
  for(let t=0;t<length;t++) {
    const pos=t*(sequence.length-1)/Math.max(1,length-1),lo=Math.floor(pos),hi=Math.min(lo+1,sequence.length-1),weight=pos-lo;
    for(let f=0;f<features;f++) out[t*features+f]=sequence[lo][f]*(1-weight)+sequence[hi][f]*weight;
  }
  return out;
}
export class FrameBuffer {
  constructor(maxMs=5000) { this.maxMs=maxMs; this.frames=[]; }
  push(values,time) {
    if(this.frames.length && time <= this.frames.at(-1).time) return;
    this.frames.push({values:Float32Array.from(values),time});
    while(this.frames.length && time-this.frames[0].time > this.maxMs) this.frames.shift();
    if(this.frames.length > 180) this.frames.shift();
  }
  clear() { this.frames=[]; }
  window(durationMs,end=this.frames.at(-1)?.time) {
    return this.frames.filter(f=>f.time >= end-durationMs).map(f=>f.values);
  }
  get duration() { return this.frames.length > 1 ? this.frames.at(-1).time-this.frames[0].time : 0; }
}
