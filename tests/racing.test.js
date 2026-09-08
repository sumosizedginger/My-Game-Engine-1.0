import test from 'node:test';
import assert from 'node:assert/strict';
import {createInputSystem} from '../src/runtime/index.js';
import {ArcadeRace,VEHICLE,advanceCheckpoints,forwardGateCrossing} from '../src/games/racing/game.js';
import {generateTrack,TRACK_DEFINITION} from '../src/games/racing/track.js';
import {driveControlledRace} from '../src/games/racing/proof.js';
import {createChaseCamera} from '../src/games/racing/camera.js';
import {D_CHECKS,dTargetChecks} from '../src/eval/d-checks.js';

test('scalar input retains signed magnitude, remaps deadzone and clamps malformed hardware',()=>{
  const input=createInputSystem({actions:['Steer','Drive'],keyboardBindings:{}});
  input.bindScalarAxis(0,'Steer',{deadzone:0.2});input.bindScalarButton(7,'Drive');
  for(const [raw,expected] of [[0,0],[0.2,0],[-0.2,0],[0.6,0.5],[-0.6,-0.5],[2,1],[-2,-1],[NaN,0],[Infinity,0]]) {
    input.setGamepad({axes:[raw],buttons:[]});assert.ok(Math.abs(input.captureSnapshot().getActionValue('Steer')-expected)<1e-12);
  }
  input.setGamepad({axes:[],buttons:Array.from({length:8},(_,i)=>i===7?{value:0.37,pressed:false}:null)});
  assert.equal(input.captureSnapshot().getActionValue('Drive'),0.37);
  input.setGamepad({connected:false,axes:[1],buttons:[]});assert.equal(input.captureSnapshot().getActionValue('Steer'),0);
  assert.throws(()=>input.bindScalarAxis(0,'Steer',{deadzone:1}));assert.throws(()=>input.bindScalarAxis(-1,'Steer'));
  assert.throws(()=>input.bindScalarKey('KeyA','Missing'));assert.throws(()=>input.simulateActionValue('Steer',NaN));
});

test('scalar keyboard aliases, opposites, merge policy, immutable snapshots and simulation override',()=>{
  const input=createInputSystem({actions:['Steer'],keyboardBindings:{}});
  input.bindScalarKey('KeyA','Steer',-1);input.bindScalarKey('ArrowLeft','Steer',-1);input.bindScalarKey('KeyD','Steer',1);
  input.handleKeyDown({code:'KeyA'});input.handleKeyDown({code:'ArrowLeft'});
  const prior=input.captureSnapshot();assert.equal(prior.getActionValue('Steer'),-1);assert.equal(prior.getAllActions().Steer,true);
  input.handleKeyDown({code:'KeyD'});assert.equal(input.captureSnapshot().getActionValue('Steer'),0);
  input.bindScalarAxis(0,'Steer',{deadzone:0});input.setGamepad({axes:[0.35]});assert.equal(input.captureSnapshot().getActionValue('Steer'),0.35);
  input.simulateActionValue('Steer',-5);assert.equal(input.captureSnapshot().getActionValue('Steer'),-1);
  input.simulateActionValue('Steer',0);assert.equal(input.captureSnapshot().getActionValue('Steer'),0);
  assert.equal(prior.getActionValue('Steer'),-1);assert.ok(Object.isFrozen(prior.getAllActionValues()));
  assert.throws(()=>{prior.getAllActionValues().Steer=0;});
  input.clear();assert.equal(input.captureSnapshot().getActionValue('Steer'),0);
  input.bindScalarAxis(0,null);input.bindScalarKey('KeyA',null);input.bindScalarButton(0,null);
});

test('sparse navigator scalar discovery and reconnect preserve legacy boolean threshold behavior',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let pads=[null,null,{index:2,connected:true,axes:[0.55],buttons:[]}];
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>pads}});
  try {
    const input=createInputSystem({actions:['Left','Right','Steer'],keyboardBindings:{}});
    input.bindGamepadAxis(0,'Left','Right',{deadzone:0.4});input.bindScalarAxis(0,'Steer',{deadzone:0});
    let s=input.captureSnapshot();assert.deepEqual(s.getAllActions(),{Left:false,Right:true,Steer:true});assert.equal(s.getActionValue('Steer'),0.55);
    pads[2].connected=false;s=input.captureSnapshot();assert.deepEqual(s.getAllActions(),{Left:false,Right:false,Steer:false});
    pads=[null,{index:1,connected:true,axes:[-0.3],buttons:[]}];s=input.captureSnapshot();
    assert.equal(s.isActionActive('Left'),false);assert.equal(s.getActionValue('Steer'),-0.3);
  } finally {if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});

