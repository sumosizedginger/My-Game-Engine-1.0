import {angleDelta} from './game.js';

// Project presentation state. No writable reference to game state is retained.
export function createChaseCamera(controlled=false) {
  let orbit=0;
  return {
    get orbit(){return orbit;},
    update(value,dt){if(!controlled)orbit=Math.max(-1.1,Math.min(1.1,orbit+value*Math.min(Math.max(dt,0),0.1)*1.2));},
    pose(position,heading) {
      if(controlled)return {position:{x:72,y:84,z:80},target:{x:0,y:0,z:0}};
      const angle=heading+orbit;
      return {position:{x:position.x-Math.sin(angle)*10,y:position.y+6,z:position.z-Math.cos(angle)*10},
        target:{x:position.x+Math.sin(heading)*5,y:position.y+0.5,z:position.z+Math.cos(heading)*5}};
    }
  };
}
export function interpolatedVehicle(game,alpha) {
  const a=game.transform.previousPosition,b=game.transform.position;
  return {position:{x:a.x+(b.x-a.x)*alpha,y:b.y,z:a.z+(b.z-a.z)*alpha},
    heading:game.previousHeading+angleDelta(game.heading,game.previousHeading)*alpha};
}
