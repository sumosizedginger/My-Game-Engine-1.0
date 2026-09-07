import {Scene,Color,Fog,PerspectiveCamera,WebGLRenderer,HemisphereLight,DirectionalLight,Mesh,Group,InstancedMesh,Object3D,BufferGeometry,Float32BufferAttribute,Vector3} from 'three';
import {buildBoxGeometry} from '../../geometry/index.js';
import {compileMaterial} from '../../material/index.js';
import {createChaseCamera,interpolatedVehicle} from './camera.js';

export function createRacingRenderer(container,game,controlled=false) {
  const scene=new Scene();scene.background=new Color('#ddb798');scene.fog=new Fog('#ddb798',140,320);
  const camera=new PerspectiveCamera(controlled?48:62,1,0.1,350),policy=createChaseCamera(controlled);
  const renderer=new WebGLRenderer({antialias:true});container.appendChild(renderer.domElement);renderer.domElement.style.display='block';
  const geometries=new Set(),materials=new Set(),labels=[];
  const material=(id,color,extra={})=>{const m=compileMaterial({id,parameters:{color,roughness:0.75,...extra}});materials.add(m);return m;};
  const box=(width,height,depth)=>{const g=buildBoxGeometry({width,height,depth});geometries.add(g);return g;};
  const roadMat=material('copper-asphalt','#283b43'),sandMat=material('copper-sand','#b88b65'),wallMat=material('copper-wall','#e8d3ae');
  const cyan=material('copper-cyan','#83f1dc',{emissive:'#2c8c85',emissiveIntensity:0.5});
  const orange=material('copper-car','#f26b37',{metalness:0.25}),dark=material('copper-glass','#142b38',{metalness:0.6,roughness:0.2});
  const white=material('copper-white','#fff0cf'),black=material('copper-black','#1a292f');
  const floor=new Mesh(box(300,0.5,260),sandMat);floor.position.y=-0.35;scene.add(floor);
  scene.add(new Mesh(game.track.geometry,roadMat));
  scene.add(new HemisphereLight('#f4efda','#725345',2.5));const sun=new DirectionalLight('#ffe4ba',3);sun.position.set(-30,60,-20);scene.add(sun);
  const object=new Object3D();
  function instances(geometry,mat,records,place) {
    const mesh=new InstancedMesh(geometry,mat,records.length);
    records.forEach((r,i)=>{object.position.set(0,0,0);object.rotation.set(0,0,0);object.scale.set(1,1,1);place(r,object,i);object.updateMatrix();mesh.setMatrixAt(i,object.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);return mesh;
  }
  // Inner face of every box is exactly its authoritative collision segment.
  const barriers=instances(box(1,1,1),wallMat,game.track.walls,(w,o)=>{
    o.position.set((w.a.x+w.b.x)/2-w.normal.x*w.thickness/2,w.height/2,(w.a.z+w.b.z)/2-w.normal.z*w.thickness/2);
    o.rotation.y=Math.atan2(w.b.x-w.a.x,w.b.z-w.a.z);o.scale.set(w.thickness,w.height,w.length);
  });
  barriers.userData.wallIds=game.track.walls.map(w=>w.id);
  instances(box(0.1,0.06,1),cyan,game.track.walls,(w,o)=>{o.position.set((w.a.x+w.b.x)/2,w.height+0.04,(w.a.z+w.b.z)/2);o.rotation.y=Math.atan2(w.b.x-w.a.x,w.b.z-w.a.z);o.scale.z=w.length;});
  instances(box(0.16,0.02,1.8),white,game.track.samples.filter((_,i)=>i%3===0),(s,o)=>{o.position.set(s.x,0.025,s.z);o.rotation.y=s.heading;});
  const gateGroups=[];
  for(const gate of game.track.gates) {
    const group=new Group();group.position.set(gate.x,0,gate.z);group.rotation.y=gate.heading;
    for(const sign of [-1,1]){const post=new Mesh(box(0.35,3.8,0.4),cyan);post.position.set(sign*(gate.halfWidth-0.2),1.9,0);group.add(post);}
    const lintel=new Mesh(box(gate.halfWidth*2,0.3,0.45),gate.id===0?orange:cyan);lintel.position.y=3.8;group.add(lintel);
    const label=document.createElement('span');label.className='d-gate-label';label.textContent=gate.id===0?'FINISH':`GATE ${gate.id}`;
    container.appendChild(label);labels.push({element:label,point:new Vector3(gate.x,4.7,gate.z)});
    // Arrow triangles lie on the pavement, pointing along the gate tangent.
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([-0.7,0.03,-1.7,0,0.03,-0.5,0.7,0.03,-1.7],3));g.computeVertexNormals();geometries.add(g);
    group.add(new Mesh(g,cyan));scene.add(group);gateGroups.push(group);
  }
  const start=game.track.gates[0];
  const tileWidth=game.track.artifact.data.width/12;
  for(let x=0;x<12;x++)for(let z=0;z<2;z++){const tile=new Mesh(box(tileWidth,0.025,0.7),(x+z)%2?black:white);
    tile.position.set(start.x+(x-5.5)*tileWidth,0.04,start.z+z*0.7);scene.add(tile);}
  // Low infield pylons provide scale without hiding the course.
  instances(box(2,1,2),sandMat,Array.from({length:12},(_,i)=>i),(i,o)=>{const a=i*Math.PI/6;o.position.set(Math.cos(a)*18,1.5,Math.sin(a)*10);o.scale.y=3+(i%3);});
  const car=new Group();scene.add(car);
  const part=(geometry,mat,x,y,z)=>{const m=new Mesh(geometry,mat);m.position.set(x,y,z);car.add(m);return m;};
  part(box(1.45,0.4,2),orange,0,0,0);
  part(box(0.9,0.4,0.85),dark,0,0.35,-0.12);
  part(box(1.5,0.13,0.25),orange,0,0.35,-0.8);
  for(const x of [-0.8,0.8]){part(box(0.25,0.3,1.5),black,x,-0.14,0);part(box(0.18,0.1,0.55),cyan,x,-0.25,-0.45);}
  for(const x of [-0.45,0.45])part(box(0.28,0.1,0.08),white,x,0.1,1.03);
  function resize(){const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  let disposed=false;
  function render(alpha=1,dt=0) {
    if(disposed)return;
    policy.update(controlled?0:game.input.captureSnapshot().getActionValue('CameraOrbit'),dt);
    const pose=interpolatedVehicle(game,alpha);car.position.copy(pose.position);car.rotation.y=pose.heading;
    const c=policy.pose(pose.position,pose.heading);camera.position.copy(c.position);camera.lookAt(c.target.x,c.target.y,c.target.z);
    renderer.render(scene,camera);
    for(const label of labels){const p=label.point.clone().project(camera);label.element.hidden=p.z<-1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;
      label.element.style.left=`${(p.x+1)*container.clientWidth/2}px`;label.element.style.top=`${(1-p.y)*container.clientHeight/2}px`;}
  }
  resize();render();
  return {scene,camera,renderer,car,barriers,gateGroups,policy,render,resize,
    dispose(){if(disposed)return;disposed=true;scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());labels.forEach(l=>l.element.remove());renderer.dispose();renderer.domElement.remove();scene.clear();}};
}
