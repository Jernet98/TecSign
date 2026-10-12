function median(values){values.sort((a,b)=>a-b);return values.length?values[Math.floor(values.length/2)]:0;}
export class ActivityTracker {
  constructor(config={},staticSigns=false){this.config=config;this.staticSigns=staticSigns;this.reset();}
  reset(){this.previous=null;this.motion=0;this.wasActive=false;}
  observe(values,time){
    const body=values?.length===174;
    const valid=!!values && (body?values[171]===1 && (values[172]===1 || values[173]===1):values.length===63) && values.every(Number.isFinite);
    if(!valid){this.reset();return {valid:false,active:false,rest:true,motion:0,reason:values?'NO_HANDS':'NO_POSE'};}
    const gap=this.previous && time-this.previous.time>(this.config.maxFrameGapMs ?? 450);
    const changes=[];
    if(this.previous && !gap && time>this.previous.time){
      const ranges=body?[[45,172],[108,173]]:[[0,null]];
      for(const [start,mask] of ranges){
        if(mask!==null && !(values[mask] && this.previous.values[mask]))continue;
        for(const joint of [0,4,8,12,16,20])for(let k=0;k<3;k++){
          const i=start+joint*3+k;changes.push(Math.min(2,Math.abs(values[i]-this.previous.values[i])));
        }
      }
      const dt=(time-this.previous.time)/1000;
      const speed=median(changes)/Math.max(.02,dt);
      const alpha=1-Math.exp(-(time-this.previous.time)/(this.config.motionSmoothingMs ?? 120));
      this.motion+=alpha*(speed-this.motion);
    }else this.motion=0;
    const rest=body && [33,36].every(i=>values[i+1]>(this.config.restWristY ?? 1.35));
    const threshold=this.wasActive?(this.config.motionContinue ?? .06):(this.config.motionStart ?? .12);
    const active=this.staticSigns || (!rest && this.motion>=threshold);
    this.wasActive=active;this.previous={time,values:Float32Array.from(values)};
    return {valid:true,active,rest:!!rest,motion:this.motion,gap:!!gap,reason:rest?'REST':active?'ACTIVITY':'QUIET'};
  }
}