test('track is deterministic, finite, upward-wound, and all edges and gates share source samples',()=>{
  const a=generateTrack(),b=generateTrack();
  assert.equal(a.artifact.hash,b.artifact.hash);assert.deepEqual(a.geometry.attributes.position.array,b.geometry.attributes.position.array);
  const pos=a.geometry.attributes.position,idx=a.geometry.index.array;
  assert.ok([...pos.array].every(Number.isFinite));
  for(let i=0;i<idx.length;i+=3){const [u,v,w]=idx.slice(i,i+3);assert.ok(w<pos.count);
    const y=(pos.getZ(v)-pos.getZ(u))*(pos.getX(w)-pos.getX(u))-(pos.getX(v)-pos.getX(u))*(pos.getZ(w)-pos.getZ(u));assert.ok(y>0);}
  for(const wall of a.walls){const points=wall.side==='inner'?a.inner:a.outer;assert.ok(points.includes(wall.a));assert.ok(points.includes(wall.b));}
  for(const gate of a.gates){assert.equal(gate.a,a.inner[gate.index]);assert.equal(gate.b,a.outer[gate.index]);assert.equal(gate.heading,a.samples[gate.index].heading);}
  assert.ok(a.contains(a.spawn,VEHICLE.radius));assert.ok(Object.isFrozen(a.gates[0].tangent));
  const changed=generateTrack({...TRACK_DEFINITION,data:{...TRACK_DEFINITION.data,width:11}});assert.notEqual(a.artifact.hash,changed.artifact.hash);
  changed.dispose();a.dispose();b.dispose();
});

test('every inner and outer wall stops a disk, including large displacement and corner approaches',()=>{
  const track=generateTrack();
  for(const w of track.walls){const mid={x:(w.a.x+w.b.x)/2,z:(w.a.z+w.b.z)/2},from={x:mid.x+w.normal.x*2,z:mid.z+w.normal.z*2};
    const to={x:mid.x-w.normal.x*3,z:mid.z-w.normal.z*3},result=track.resolveMovement(from,to,VEHICLE.radius);
    assert.ok(result.blocked,w.id);assert.ok(track.contains(result,VEHICLE.radius),w.id);
    const repeat=track.resolveMovement(from,to,VEHICLE.radius);assert.deepEqual(result,repeat);
  }
  for(const i of [0,16,32,48,64,80,96,112]){
    const from=track.samples[i],edge=track.outer[(i+1)%128];
    const result=track.resolveMovement(from,{x:edge.x*2,z:edge.z*2},VEHICLE.radius);assert.ok(result.blocked);assert.ok(track.contains(result,VEHICLE.radius));
  }
  track.dispose();
});

const crossing=(gate,reverse=false)=>{const a={x:gate.x-gate.tangent.x,z:gate.z-gate.tangent.z},b={x:gate.x+gate.tangent.x,z:gate.z+gate.tangent.z};return reverse?[b,a]:[a,b];};
test('ordered gates reject skipping, reverse, repeated finish, out-of-width crossing and spawn',()=>{
  const track=generateTrack(),race={next:1,laps:0,records:[]};
  assert.equal(advanceCheckpoints(race,track,...crossing(track.gates[0]),1),false);
  assert.equal(advanceCheckpoints(race,track,...crossing(track.gates[2]),2),false);
  assert.equal(advanceCheckpoints(race,track,...crossing(track.gates[1],true),3),false);
  assert.equal(forwardGateCrossing(track.gates[0],track.spawn,track.spawn),false);
  const far=crossing(track.gates[1]).map(p=>({x:p.x+20*track.gates[1].tangent.z,z:p.z-20*track.gates[1].tangent.x}));
  assert.equal(advanceCheckpoints(race,track,...far,4),false);
  for(let i=1;i<=8;i++)assert.equal(advanceCheckpoints(race,track,...crossing(track.gates[i%8]),i+5),true);
  assert.equal(race.laps,1);assert.equal(advanceCheckpoints(race,track,...crossing(track.gates[0]),20),false);
  assert.equal(advanceCheckpoints(race,track,...crossing(track.gates[0],true),21),false);track.dispose();
});

