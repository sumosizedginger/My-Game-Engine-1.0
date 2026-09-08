import {angleDelta,VEHICLE} from './game.js';
import {Matrix4,Vector3} from 'three';

// A semantic driver steers toward a lookahead on the real centerline.
// It never writes position, heading, race progress, or collision results.
export function controlledInput(game) {
  if(game.raceTicks<135)return {Throttle:0.9,Brake:0,Steer:0}; // Deliberate outer-barrier impact.
  const p=game.transform.position,index=game.track.nearestSample(p),target=game.track.samples[(index+5)%game.track.samples.length];
  const error=angleDelta(Math.atan2(target.x-p.x,target.z-p.z),game.heading);
  return {Throttle:game.speed<18?0.85:0.3,Brake:game.speed>20?0.2:0,Steer:Math.max(-1,Math.min(1,-error*2.4))};
}
export function driveControlledRace(game,onStep=()=>{}) {
  let minClearance=Infinity,contained=true,analogThrottle=false,analogSteer=false,observedDistance=0;const times=[];
  for(let i=0;i<6000&&game.state.getState()!=='FINISHED';i++) {
    const input=controlledInput(game);
    for(const [action,value] of Object.entries(input))game.input.simulateActionValue(action,value);
    const snapshot=game.input.captureSnapshot(),throttle=snapshot.getActionValue('Throttle'),steer=snapshot.getActionValue('Steer');
    analogThrottle ||= throttle>0&&throttle<1&&throttle===input.Throttle;
    analogSteer ||= Math.abs(steer)>0&&Math.abs(steer)<1&&steer===input.Steer;
    const before={...game.transform.position};
    const start=performance.now();game.update();times.push(performance.now()-start);
    observedDistance+=Math.hypot(game.transform.position.x-before.x,game.transform.position.z-before.z);
    contained&&=game.track.contains(game.transform.position,VEHICLE.radius);
    minClearance=Math.min(minClearance,game.track.nearestWall(game.transform.position).distance);onStep();
  }
  return {contained,minClearance,analog:analogThrottle&&analogSteer,observedDistance,stepMeanMs:times.reduce((a,b)=>a+b,0)/times.length,steps:times.length};
}
export function runControlledRacingProof(game,view) {
  if(game.ticks!==0)throw new Error('D_PROOF_REQUIRES_FRESH_GAME');
  const camera=view.camera.position.toArray(),metrics=driveControlledRace(game),state=game.snapshot(),track=game.track;
  view.render();
  const positions=track.geometry.attributes.position,normal=track.geometry.attributes.normal;
  let meshTruth=positions.count===256&&track.geometry.index.count===768;
  for(let i=0;i<128;i++)for(const [j,point] of [[0,track.inner[i]],[1,track.outer[i]]]) {
    const k=i*2+j;meshTruth&&=Math.abs(positions.getX(k)-point.x)<1e-5&&Math.abs(positions.getZ(k)-point.z)<1e-5&&normal.getY(k)===1;
  }
  let wallTruth=true;const matrix=new Matrix4(),point=new Vector3();
  track.walls.forEach((w,i)=>{
    view.barriers.getMatrixAt(i,matrix);
    // Independently read the rendered box face at each segment midpoint.
    const localX=w.side==='outer'?-0.5:0.5;
    point.set(localX,0,0).applyMatrix4(matrix);
    wallTruth&&=Math.hypot(point.x-(w.a.x+w.b.x)/2,point.z-(w.a.z+w.b.z)/2)<1e-5;
  });
  const records=state.race.records;
  const order=records.length===16&&records.every((r,i)=>r.checkpoint===(i+1)%8&&r.lap===Math.floor(i/8)+1&&r.tick>(records[i-1]?.tick??0));
  const gateTruth=track.gates.every((g,i)=>{const rendered=view.gateGroups[i];return rendered&&rendered.position.x===g.x&&rendered.position.z===g.z&&rendered.rotation.y===g.heading;});
  const checks={dTrackGeneration:meshTruth&&gateTruth&&track.gates.length===8&&view.car.children.length>5,
    dVehicleMotion:metrics.observedDistance>400&&Math.abs(metrics.observedDistance-state.distance)<1e-6&&state.maxSpeed>10&&state.headingTravel>8,
    dAnalogInput:metrics.analog,dBarrierCollision:wallTruth&&metrics.contained&&state.blockedSteps>0&&metrics.minClearance>=VEHICLE.radius-1e-6,
    dCheckpointProgress:order,dRaceFinish:state.state==='FINISHED'&&state.race.laps===2&&order&&state.raceTicks>600,
    dControlledCamera:camera.every((v,i)=>v===view.camera.position.toArray()[i])};
  return {success:Object.values(checks).every(v=>v===true),checks,state,
    canonical:{definition:track.artifact.data,trackHash:track.artifact.hash,state},
    metrics:{...track.metrics,...metrics,drawCalls:view.renderer.info.render.calls,renderTriangles:view.renderer.info.render.triangles},
    diagnosticsRecords:Object.entries(checks).map(([code,passed])=>({severity:passed?'INFO':'ERROR',code,step:state.ticks,subsystem:'proof-d',message:passed?'Proof check passed':'Proof check failed'}))};
}
