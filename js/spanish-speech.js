const LATIN_AMERICA=new Set(['419','AR','BO','CL','CO','CR','CU','DO','EC','GT','HN','NI','PA','PE','PR','PY','SV','US','UY','VE']);
// Web Speech exposes no standard gender field. Use explicit/name clues only.
const FEMALE_NAME=/\b(female|feminine|woman|mujer|femenina|dalia|sabina|helena|elvira|paulina|monica|lucia|laura|camila|francisca|salome|paloma|maria|elena)\b/i;
const normalizeName=name=>String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function localeRank(lang){
  const parts=lang.replaceAll('_','-').toUpperCase().split('-');
  const region=parts.slice(1).find(p=>/^[A-Z]{2}$|^\d{3}$/.test(p));
  return region==='MX'?0:LATIN_AMERICA.has(region)?1:region==='ES'?2:3;
}
function qualityRank(name){return /\b(natural|neural|neuronal)\b/i.test(name)?0:/\bonline\b/i.test(name)?1:2;}

export function selectBestSpanishVoice(voices=globalThis.speechSynthesis?.getVoices() || []){
  return Array.from(voices).filter(v=>/^es(?:[-_]|$)/i.test(v.lang)).sort((a,b)=>{
    const aName=normalizeName(a.name),bName=normalizeName(b.name);
    return localeRank(a.lang)-localeRank(b.lang) || qualityRank(aName)-qualityRank(bName)
      || Number(FEMALE_NAME.test(bName))-Number(FEMALE_NAME.test(aName))
      || Number(!!b.default)-Number(!!a.default) || aName.localeCompare(bName);
  })[0] || null;
}

export function createSpanishSpeech(synthesis=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance){
  let voice=null;
  const refresh=()=>{voice=selectBestSpanishVoice(synthesis?.getVoices() || []);return voice;};
  refresh();synthesis?.addEventListener('voiceschanged',refresh);
  return {
    get voice(){return voice;},
    speak(text){
      if(!synthesis || !Utterance)return false;
      synthesis.cancel();refresh();
      const utterance=new Utterance(text);
      if(voice)utterance.voice=voice;
      utterance.lang=voice?.lang.replaceAll('_','-') || 'es-MX';utterance.rate=.97;utterance.pitch=1.04;utterance.volume=1;
      synthesis.speak(utterance);return utterance;
    }
  };
}
