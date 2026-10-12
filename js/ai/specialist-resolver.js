import {topK} from './sequence-decoder.js';
import {resample} from './frame-buffer.js';

export class SpecialistResolver {
  constructor(gru,legacy,config,need=null){this.gru=gru;this.legacy=legacy;this.config=config;this.need=need;this.labels=[...new Set([...(gru?.meta.labels || []),...legacy.labels,...(need?.available?['NECESITAR']:[])])];}
  eligible(p,threshold,margin,raw){return p && p.top[0].label!=='NO_SIGN' && p.support?.supported && p.top[0].confidence>=threshold && (p.rawConfidence ?? p.top[0].confidence)>=raw && p.top[0].confidence-(p.top[1]?.confidence || 0)>=margin;}
  resolve(gru,legacy){
    const a=this.eligible(gru,this.config.gruThreshold,this.config.gruMargin,this.config.gruRawThreshold),b=this.eligible(legacy,this.config.legacyThreshold,this.config.legacyMargin,this.config.legacyThreshold);
    const conflict=a && (b || legacy?.potentialSupport) && gru.top[0].label!==legacy.top[0].label;
    const chosen=conflict?null:a?gru:b?legacy:null;
    // A specialist must qualify under its own rules. Never compare softmax maxima across networks.
    const diagnostic=chosen || gru || legacy;
    if(!diagnostic)return null;
    const labels=diagnostic===gru?this.gru.meta.labels:this.legacy.labels;
    const probabilities=this.labels.map(label=>{const i=labels.indexOf(label);return i<0?0:diagnostic.probabilities[i];});
    return {...diagnostic,probabilities,top:topK(probabilities,this.labels),support:{...diagnostic.support,supported:!!chosen},
      engine:conflict?'conflict':a && b?'gru+legacy':a?'gru':b?'legacy':'none',reason:conflict?'SPECIALISTS_DISAGREE':chosen?'QUALIFIED':'NO_SPECIALIST_SUPPORT',
      specialists:{gru,legacy},legacyMs:legacy?.latencyMs,gruMs:gru?.inferenceMs};
  }
  async predict(frames){
    const body=frames.filter(f=>f.bodyValues?.length===174),hands=frames.map(f=>f.hand).filter(Boolean);
    let gru=null,legacy=null,sequence=null;
    if(this.gru && body.length>=8 && frames.at(-1)?.bodyValues){sequence=resample(body.map(f=>f.bodyValues));gru=await this.gru.predict(sequence);}
    if(hands.length>=8){
      legacy=await this.legacy.predict(hands);
      if(frames.at(-1).time-frames[0].time<this.config.legacyMinWindowMs){
        legacy.potentialSupport=this.eligible(legacy,this.config.legacyThreshold,this.config.legacyMargin,this.config.legacyThreshold);
        legacy.support={...legacy.support,supported:false,reason:'LEGACY_SEQUENCE_INCOMPLETE'};
      }
    }
    const primary=this.resolve(gru,legacy);
    // Preserve qualified v1/legacy decisions. Reuse this exact resampled tensor
    // only for an unresolved window; no second landmark extractor or resampling.
    if(!primary?.support?.supported && primary?.engine!=='conflict' && this.need?.available && sequence){
      let evidence;try{evidence=await this.need.predict(sequence);}catch(error){this.need.available=false;this.need.failure=error.message;}
      if(evidence?.label==='NECESITAR'){
        // Project all discarded v2 mass to the reject/blank slot, never to old
        // labels. The shared decoder still requires multiple stable evidences.
        const probabilities=this.labels.map(label=>label==='NECESITAR'?evidence.confidence:label==='NO_SIGN'?1-evidence.confidence:0);
        return {probabilities,top:topK(probabilities,this.labels).filter(item=>item.confidence>0),rawConfidence:evidence.rawConfidence,support:evidence.support,
          engine:'need-v2',reason:'QUALIFIED_NEED_SPECIALIST',gruMs:gru?.inferenceMs,legacyMs:legacy?.latencyMs,needMs:evidence.inferenceMs};
      }
    }
    return primary;
  }
}
