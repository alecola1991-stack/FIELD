export const MENU_PLAYLIST = Object.freeze([
 { name:'Neon Kickoff', bpm:112, roots:[48,53,55,50], melody:[72,76,79,76,74,72,69,72,74,79,77,74,72,69,67,69] },
 { name:'City Lights', bpm:104, roots:[45,48,53,52], melody:[69,72,76,79,76,72,74,76,77,76,72,69,67,69,72,74] },
 { name:'Stadium Dreams', bpm:96, roots:[50,55,48,53], melody:[74,77,81,79,77,74,72,69,72,74,77,76,74,72,69,72] },
 { name:'Final Pulse', bpm:124, roots:[43,48,50,46], melody:[67,70,74,77,74,70,67,65,67,70,72,74,77,74,70,67] },
]);
export function goalExcitement(ball,world) {
 if(!ball || !world) return 0;
 const y=Math.max(world.goalTop,Math.min(world.goalBottom,ball.y));
 const distance=Math.min(Math.hypot(ball.x-world.left,ball.y-y),Math.hypot(ball.x-world.right,ball.y-y));
 return Math.pow(Math.max(0,Math.min(1,1-distance/260)),1.7);
}
