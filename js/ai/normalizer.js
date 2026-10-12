// Contract tecsign-body-v1; matching Python implementation in ai/preprocessing/features.py.
export const POSE_IDS = [0,2,5,7,8,9,10,11,12,13,14,15,16,23,24];
export const FEATURES = 174;
export function normalize({ pose, left, right, aspect = 16/9 }) {
  if (!pose || pose.length < 25 || Math.min(pose[11].visibility ?? 0,pose[12].visibility ?? 0) < .35) return null;
  const a=pose[11], b=pose[12];
  const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2};
  const dx=(b.x-a.x)*aspect, dy=b.y-a.y, scale=Math.hypot(dx,dy);
  if (!Number.isFinite(scale) || scale < .03) return null;
  const angle=Math.atan2(dx < 0 ? -dy : dy,dx < 0 ? -dx : dx), cos=Math.cos(angle),sin=Math.sin(angle);
  const out=new Float32Array(FEATURES);
  function block(points,zbase,start) {
    for(let i=0;i<points.length;i++) {
      const p=points[i], x=(p.x-center.x)*aspect,y=p.y-center.y;
      const vals=[(x*cos+y*sin)/scale,(-x*sin+y*cos)/scale,((p.z ?? 0)-zbase)*aspect/scale];
      for(let k=0;k<3;k++) out[start+i*3+k]=Math.max(-6,Math.min(6,vals[k]));
    }
  }
  block(POSE_IDS.map(i=>pose[i]),center.z,0); out[171]=1;
  for(const [hand,start,mask] of [[left,45,172],[right,108,173]]) {
    if(hand?.length === 21 && hand.every(p=>[p.x,p.y,p.z ?? 0].every(Number.isFinite))) {
      block(hand,hand[0].z ?? 0,start); out[mask]=1;
    }
  }
  return out.every(Number.isFinite) ? out : null;
}
