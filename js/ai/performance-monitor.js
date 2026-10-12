export class PerformanceMonitor {
  constructor(){this.reset();}
  reset(){this.samples=[];this.confirmations=[];this.lastFrame=null;}
  record(sample){if(this.lastFrame!==null)sample.cadenceMs=sample.wallTime-this.lastFrame;this.lastFrame=sample.wallTime;this.samples.push(sample);if(this.samples.length>240)this.samples.shift();}
  confirmed(event){this.confirmations.push(event);}
  snapshot(){
    const warm=this.samples.filter(s=>s.mediaPipeMs<1000),stages={};
    for(const key of ['captureMs','conversionMs','mediaPipeMs','drawMs','normalizationMs','pipelineMs','gruMs','legacyMs','domMs','totalMs','cadenceMs','sourceAgeMs']){
      const x=warm.map(s=>s[key]).filter(v=>Number.isFinite(v) && (key!=='cadenceMs' || v<1000)).sort((a,b)=>a-b);
      if(x.length)stages[key]={samples:x.length,mean:x.reduce((a,b)=>a+b,0)/x.length,median:x[Math.floor(x.length/2)],p95:x[Math.min(x.length-1,Math.floor(x.length*.95))]};
    }
    return {warmupFrames:this.samples.length-warm.length,stages,fps:stages.cadenceMs?1000/stages.cadenceMs.mean:0,confirmations:this.confirmations,samples:this.samples};
  }
}
