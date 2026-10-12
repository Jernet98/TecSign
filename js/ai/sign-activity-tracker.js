// Señas-only activity: movement of one hand must not be diluted by the other
// stationary hand or by pose-normalization jitter. Model features stay unchanged.
export class SignActivityTracker {
  constructor(config){this.config=config;this.reset();}
  reset(){this.previous=null;this.history=[];this.motion=0;this.wasActive=false;}
  observe(values,time,context){
    const body=values?.length===174,valid=!!values && (body?values[171]===1 && (values[172]===1 || values[173]===1):values.length===63) && values.every(Number.isFinite);
    if(!valid){this.reset();return {valid:false,active:false,rest:true,motion:0,reason:values?'NO_HANDS':'NO_POSE'};}
    const cfg=this.config,gap=this.previous && time-this.previous.time>cfg.maxFrameGapMs;
    if(gap){this.history=[];this.motion=0;}
    const hands=context?.activityHands || (context?.hand?{right:context.hand}:{}),reference=this.history[0];
    let speed=0,excursion=0;
    if(reference && time>reference.time){
      for(const side of ['left','right']){
        const hand=hands[side],old=reference.hands[side];if(!hand || !old)continue;
        const distances=[0,4,8,12,16,20].map(i=>Math.hypot((hand[i].x-old[i].x)*16/9,hand[i].y-old[i].y)).sort((a,b)=>a-b);
        const travel=distances[3];excursion=Math.max(excursion,travel);speed=Math.max(speed,travel/((time-reference.time)/1000));
      }
    }
    const dt=this.previous?time-this.previous.time:0,alpha=1-Math.exp(-dt/cfg.motionSmoothingMs);this.motion+=alpha*(speed-this.motion);
    const rest=body && [33,36].every(i=>values[i+1]>cfg.restWristY);
    const active=!rest && excursion>=(this.wasActive?cfg.excursionContinue:cfg.excursionStart) && this.motion>=(this.wasActive?cfg.motionContinue:cfg.motionStart);
    this.wasActive=active;this.previous={time,values};
    this.history.push({time,hands});while(this.history.length>1 && time-this.history[0].time>cfg.historyMs)this.history.shift();
    return {valid:true,active,rest:!!rest,motion:this.motion,excursion,gap:!!gap,reason:rest?'REST':active?'ACTIVITY':'QUIET'};
  }
}
