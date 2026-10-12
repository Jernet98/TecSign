import {CameraEngine} from './ai/camera-engine.js';
import {LandmarkEngine} from './ai/landmark-engine.js';
import {FastLandmarkEngine} from './ai/fast-landmark-engine.js';
import {ModelRuntime} from './ai/model-runtime.js';
import {BaselineRuntime} from './ai/baseline-runtime.js';
import {LegacySpecialist} from './ai/legacy-specialist.js';
import {SpecialistResolver} from './ai/specialist-resolver.js';
import {SignActivityTracker} from './ai/sign-activity-tracker.js';
import {RecognitionPipeline} from './ai/recognition-pipeline.js';
import {normalize} from './ai/normalizer.js';
import {fetchJSON} from './ai/loader.js';
import {draw,drawMinimal} from './ai/overlay.js';
import {PerformanceMonitor} from './ai/performance-monitor.js';
import {createSpanishSpeech} from './spanish-speech.js';
import {confirmedGlossView} from './ai/confirmed-gloss-view.js';
import {NeedSpecialist} from './ai/need-specialist.js';

const $=id=>document.getElementById(id),video=$('video'),canvas=$('output');
const alphabetLandmarks=new LandmarkEngine(),model=new ModelRuntime(),baseline=new BaselineRuntime(),legacy=new LegacySpecialist(baseline);
let landmarks=alphabetLandmarks,signLandmarks,resolver,legacyReady=false,needSpecialist;
const performanceMonitor=new PerformanceMonitor();
let settings,pipeline,mode='senas',fallback=false,modelReady=false,engineReady=false;
const engineLoading={},engineInitialized={};let lastDebug=0,lastDebugPhase='';
let cameraArmed=true,restSince=null;
let text='',modeToken=0,sourceToken=0,frameRevision=0,frames=0,fpsStart=performance.now();
const state={mode,ready:false,fallback:false,phase:'IDLE',decision:'NO_SIGN',prediction:null,confirmedText:'',landmarkFrames:0,trackedFrames:{pose:0,left:0,right:0,both:0},errors:[],committed:[],media:'idle'};
function status(message){if($('ai-status').textContent!==message)$('ai-status').textContent=message;}
function error(e){state.errors.push(e.message || String(e));status(e.message || String(e));console.warn('[TecSign]',e);}
function setText(value){text=value;state.confirmedText=text;$('texto-traducido').textContent=text || '...';$('btn-undo').disabled=$('btn-limpiar').disabled=$('ai-speak').disabled=!text.trim();}
function updateLanguageView(){
  const view=mode==='senas'?confirmedGlossView(state.committed):{glosses:[],glossText:'',interpretation:'',displayText:text || '...',spokenText:text,language:null};
  state.glosses=view.glosses;state.interpretation=view.interpretation;state.spokenText=view.spokenText;state.language=view.language;
  $('texto-traducido').textContent=view.displayText;
  $('resultado-traduccion').classList.toggle('has-interpretation',!!view.interpretation);
  $('texto-glosas').textContent=view.glossText;$('glosas-confirmadas').hidden=mode!=='senas' || !view.glosses.length;
  $('btn-undo').disabled=$('btn-limpiar').disabled=$('ai-speak').disabled=!view.spokenText.trim();
}
function controls(){ $('ai-start').hidden=state.media==='camera' || (mode==='senas' && (!state.ready || state.media==='starting'));$('ai-start').disabled=!state.ready || state.media==='starting';$('ai-load-video').disabled=!state.ready;$('ai-stop').hidden=!['camera','video','starting'].includes(state.media); }
function reset(){frameRevision++;pipeline?.reset();baseline.reset();state.prediction=null;state.phase='IDLE';state.decision='NO_SIGN';$('ai-top').textContent='Sin predicción provisional';}
function configure(){
  reset();const variant=mode==='abc'?settings.alphabet:fallback?settings.fallback:{};
  const config={activity:{...settings.activity,...(fallback?{motionStart:.04,motionContinue:.02}:{})},temporal:{...settings.temporal,...variant,...(mode==='senas'?{trackingGraceMs:settings.signTracking.graceMs}:{})},confirmation:{...settings.confirmation,...variant}};
  resolver=mode==='senas' && legacyReady?new SpecialistResolver(fallback?null:model,legacy,settings.specialists,fallback?null:needSpecialist):null;
  if(resolver){config.confirmation.requireSupport=true;config.confirmation.blank='NO_SIGN';}
  const labels=mode==='abc'?baseline.abcLabels:resolver?resolver.labels:fallback?baseline.meta.labels:model.meta.labels;
  pipeline=new RecognitionPipeline({config,labels,staticSigns:mode==='abc',streamingBaseline:mode==='abc'||fallback,
    activityTracker:mode==='senas'?new SignActivityTracker(settings.signActivity):undefined,
    predict:mode==='abc'?({hand})=>baseline.predict(hand,'abc'):resolver?({frames})=>resolver.predict(frames):fallback?({frames})=>baseline.predictSequence(frames.map(f=>f.hand).filter(Boolean)):values=>model.predict(values)});
  if(resolver)pipeline.streamingBaseline=true;
  camera.maxFPS=mode==='abc'?15:settings.signDetector.maxFPS;camera.fileFPS=mode==='abc'?12:settings.signDetector.fileFPS;
  state.fallback=mode==='senas' && fallback;
  state.engine=mode==='abc'?'ABC · TFJS':resolver?(fallback?'Legacy · TFJS':'GRU + Legacy'):fallback?'Respaldo · TFJS':model.meta.architecture.toUpperCase()+' · WASM';
  $('ai-engine').textContent=state.engine;
  $('ai-vocabulary').textContent=(mode==='abc'?'Alfabeto original':resolver?'Vocabulario GRU + legacy':fallback?'Vocabulario del respaldo':'Glosas entrenadas')+': '+labels.filter(x=>!['NO_SIGN','ninguna'].includes(x)).join(' · ');
  $('ai-summary').textContent='IA: '+state.engine;
}
async function useFallback(cause){
  fallback=true;modelReady=false;await baseline.load('senas');
  if(mode==='senas'){configure();status('Respaldo temporal activo: '+cause);}
}
async function select(next){
  const token=++modeToken;mode=next;state.mode=mode;window.modoDeteccion=mode;state.ready=false;reset();setText('');state.committed=[];updateLanguageView();
  controls();
  $('btnModeloABC').classList.toggle('activo',mode==='abc');$('btnModeloSenas').classList.toggle('activo',mode==='senas');status('Cargando modelo…');
  try{
    if(next==='abc')await baseline.load('abc');
    else if(!modelReady && !fallback){try{await model.load();modelReady=true;}catch(e){if(token!==modeToken)return;await useFallback(e.message);}}
    else if(fallback)await baseline.load('senas');
    if(next==='senas' && !legacyReady){try{await legacy.load();legacyReady=true;}catch(e){state.legacyError=e.message;}}
    if(next==='senas' && modelReady && !needSpecialist){
      needSpecialist=new NeedSpecialist(settings.specialists);
      try{await needSpecialist.load();state.needSpecialist={available:true,label:'NECESITAR'};}
      catch(e){state.needSpecialist={available:false,error:e.message};}
    }
    if(token!==modeToken)return;
    engineReady=false;await camera.processing?.catch(()=>{});landmarks=next==='abc'?alphabetLandmarks:(signLandmarks ??=new FastLandmarkEngine(settings.signDetector));
    engineReady=!!engineInitialized[next];
    if(camera.running)await ensureEngine();
    configure();state.ready=true;controls();status('Reposo · esperando seña');
  }catch(e){if(token===modeToken)error(Error('No se pudo cargar el modelo: '+e.message));}
}
function describe(result){
  state.phase=result.phase;state.decision=result.decision;state.activity=result.signal;state.prediction=result.prediction;
  state.transitions=pipeline.decoder.transitions;
  const showDebug=mode==='abc' || !result.signal.valid || performance.now()-lastDebug>=200 || result.phase!==lastDebugPhase;
  if(showDebug){$('ai-top').textContent=result.prediction?result.prediction.top.map(p=>p.label+': '+(p.confidence*100).toFixed(1)+' %').join(' · '):'Sin predicción provisional';lastDebug=performance.now();lastDebugPhase=result.phase;}
  if(mode==='senas'){
    if(result.signal.reason==='TRACKING_GAP')status('Analizando seña…');
    else if(!result.signal.valid || result.phase==='IDLE' || result.phase==='TRANSITION')status('Esperando seña');
    else if(result.phase==='SIGN_CONFIRMED')status(state.committed.at(-1)?.label.replaceAll('_',' ') || 'Seña confirmada');
    else status(result.decision==='UNKNOWN'?'Desconocido':'Analizando seña…');
    return showDebug;
  }
  if(!result.signal.valid)status(result.signal.reason==='NO_POSE'?'Incluye cabeza, hombros y manos · esperando seña':'Sin manos detectadas · esperando seña');
  else if(result.phase==='IDLE')status('Reposo · esperando seña');
  else if(result.phase==='SIGN_START')status('Actividad detectada · preparando secuencia');
  else if(result.phase==='TRANSITION')status('Transición · esperando reposo');
  else if(result.phase==='SIGN_CONFIRMED')status('Seña confirmada · vuelve a reposo');
  else status(result.decision==='UNKNOWN'?'DESCONOCIDO · seña no confirmada':'Analizando · esperando estabilidad');
  return showDebug;
}
async function frame(image,time){
  if(!engineReady || !state.ready || !pipeline)return;
  const frameStarted=performance.now();
  const sourceFrame={width:image.videoWidth,height:image.videoHeight,time:image.currentTime};
  const captureMs=performance.now()-frameStarted; // Metadata read, not sensor/exposure latency.
  const generation=camera.generation,revision=frameRevision,token=modeToken,current=pipeline;
  const isCurrent=()=>generation===camera.generation && revision===frameRevision && token===modeToken && current===pipeline;
  let result;
  try{result=await landmarks.detect(image,time);}catch(e){
    if(!isCurrent())return;
    if(landmarks.kind==='holistic' || landmarks.kind==='hands-pose'){engineReady=false;await useFallback('Detector corporal: '+e.message);landmarks=new LandmarkEngine();await landmarks.load('hands');engineReady=true;return;}
    stop();throw Error('No se pudo procesar la cámara: '+e.message);
  }
  if(!isCurrent())return;
  state.landmarkFrames++;state.tracking={pose:!!result.pose,left:!!result.left,right:!!result.right,latencyMs:result.latencyMs};
  for(const key of ['pose','left','right'])if(result[key])state.trackedFrames[key]++;
  if(result.left && result.right)state.trackedFrames.both++;const drawStarted=performance.now();(mode==='abc'?draw:drawMinimal)(canvas,image,result);const drawMs=performance.now()-drawStarted;
  const hand=result.right || result.left || result.hands[0];
  const normalizeStarted=performance.now();
  const handValues=hand?.length===21?Float32Array.from(hand.flatMap(p=>[p.x,p.y,p.z ?? 0])):null;
  const bodyValues=mode==='senas' && !fallback?normalize({...result,aspect:sourceFrame.width/sourceFrame.height}):null;
  const values=mode==='abc'||fallback?handValues:bodyValues || (resolver?handValues:null);
  const trackingMayReturn=!!result.pose && [15,16].some(i=>{const p=result.pose[i];return p && (p.visibility || 0)>.5 && p.x>=0 && p.x<=1 && p.y>=0 && p.y<.85;});
  const normalizationMs=performance.now()-normalizeStarted,pipelineStarted=performance.now(),inferencesBefore=current.inferences;
  if(mode==='senas' && camera.warming){current.reset();return;}
  if(mode==='senas' && state.media==='camera' && !cameraArmed){
    const acquisition=current.activity.observe(values,time,{activityHands:{left:result.left,right:result.right},hand});
    if(!acquisition.active){restSince ??=time;}else restSince=null;
    state.acquisition={armed:false,quietSince:restSince,signal:acquisition};
    if(restSince!==null && time-restSince>=settings.signActivity.acquisitionQuietMs){cameraArmed=true;state.acquisition.armed=true;current.reset();}else{status(handValues?'Analizando seña…':'Esperando seña');return;}
  }
  let recognition;
  try{recognition=await current.process(values,time,hand,mode==='senas'?{bodyValues,trackingMayReturn,activityHands:{left:result.left,right:result.right}}:undefined);}catch(e){
    if(!isCurrent())return;
    if(mode==='senas' && !fallback){await useFallback(e.message);return;}throw e;
  }
  if(!isCurrent())return;
  const pipelineMs=performance.now()-pipelineStarted,domStarted=performance.now();
  const showDebug=describe(recognition);
  if(recognition.accepted){
    const accepted=recognition.accepted;
    setText(mode==='abc'?text+accepted.label:text+accepted.label.replaceAll('_',' ')+' ');
    state.committed.push({...accepted,time});
    updateLanguageView();
    if(mode==='senas')status(accepted.label.replaceAll('_',' '));
    if(mode==='senas')performanceMonitor.confirmed({...accepted,time,segmentStart:current.decoder.segmentStart,fromOnsetMs:time-current.decoder.segmentStart,processedFrames:current.buffer.frames.length});
  }
  const now=performance.now();frames++;const fps=frames*1000/Math.max(1,now-fpsStart);if(now-fpsStart>3000){frames=0;fpsStart=now;}
  if(showDebug)$('ai-summary').textContent='IA: '+state.engine+' · '+fps.toFixed(1)+' FPS';
  const support=recognition.prediction?.support;
  if(showDebug)$('ai-debug-data').textContent=recognition.phase+' · '+recognition.decision+' · Landmarks '+fps.toFixed(1)+' FPS · '+result.latencyMs.toFixed(0)+' ms · Modelo '+(recognition.prediction?.latencyMs?.toFixed(1) ?? '—')+' ms · Buffer '+recognition.bufferFrames+' · Movimiento '+recognition.signal.motion.toFixed(3)+(support?' · Distancia '+support.distance?.toFixed(3)+' / '+support.radius?.toFixed(3):'')+(performance.memory?' · Heap JS '+(performance.memory.usedJSHeapSize/1e6).toFixed(0)+' MB':'');
  if(mode==='senas')performanceMonitor.record({wallTime:frameStarted,mediaTime:time,captureMs,...result.profile,drawMs,normalizationMs,pipelineMs,gruMs:current.inferences>inferencesBefore?recognition.prediction?.gruMs ?? recognition.prediction?.inferenceMs:undefined,legacyMs:current.inferences>inferencesBefore?recognition.prediction?.legacyMs:undefined,domMs:performance.now()-domStarted,totalMs:performance.now()-frameStarted,sourceAgeMs:state.media==='camera'?Math.max(0,image.currentTime*1000-time):undefined,phase:recognition.phase,decision:recognition.decision,top:recognition.prediction?.top[0],support:recognition.prediction?.support,expert:recognition.prediction?.engine});
}
const camera=new CameraEngine(video,frame,error);
async function ensureEngine(){
  const currentMode=mode,current=landmarks;
  if(!engineLoading[currentMode])engineLoading[currentMode]=(async()=>{
    status('Cargando detector de manos y cuerpo…');
    try{await current.load(currentMode==='abc'?'holistic':undefined);}catch(e){if(currentMode==='abc')await current.load('hands');else{landmarks=new LandmarkEngine();await landmarks.load('hands');await useFallback('Detector corporal no disponible: '+e.message);}}
    engineInitialized[currentMode]=true;if(currentMode===mode)engineReady=true;
  })().catch(e=>{delete engineLoading[currentMode];throw e;});
  return engineLoading[currentMode];
}
async function startCamera(automatic=false){
  if(!state.ready)return;
  const token=++sourceToken;
  if(automatic){
    state.autoCamera={attempted:true,result:'requesting'};
  }
  if(token!==sourceToken)return;
  state.media='starting';controls();
  if(mode==='senas'){cameraArmed=false;restSince=null;}
  try{
    if(mode==='abc'){await ensureEngine();camera.beforeWarmup=null;}else{const loading=ensureEngine();void loading.catch(()=>{});camera.beforeWarmup=()=>loading;}
    if(token!==sourceToken)return;reset();
    if(await camera.start()){state.media='camera';if(automatic)state.autoCamera.result='started';controls();}
  }catch(e){
    if(token!==sourceToken)return;camera.stop();reset();state.media='idle';controls();state.cameraError={name:e.name,message:e.message};
    if(automatic)state.autoCamera.result='blocked';status('Cámara no disponible ('+e.name+'). Actívala con el icono o prueba un video.');
  }
}
function stop(){sourceToken++;camera.stop();reset();state.media='idle';controls();canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);status('Cámara detenida');}
$('btnModeloABC').addEventListener('click',()=>select('abc'));
$('btnModeloSenas').addEventListener('click',()=>select('senas'));
$('ai-start').addEventListener('click',()=>startCamera());$('ai-stop').addEventListener('click',stop);
$('ai-load-video').addEventListener('click',()=>$('ai-video-file').click());
$('btn-limpiar').addEventListener('click',()=>{setText('');reset();state.committed=[];updateLanguageView();});
$('btn-undo').addEventListener('click',()=>{state.committed.pop();setText(mode==='abc'?state.committed.map(p=>p.label).join(''):state.committed.map(p=>p.label.replaceAll('_',' ')).join(' ')+(state.committed.length?' ':''));updateLanguageView();});
$('ai-video-file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;const token=++sourceToken;camera.stop();reset();state.media='starting';controls();
  try{await ensureEngine();if(token!==sourceToken)return;reset();if(await camera.file(file)){state.media='video';controls();}}
  catch(e){if(token===sourceToken){state.media='idle';controls();error(e);}}finally{e.target.value='';}
});
const spanishSpeech=createSpanishSpeech();
$('ai-speak').addEventListener('click',()=>{
  if(!('speechSynthesis' in window)){status('La voz no está disponible en este navegador.');return;}
  updateLanguageView();spanishSpeech.speak(state.spokenText);
});
video.addEventListener('ended',()=>{
  updateLanguageView();
  state.lastSequence=pipeline?.snapshot();pipeline?.invalidate();state.prediction=null;state.phase=pipeline?.decoder.phase || 'IDLE';state.media='video-complete';controls();
  $('ai-top').textContent='Sin predicción provisional';status('Video terminado · solo se conservaron glosas confirmadas');
});
window.addEventListener('pagehide',()=>{sourceToken++;reset();camera.stop();alphabetLandmarks.close();signLandmarks?.close();model.dispose();needSpecialist?.dispose();});
window.TecSignAI={state,model,baseline,legacy,camera,select,reset,stop,ensureEngine,startCamera,performanceMonitor,refreshInterpretation:updateLanguageView,get needSpecialist(){return needSpecialist;},get landmarks(){return landmarks;},get pipeline(){return pipeline;},get buffer(){return pipeline?.buffer;}};
setText('');controls();
window.TecSignAI.ready=(async()=>{settings=await fetchJSON('./config/recognition.json');await select('senas');if(state.ready)void startCamera(true);})().catch(error);
