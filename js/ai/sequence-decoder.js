export function probabilities(logits,temperature=1) {
  if (!(temperature > 0) || !logits.length || !Array.from(logits).every(Number.isFinite)) throw Error('Salida inválida del modelo');
  const max=Math.max(...logits),exp=Array.from(logits,x=>Math.exp((x-max)/temperature)),sum=exp.reduce((a,b)=>a+b,0);
  return exp.map(x=>x/sum);
}
export function topK(probs,labels,k=3) {
  if(probs.length !== labels.length) throw Error('Etiquetas incompatibles');
  return Array.from(probs,(confidence,index)=>({label:labels[index],confidence,index})).sort((a,b)=>b.confidence-a.confidence).slice(0,k);
}
export const PHASES=['IDLE','SIGN_START','SIGNING','SIGN_CONFIRMED','TRANSITION'];
const ALLOWED={IDLE:['SIGN_START'],SIGN_START:['SIGNING','TRANSITION','IDLE'],SIGNING:['SIGN_CONFIRMED','TRANSITION'],SIGN_CONFIRMED:['TRANSITION'],TRANSITION:['IDLE','SIGN_START','SIGNING','SIGN_CONFIRMED']};

export class SequenceDecoder {
  constructor(config={}){
    this.config={onsetMs:160,releaseMs:650,threshold:.90,rawThreshold:.70,margin:.25,emaAlpha:.5,stable:4,stableMs:600,voteWindow:5,voteRatio:.8,blank:'NO_SIGN',requireSupport:true,...config};this.reset();
  }
  reset(){this.phase='IDLE';this.segment=0;this.segmentStart=null;this.quietSince=null;this.locked=false;this.lastLabel=null;this.signal={valid:false,active:false};this.transitions=[];this.clearEvidence();this.decision='NO_SIGN';}
  clearEvidence(){this.ema=null;this.votes=[];this.candidate=null;this.candidateSince=null;this.count=0;this.lastEvidenceTime=-Infinity;}
  transition(next,time,reason){
    if(next===this.phase)return;
    if(!ALLOWED[this.phase]?.includes(next))throw Error(`Transición inválida ${this.phase} → ${next}`);
    this.transitions.push({from:this.phase,to:next,time,reason});if(this.transitions.length>60)this.transitions.shift();this.phase=next;
  }
  observe(signal,time){
    this.signal=signal;const quiet=!signal.valid || signal.rest || !signal.active;
    if(quiet){if(this.quietSince===null)this.quietSince=time;}else this.quietSince=null;
    if(!signal.valid || signal.gap){
      this.clearEvidence();this.decision='NO_SIGN';
      if(this.phase!=='IDLE' && this.phase!=='TRANSITION')this.transition('TRANSITION',time,'tracking-lost');
    }
    switch(this.phase){
      case 'IDLE':
        this.decision='NO_SIGN';
        if(signal.valid && signal.active && !signal.rest){
          this.segment++;this.segmentStart=time;this.locked=false;this.lastLabel=null;this.clearEvidence();this.transition('SIGN_START',time,'activity-onset');
        }break;
      case 'SIGN_START':
        if(quiet){this.clearEvidence();this.transition('IDLE',time,'onset-aborted');}
        else if(time-this.segmentStart>=this.config.onsetMs)this.transition('SIGNING',time,'onset-sustained');break;
      case 'SIGNING':case 'SIGN_CONFIRMED':
        if(quiet && time-this.quietSince>=this.config.releaseMs){this.clearEvidence();this.transition('TRANSITION',time,'rest-sustained');}break;
      case 'TRANSITION':
        if(quiet && time-this.quietSince>=this.config.releaseMs){
          this.locked=false;this.segmentStart=null;this.clearEvidence();this.decision='NO_SIGN';this.transition('IDLE',time,'segment-released');
        }else if(signal.valid && signal.active && !signal.rest){
          if(this.locked)this.transition('SIGN_CONFIRMED',time,'brief-occlusion-lock');
          else{this.segment++;this.segmentStart=time;this.clearEvidence();this.transition('SIGN_START',time,'tracking-reacquired');}
        }break;
    }
    return this.snapshot();
  }
  reject(reason='UNKNOWN'){this.clearEvidence();this.decision=reason;return null;}
  consider(prediction,labels,time){
    if(!this.signal.valid || this.signal.rest || !['SIGNING','SIGN_CONFIRMED'].includes(this.phase))return null;
    const p=prediction.probabilities,raw=prediction.top?.[0];
    if(!raw || !p?.length || p.length!==labels.length || !p.every(Number.isFinite))return this.reject();
    if(raw.label===this.config.blank)return this.reject('NO_SIGN');
    if(this.phase==='SIGN_CONFIRMED' && !this.config.allowLabelChange)return null;
    if(this.config.requireSupport && !prediction.support?.supported)return this.reject();
    if(raw.confidence<this.config.threshold || (prediction.rawConfidence ?? raw.confidence)<this.config.rawThreshold || raw.confidence-(prediction.top[1]?.confidence ?? 0)<this.config.margin)return this.reject();
    if(time<=this.lastEvidenceTime)return null;this.lastEvidenceTime=time;
    this.ema=this.ema?this.ema.map((v,i)=>v*(1-this.config.emaAlpha)+p[i]*this.config.emaAlpha):Array.from(p);
    const ranked=topK(this.ema,labels),best=ranked[0];
    this.votes.push(raw.label);if(this.votes.length>this.config.voteWindow)this.votes.shift();
    const ratio=this.votes.filter(x=>x===best.label).length/this.votes.length;
    if(best.label!==raw.label || best.confidence<this.config.threshold || best.confidence-(ranked[1]?.confidence ?? 0)<this.config.margin || ratio<this.config.voteRatio){this.candidate=null;this.count=0;this.candidateSince=null;this.decision='UNKNOWN';return null;}
    if(this.candidate!==best.label){this.candidate=best.label;this.count=1;this.candidateSince=time;}else this.count++;
    this.decision='PROVISIONAL';
    if(this.count<this.config.stable || this.votes.length<this.config.stable || time-this.candidateSince<this.config.stableMs)return null;
    if(this.locked && this.lastLabel===best.label)return null;
    if(this.phase==='SIGN_CONFIRMED'){
      this.transition('TRANSITION',time,'alphabet-label-change');this.transition('SIGNING',time,'alphabet-stable-next-letter');
    }
    this.locked=true;this.lastLabel=best.label;this.decision='CONFIRMED';this.transition('SIGN_CONFIRMED',time,'stable-supported-prediction');
    return {...best,segment:this.segment,evidence:this.count,evidenceMs:time-this.candidateSince};
  }
  get canInfer(){return this.signal.valid && !this.signal.rest && (this.phase==='SIGNING' || (this.phase==='SIGN_CONFIRMED' && this.config.allowLabelChange));}
  snapshot(){return {phase:this.phase,decision:this.decision,segment:this.segment,locked:this.locked,candidate:this.candidate,count:this.count};}
}