test('vehicle accelerates, brakes, steers and commits through one existing transform authority',()=>{
  const game=new ArcadeRace();game.input.simulateActionValue('Throttle',1);for(let i=0;i<180;i++)game.update();
  let commits=0;const commit=game.transforms.commitAll;game.transforms.commitAll=function(dt){commits++;return commit.call(this,dt);};
  for(let i=0;i<40;i++)game.update();assert.equal(commits,40);assert.ok(game.speed>5);
  const speed=game.speed,heading=game.heading;game.input.simulateActionValue('Throttle',0);game.input.simulateActionValue('Brake',1);game.input.simulateActionValue('Steer',0.5);
  for(let i=0;i<8;i++)game.update();assert.ok(game.speed<speed);assert.ok(game.heading<heading);
  assert.equal(game.transform.ownership,'KINEMATIC');assert.ok(game.transform.position.z>game.track.spawn.z);
  game.reset();assert.equal(game.speed,0);assert.equal(game.raceTicks,0);assert.equal(game.race.next,1);assert.deepEqual(game.transform.position,game.transform.previousPosition);
  assert.deepEqual(game.transform.velocity,{x:0,y:0,z:0});game.dispose();assert.equal(game.entities.isValid(game.handle),false);assert.throws(()=>game.update());
});

test('keyboard and analog controller steer toward vehicle-relative left/right, including reverse',()=>{
  for(const [device,value] of [['KeyA',-1],['ArrowLeft',-1],['KeyD',1],['ArrowRight',1],['pad',-0.575],['pad',0.575]]) {
    for(const speed of [8,-4]) {
      const game=new ArcadeRace();game.state.transition('COUNTDOWN');game.state.transition('RACING');game.speed=speed;
      if(device==='pad')game.input.setGamepad({connected:true,axes:[value],buttons:[]});
      else game.input.handleKeyDown({code:device});
      const before={...game.transform.position},heading=game.heading;
      // Vehicle-right = forward cross world-up, independently of yaw integration.
      const right={x:-Math.cos(heading),z:Math.sin(heading)};
      game.update();
      const after=game.transform.position,lateral=(after.x-before.x)*right.x+(after.z-before.z)*right.z;
      assert.ok(lateral*Math.sign(value)>0,`${device} ${value}, speed ${speed}: lateral ${lateral}`);
      assert.ok((game.heading-heading)*Math.sign(value)*Math.sign(speed)<0);
      game.dispose();
    }
  }
});

test('controlled driving repeats exact state with real collision and ordered two-lap finish; reset restarts',()=>{
  const a=new ArcadeRace(),b=new ArcadeRace();const ma=driveControlledRace(a),mb=driveControlledRace(b);
  assert.deepEqual(a.snapshot(),b.snapshot());assert.ok(ma.contained&&mb.contained);assert.ok(a.blockedSteps>0);assert.equal(a.race.laps,2);
  assert.equal(a.state.getState(),'FINISHED');assert.equal(a.race.records.length,16);assert.ok(a.distance>400);
  a.input.simulateAction('Reset',true);a.update();assert.equal(a.state.getState(),'READY');assert.equal(a.race.records.length,0);assert.equal(a.speed,0);
  a.input.clear();a.update();assert.equal(a.state.getState(),'READY');a.dispose();b.dispose();
});

test('camera orbit is bounded and changes presentation only; controlled pose ignores input',()=>{
  const game=new ArcadeRace(),before=game.snapshot(),camera=createChaseCamera(),fixed=createChaseCamera(true);
  const first=camera.pose(before.position,0),controlled=fixed.pose(before.position,0);
  for(let i=0;i<100;i++){camera.update(1,1/60);fixed.update(-1,1/60);}
  assert.equal(camera.orbit,1.1);assert.notDeepEqual(camera.pose(before.position,0),first);assert.deepEqual(game.snapshot(),before);
  assert.deepEqual(fixed.pose({x:99,y:12,z:100},2),controlled);
  game.input.simulateActionValue('CameraOrbit',1);game.update();assert.equal(game.speed,0);assert.equal(game.race.records.length,0);game.dispose();
});

test('D evaluator rejects missing, non-boolean, failed motion/collision/progression and page summary',()=>{
  const good={httpStatus:200,dProof:{success:true,checks:Object.fromEntries(D_CHECKS.map(k=>[k,true]))}};
  assert.ok(Object.values(dTargetChecks(good)).every(Boolean));
  for(const key of D_CHECKS){const bad=structuredClone(good);bad.dProof.checks[key]=false;assert.equal(dTargetChecks(bad)[key],false);bad.dProof.checks[key]='true';assert.equal(dTargetChecks(bad)[key],false);}
  const failed=structuredClone(good);failed.dProof.success=false;assert.equal(dTargetChecks(failed).dPageProofSuccess,false);
  assert.ok(Object.values(dTargetChecks(null)).every(v=>v===false));
});
