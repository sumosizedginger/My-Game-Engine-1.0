import { BufferGeometry, Float32BufferAttribute } from 'three';
import { compileDefinition } from '../../full/index.js';

export const TRACK_DEFINITION = Object.freeze({ id:'copper-loop', type:'arcade-circuit', data:Object.freeze({
  radiusX:44, radiusZ:29, width:12, samples:128, gates:8, laps:2, barrierHeight:0.9, barrierThickness:0.45
}) });

export function closestPoint(p,a,b) {
  const x=b.x-a.x,z=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z)));
  return {x:a.x+t*x,z:a.z+t*z};
}
function inside(p,polygon) {
  let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)yes=!yes;
  }
  return yes;
}
function freeze(value) {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}

export function generateTrack(definition=TRACK_DEFINITION) {
  const start=performance.now(),artifact=compileDefinition(definition),p=artifact.data;
  if(!Number.isFinite(p.radiusX)||p.radiusX<36||p.radiusX>54||!Number.isFinite(p.radiusZ)||p.radiusZ<25||p.radiusZ>36||
    !Number.isFinite(p.width)||p.width<9||p.width>13||p.samples!==128||p.gates!==8||![1,2].includes(p.laps)||
    p.barrierHeight!==0.9||p.barrierThickness!==0.45)throw new Error('D_TRACK_DEFINITION_INVALID');
  const samples=[],inner=[],outer=[];
  for(let i=0;i<p.samples;i++) {
    const a=i*2*Math.PI/p.samples,x=p.radiusX*Math.cos(a),z=p.radiusZ*Math.sin(a);
    const dx=-p.radiusX*Math.sin(a),dz=p.radiusZ*Math.cos(a),length=Math.hypot(dx,dz);
    const tangent={x:dx/length,z:dz/length},normal={x:tangent.z,z:-tangent.x};
    samples.push({x,z,tangent,heading:Math.atan2(tangent.x,tangent.z)});
    inner.push({x:x-normal.x*p.width/2,z:z-normal.z*p.width/2});
    outer.push({x:x+normal.x*p.width/2,z:z+normal.z*p.width/2});
  }
  const walls=[];
  for(const [side,points] of [['outer',outer],['inner',inner]])for(let i=0;i<p.samples;i++) {
    const a=points[i],b=points[(i+1)%p.samples],length=Math.hypot(b.x-a.x,b.z-a.z),sign=side==='outer'?-1:1;
    walls.push({id:`${side}-${i}`,side,a,b,length,normal:{x:sign*(b.z-a.z)/length,z:-sign*(b.x-a.x)/length},height:p.barrierHeight,thickness:p.barrierThickness});
  }
  const gates=Array.from({length:p.gates},(_,id)=>{const index=id*p.samples/p.gates,s=samples[index];
    return {id,index,...s,halfWidth:p.width/2,a:inner[index],b:outer[index]};});
  const positions=[],normals=[],indices=[];
  for(let i=0;i<p.samples;i++)for(const point of [inner[i],outer[i]]){positions.push(point.x,0,point.z);normals.push(0,1,0);}
  for(let i=0;i<p.samples;i++){const a=2*i,b=2*((i+1)%p.samples);indices.push(a,b,a+1,a+1,b,b+1);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));geometry.setIndex(indices);geometry.computeBoundingSphere();
  geometry.userData.definitionId=artifact.id;
  function nearestWall(point) {
    let best=null;
    for(const wall of walls){const q=closestPoint(point,wall.a,wall.b),distance=Math.hypot(point.x-q.x,point.z-q.z);
      if(!best||distance<best.distance)best={wall,distance};}
    return best;
  }
  function contains(point,radius=0) {
    return Number.isFinite(point.x)&&Number.isFinite(point.z)&&inside(point,outer)&&!inside(point,inner)&&nearestWall(point).distance>=radius-1e-8;
  }
  function resolveMovement(from,to,radius) {
    if(!Number.isFinite(radius)||radius<0.5||radius>2||!contains(from,radius))throw new Error('D_COLLISION_INVALID_START');
    const distance=Math.hypot(to.x-from.x,to.z-from.z),count=Math.max(1,Math.ceil(distance/0.2));
    if(!Number.isFinite(distance)||count>10000)throw new Error('D_COLLISION_INVALID_DISPLACEMENT');
    let result={x:from.x,z:from.z},blocked=false;
    const delta={x:(to.x-from.x)/count,z:(to.z-from.z)/count};
    for(let i=0;i<count;i++) {
      const candidate={x:result.x+delta.x,z:result.z+delta.z};
      if(contains(candidate,radius)){result=candidate;continue;}
      blocked=true;let lo=0,hi=1;
      // Every subsegment is smaller than the collision disk. Find its contact.
      for(let j=0;j<16;j++){const t=(lo+hi)/2;if(contains({x:result.x+delta.x*t,z:result.z+delta.z*t},radius))lo=t;else hi=t;}
      result={x:result.x+delta.x*lo,z:result.z+delta.z*lo};
      const n=nearestWall(candidate).wall.normal,dot=delta.x*n.x+delta.z*n.z;
      const slide={x:result.x+(delta.x-n.x*dot)*(1-lo),z:result.z+(delta.z-n.z*dot)*(1-lo)};
      if(contains(slide,radius))result=slide;
    }
    return {...result,blocked};
  }
  function nearestSample(point) {
    let index=0,distance=Infinity;
    samples.forEach((s,i)=>{const d=Math.hypot(point.x-s.x,point.z-s.z);if(d<distance){distance=d;index=i;}});
    return index;
  }
  freeze(samples);freeze(inner);freeze(outer);freeze(walls);freeze(gates);
  return {artifact,samples,inner,outer,walls,gates,geometry,contains,nearestWall,nearestSample,resolveMovement,
    spawn:freeze({x:samples[0].x,y:0.6,z:samples[0].z,heading:samples[0].heading}),
    metrics:{generationMs:performance.now()-start,vertices:positions.length/3,triangles:indices.length/3,barriers:walls.length,checkpoints:gates.length},
    dispose(){geometry.dispose();}};
}
