import {loadScript} from './loader.js';
import {visibleHand} from './landmark-engine.js';

// Señas-only path. The ABC detector stays in LandmarkEngine unchanged.
export class FastLandmarkEngine {
  constructor(config={}){this.config={width:640,poseComplexity:1,handComplexity:1,poseEvery:1,poseMaxAgeMs:120,...config};this.kind='hands-pose';}
  async load(){
    await this.close();
    const handBase=new URL('../../web/vendor/hands/',import.meta.url).href,poseBase=new URL('../../web/vendor/pose/',import.meta.url).href;
    await loadScript(handBase+'hands.js');this.handsEngine=new globalThis.Hands({locateFile:f=>handBase+f});
    this.handsEngine.setOptions({maxNumHands:2,modelComplexity:this.config.handComplexity,minDetectionConfidence:.5,minTrackingConfidence:.5});
    this.handsEngine.onResults(r=>{this.handResult=r;});await this.handsEngine.initialize();
    await loadScript(poseBase+'pose.js');this.poseEngine=new globalThis.Pose({locateFile:f=>poseBase+f});
    this.poseEngine.setOptions({modelComplexity:this.config.poseComplexity,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:.5,minTrackingConfidence:.5});
    this.poseEngine.onResults(r=>{this.poseResult=r;});await this.poseEngine.initialize();
    this.input=document.createElement('canvas');this.context=this.input.getContext('2d');this.frame=0;
  }
  async detect(image,time=performance.now()){
    const started=performance.now(),width=image.videoWidth || image.width,height=image.videoHeight || image.height;
    const targetWidth=Math.min(width,this.config.width),targetHeight=Math.round(height*targetWidth/width);
    if(this.input.width!==targetWidth || this.input.height!==targetHeight){this.input.width=targetWidth;this.input.height=targetHeight;}
    this.context.drawImage(image,0,0,targetWidth,targetHeight);const converted=performance.now();
    if(time<this.lastSourceTime){this.poseResult=null;this.frame=0;}this.lastSourceTime=time;
    this.handResult=null;const updatePose=this.frame++%this.config.poseEvery===0 || !this.poseResult || time-this.poseTime>this.config.poseMaxAgeMs;
    let handMs=0,poseMs=0;
    const handStart=performance.now(),handTask=this.handsEngine.send({image:this.input}).then(()=>{handMs=performance.now()-handStart;});
    const poseStart=performance.now(),poseTask=updatePose?this.poseEngine.send({image:this.input}).then(()=>{poseMs=performance.now()-poseStart;this.poseTime=time;}):Promise.resolve();
    await Promise.all([handTask,poseTask]);
    const detected=performance.now(),r=this.handResult || {},pose=time-this.poseTime<=this.config.poseMaxAgeMs?this.poseResult?.poseLandmarks:undefined;
    const result={pose,hands:[],latencyMs:detected-started,profile:{conversionMs:converted-started,mediaPipeMs:detected-converted,handMs,poseMs,poseReused:!updatePose,poseAgeMs:time-this.poseTime,facePoints:0}};
    const handList=r.multiHandLandmarks || [];
    // Hands handedness assumes a mirrored input. The camera image is unmirrored.
    for(let i=0;i<handList.length;i++)if(visibleHand(handList[i])){
      const hand=handList[i],side=r.multiHandedness?.[i]?.label==='Left'?'right':'left';
      result[side]=hand;result.hands.push(hand);
    }
    return result;
  }
  async close(){await this.handsEngine?.close();await this.poseEngine?.close();this.handsEngine=null;this.poseEngine=null;}
}
