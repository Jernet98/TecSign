import {ActivityTracker} from './activity-tracker.js';
import {SequenceDecoder} from './sequence-decoder.js';
import {FrameBuffer,resample} from './frame-buffer.js';

export class RecognitionPipeline {
  constructor({config,labels,predict,staticSigns=false,streamingBaseline=false,activityTracker}){
    Object.assign(this,{config,labels,predict,staticSigns,streamingBaseline});
    this.activity=activityTracker || new ActivityTracker(config.activity,staticSigns);this.decoder=new SequenceDecoder({...config.temporal,...config.confirmation});
    this.buffer=new FrameBuffer(config.temporal.maxWindowMs);this.revision=0;this.reset();
  }
  reset(){this.revision++;this.activity.reset();this.decoder.reset();this.buffer.clear();this.lastTime=-Infinity;this.lastValidTime=-Infinity;this.trackingLostAt=null;this.lastInference=-Infinity;this.prediction=null;this.inferences=0;}
  invalidate(time=this.lastTime){
    this.revision++;this.buffer.clear();this.prediction=null;this.activity.reset();
    this.decoder.observe({valid:false,active:false,rest:true,reason:'NO_HANDS'},time);this.decoder.clearEvidence();
  }
  snapshot(signal=this.decoder.signal){return {...this.decoder.snapshot(),signal,prediction:this.prediction,bufferFrames:this.buffer.frames.length,inferences:this.inferences};}
  async process(values,time,hand,context){
    if(time<this.lastTime)this.reset();
    if(time===this.lastTime)return this.snapshot();
    this.lastTime=time;
    const valid=!!values && (values.length===174?values[171]===1 && (values[172]===1 || values[173]===1):values.length===63) && values.every(Number.isFinite);
    const grace=this.config.temporal.trackingGraceMs || 0;
    if(!valid && grace && context?.trackingMayReturn && this.decoder.phase!=='IDLE' && time-this.lastValidTime<=grace){
      this.trackingLostAt ??=time;this.revision++;this.prediction=null;this.decoder.clearEvidence();this.decoder.decision='NO_SIGN';
      this.decoder.signal={valid:false,active:false,rest:false,motion:0,reason:'TRACKING_GAP'};
      return this.snapshot(); // Keep only segment data; no neural call or confirmation on an old frame.
    }
    if(valid){this.lastValidTime=time;this.trackingLostAt=null;}
    if(context && this.activity.previous?.values.length!==values?.length)this.activity.reset();
    const signal=this.activity.observe(values,time,context?{...context,hand}:undefined),previousSegment=this.decoder.segment;
    this.decoder.observe(signal,time);
    if(!signal.valid || signal.gap){this.revision++;this.buffer.clear();this.prediction=null;}
    if(this.decoder.segment!==previousSegment){this.lastInference=-Infinity;this.prediction=null;}
    if(signal.valid){this.buffer.push(values,time);const frame=this.buffer.frames.at(-1);frame.hand=hand?.map(p=>({...p}));if(context)frame.bodyValues=context.bodyValues;}
    if(this.decoder.phase==='IDLE'){
      const preRoll=this.config.temporal.preRollMs;
      this.buffer.frames=this.buffer.frames.filter(f=>f.time>=time-preRoll);this.prediction=null;
    }
    if(!this.decoder.canInfer || time-this.lastInference<this.config.temporal.inferenceIntervalMs)return this.snapshot(signal);
    const start=this.decoder.segmentStart-this.config.temporal.preRollMs;
    const frames=this.buffer.frames.filter(f=>f.time>=start);
    if(frames.length<this.config.temporal.minFrames || time-frames[0].time<this.config.temporal.minWindowMs)return this.snapshot(signal);
    this.lastInference=time;const revision=this.revision,segment=this.decoder.segment;
    const prediction=await this.predict(this.streamingBaseline?{hand,values,frames}:resample(frames.map(f=>f.values)));
    if(revision!==this.revision || segment!==this.decoder.segment || !this.decoder.signal.valid)return this.snapshot();
    if(!prediction)return this.snapshot(signal);
    this.inferences++;this.prediction=prediction;
    const accepted=this.decoder.consider(prediction,this.labels,time);
    if(accepted && context)accepted.engine=prediction.engine;
    return {...this.snapshot(signal),accepted};
  }
}
