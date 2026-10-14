export const MENU_PLAYLIST = Object.freeze([
 { name: 'The Charm 68', artist: 'The Cynic Project', license: 'CC0-1.0', src: new URL('../assets/music/the-charm-68-01.mp3', import.meta.url).href, parts: [new URL('../assets/music/the-charm-68-01.mp3', import.meta.url).href, new URL('../assets/music/the-charm-68-02.mp3', import.meta.url).href, new URL('../assets/music/the-charm-68-03.mp3', import.meta.url).href, new URL('../assets/music/the-charm-68-04.mp3', import.meta.url).href, new URL('../assets/music/the-charm-68-05.mp3', import.meta.url).href, new URL('../assets/music/the-charm-68-06.mp3', import.meta.url).href] },
 { name: 'Awake! (Megawall-10)', artist: 'The Cynic Project', license: 'CC0-1.0', src: new URL('../assets/music/awake.mp3', import.meta.url).href },
 { name: 'Hyperflight Racing', artist: 'The Cynic Project', license: 'CC0-1.0', src: new URL('../assets/music/hyperflight-racing.mp3', import.meta.url).href },
 { name: 'Hyper Ultra-Racing', artist: 'The Cynic Project', license: 'CC0-1.0', src: new URL('../assets/music/hyper-ultra-racing.mp3', import.meta.url).href },
]);
export function goalExcitement(ball,world) {
 if(!ball || !world) return 0;
 const y=Math.max(world.goalTop,Math.min(world.goalBottom,ball.y));
 const distance=Math.min(Math.hypot(ball.x-world.left,ball.y-y),Math.hypot(ball.x-world.right,ball.y-y));
 return Math.pow(Math.max(0,Math.min(1,1-distance/260)),1.7);
}
