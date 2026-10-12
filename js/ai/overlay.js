const EDGES=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
export function draw(canvas,video,{pose,hands=[]}) {
  if(canvas.width!==video.videoWidth || canvas.height!==video.videoHeight) {canvas.width=video.videoWidth;canvas.height=video.videoHeight;}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  function lines(points,edges,color) {
    ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();
    for(const [a,b] of edges) if(points[a] && points[b]) {ctx.moveTo(points[a].x*canvas.width,points[a].y*canvas.height);ctx.lineTo(points[b].x*canvas.width,points[b].y*canvas.height);}
    ctx.stroke();ctx.fillStyle=color;
    for(const p of points){ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,3,0,Math.PI*2);ctx.fill();}
  }
  if(pose)lines(pose,[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]],'#42c8ff');
  hands.forEach((hand,i)=>lines(hand,EDGES,i?'#ffbd45':'#46ee87'));
}

export function drawMinimal(canvas,video,{pose,hands=[]}){
  if(canvas.width!==video.videoWidth || canvas.height!==video.videoHeight){canvas.width=video.videoWidth;canvas.height=video.videoHeight;}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  function group(points,edges,ids,color){
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.beginPath();
    for(const [a,b] of edges)if(points[a] && points[b]){ctx.moveTo(points[a].x*canvas.width,points[a].y*canvas.height);ctx.lineTo(points[b].x*canvas.width,points[b].y*canvas.height);}
    ctx.stroke();ctx.beginPath();for(const id of ids){const p=points[id];if(p){ctx.moveTo(p.x*canvas.width+2.5,p.y*canvas.height);ctx.arc(p.x*canvas.width,p.y*canvas.height,2.5,0,Math.PI*2);}}ctx.fill();
  }
  if(pose)group(pose,[[11,12],[11,13],[13,15],[12,14],[14,16]],[11,12,13,14,15,16],'#42c8ff');
  hands.forEach((h,i)=>group(h,EDGES,h.keys(),i?'#ffbd45':'#46ee87'));
}
