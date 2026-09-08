import {createInputSystem,createEntityManager,createTransformManager,createSimulationClock,createStateManager} from '../../runtime/index.js';
import {generateTrack} from './track.js';

export const VEHICLE=Object.freeze({radius:1.25,acceleration:16,braking:25,drag:0.35,maxSpeed:29,reverseSpeed:7});
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function createRacingInput() {
  const input=createInputSystem({actions:['Steer','Throttle','Brake','Reset','CameraOrbit'],keyboardBindings:{KeyR:'Reset'}});
  for(const [code,action,value] of [['KeyA','Steer',-1],['ArrowLeft','Steer',-1],['KeyD','Steer',1],['ArrowRight','Steer',1],
    ['KeyW','Throttle',1],['ArrowUp','Throttle',1],['KeyS','Brake',1],['ArrowDown','Brake',1],['KeyQ','CameraOrbit',-1],['KeyE','CameraOrbit',1]])input.bindScalarKey(code,action,value);
  input.bindScalarAxis(0,'Steer');input.bindScalarAxis(2,'CameraOrbit');input.bindScalarButton(7,'Throttle');input.bindScalarButton(6,'Brake');
  input.bindGamepadButton(3,'Reset');return input;
}
export function forwardGateCrossing(gate,from,to,radius=VEHICLE.radius) {
  const signed=p=>(p.x-gate.x)*gate.tangent.x+(p.z-gate.z)*gate.tangent.z,a=signed(from),b=signed(to);
  if(!(a<0&&b>=0&&b>a))return false;
  const t=-a/(b-a),x=from.x+(to.x-from.x)*t-gate.x,z=from.z+(to.z-from.z)*t-gate.z;
  return Math.abs(x*gate.tangent.z-z*gate.tangent.x)<=gate.halfWidth-radius;
}
export function advanceCheckpoints(race,track,from,to,tick) {
  if(!forwardGateCrossing(track.gates[race.next],from,to))return false;
  race.records.push({checkpoint:race.next,lap:race.laps+1,tick});
  if(race.next===0)race.laps++;
  race.next=(race.next+1)%track.gates.length;return true;
}
export class ArcadeRace {
  constructor(definition) {
    this.track=generateTrack(definition);this.input=createRacingInput();this.clock=createSimulationClock();
    this.entities=createEntityManager();this.transforms=createTransformManager(this.entities);this.handle=this.entities.spawn('racer');
    this.transform=this.transforms.setTransform(this.handle,{position:this.track.spawn,ownership:'KINEMATIC'});
    this.state=createStateManager({initialState:'READY',validStates:['READY','COUNTDOWN','RACING','FINISHED']});
    this.disposed=false;this.resetHeld=false;this.reset();
  }
  reset() {
    this.transforms.teleport(this.handle,this.track.spawn);this.transforms.setIntent(this.handle,{x:0,y:0,z:0});this.transforms.setVelocity(this.handle,{x:0,y:0,z:0});
    this.heading=this.track.spawn.heading;this.previousHeading=this.heading;this.speed=0;this.race={next:1,laps:0,records:[]};
    this.ticks=0;this.raceTicks=0;this.countdown=180;this.blockedSteps=0;this.distance=0;this.maxSpeed=0;this.headingTravel=0;this.state.reset('READY');
  }
  update(dt=1/60) {
    if(this.disposed)throw new Error('D_GAME_DISPOSED');
    if(Math.abs(dt-1/60)>1e-10)throw new Error('D_FIXED_STEP_REQUIRED');
    const input=this.input.captureSnapshot(),reset=input.isActionActive('Reset');
    if(reset&&!this.resetHeld){this.resetHeld=true;this.reset();return;}this.resetHeld=reset;this.ticks++;
    const throttle=Math.max(0,input.getActionValue('Throttle')),brake=Math.max(0,input.getActionValue('Brake')),steer=input.getActionValue('Steer');
    if(this.state.getState()==='READY'&&throttle>0)this.state.transition('COUNTDOWN');
    if(this.state.getState()==='COUNTDOWN'){if(--this.countdown<=0)this.state.transition('RACING');return;}
    if(this.state.getState()!=='RACING')return;
    this.raceTicks++;this.previousHeading=this.heading;
    const acceleration=throttle*VEHICLE.acceleration-brake*(this.speed>0?VEHICLE.braking:VEHICLE.acceleration*0.6);
    this.speed=Math.max(-VEHICLE.reverseSpeed,Math.min(VEHICLE.maxSpeed,(this.speed+acceleration*dt)/(1+VEHICLE.drag*dt)));
    if(Math.abs(this.speed)<0.01&&!throttle&&!brake)this.speed=0;
    // Positive semantic steering means right. With +Z forward and +Y up,
    // vehicle-right is -X at heading zero, so right steering decreases yaw.
    const turn=-steer*1.6*Math.min(1,Math.abs(this.speed)/5)*Math.sign(this.speed)*dt;
    this.heading+=turn;this.headingTravel+=Math.abs(turn);
    const p=this.transform.position,from={x:p.x,z:p.z};
    const next=this.track.resolveMovement(from,{x:p.x+Math.sin(this.heading)*this.speed*dt,z:p.z+Math.cos(this.heading)*this.speed*dt},VEHICLE.radius);
    if(next.blocked){this.blockedSteps++;this.speed*=0.985;}
    this.distance+=Math.hypot(next.x-p.x,next.z-p.z);this.maxSpeed=Math.max(this.maxSpeed,this.speed);
    this.transforms.setIntent(this.handle,{x:(next.x-p.x)/dt,y:0,z:(next.z-p.z)/dt});
    this.transforms.commitAll(dt); // Sole normal-step position writer.
    advanceCheckpoints(this.race,this.track,from,this.transform.position,this.raceTicks);
    if(this.race.laps===this.track.artifact.data.laps){this.state.transition('FINISHED');this.speed=0;this.transforms.setVelocity(this.handle,{x:0,y:0,z:0});this.transforms.setIntent(this.handle,{x:0,y:0,z:0});}
  }
  snapshot() {
    return {trackHash:this.track.artifact.hash,position:{...this.transform.position},heading:this.heading,speed:this.speed,state:this.state.getState(),
      race:structuredClone(this.race),ticks:this.ticks,raceTicks:this.raceTicks,time:this.raceTicks/60,countdown:this.countdown,
      blockedSteps:this.blockedSteps,distance:this.distance,maxSpeed:this.maxSpeed,headingTravel:this.headingTravel};
  }
  dispose(){if(this.disposed)return;this.input.clear();this.track.dispose();this.transforms.clear();this.entities.despawn(this.handle);this.disposed=true;}
}
