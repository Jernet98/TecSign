import { loadScript } from './loader.js';
export function visibleHand(hand){
  const inside=p=>p.x>=0 && p.x<=1 && p.y>=0 && p.y<=1;
  return hand?.length===21 && hand.every(p=>[p.x,p.y,p.z ?? 0].every(Number.isFinite)) && inside(hand[0]) && hand.filter(inside).length>=16;
}
export class LandmarkEngine {
  async load(kind='holistic') {
    await this.close();this.kind=kind;
    const base=new URL(`../../web/vendor/${kind}/`,import.meta.url).href;
    await loadScript(base+`${kind}.js`);
    this.engine=kind==='holistic' ? new globalThis.Holistic({locateFile:file=>base+file}) : new globalThis.Hands({locateFile:file=>base+file});
    this.engine.setOptions(kind==='holistic' ? {
      modelComplexity:1,smoothLandmarks:true,enableSegmentation:false,refineFaceLandmarks:false,
      minDetectionConfidence:.5,minTrackingConfidence:.5,
    } : {maxNumHands:2,modelComplexity:1,minDetectionConfidence:.5,minTrackingConfidence:.5});
    this.engine.onResults(results=> { this.latest=results; });
    await this.engine.initialize();
  }
  async detect(image) {
    const start=performance.now();this.latest=null;
    const width=image.videoWidth || image.width,height=image.videoHeight || image.height;
    if(width>960){
      if(!this.input)this.input=document.createElement('canvas');
      const targetHeight=Math.round(height*960/width);
      if(this.input.width!==960 || this.input.height!==targetHeight){this.input.width=960;this.input.height=targetHeight;}
      this.input.getContext('2d').drawImage(image,0,0,960,targetHeight);image=this.input;
    }
    const converted=performance.now();await this.engine.send({image});
    const profile={conversionMs:converted-start,mediaPipeMs:performance.now()-converted};
    const r=this.latest || {};
    if(this.kind==='holistic') {
      const left=visibleHand(r.leftHandLandmarks)?r.leftHandLandmarks:undefined,right=visibleHand(r.rightHandLandmarks)?r.rightHandLandmarks:undefined;
      return {pose:r.poseLandmarks,left,right,hands:[right,left].filter(Boolean),latencyMs:performance.now()-start,profile:{...profile,facePoints:r.faceLandmarks?.length || 0}};
    }
    const hands=r.multiHandLandmarks || [];
    // MediaPipe Hands labels assume mirrored selfie input; images are unmirrored here.
    const result={hands:[],latencyMs:performance.now()-start,profile};
    hands.forEach((h,i)=> { if(visibleHand(h)){result.hands.push(h);result[r.multiHandedness?.[i]?.label==='Left'?'right':'left']=h;} });
    return result;
  }
  async close() { if(this.engine) await this.engine.close();this.engine=null; }
}
