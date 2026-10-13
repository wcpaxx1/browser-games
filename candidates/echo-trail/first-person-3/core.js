/* Original Echo Trail first-person grid rules; software-rendered, no WebGL. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EchoCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='3.0.0',SEED=0xEC4013;
const LEVELS=[
  {
    "name": "第一束回声",
    "map": [
      "#####",
      "#..##",
      "##.##",
      "##..#",
      "#####"
    ],
    "start": [
      1,
      1
    ],
    "exit": [
      3,
      3
    ]
  },
  {
    "name": "绕过静默",
    "map": [
      "#######",
      "#...#.#",
      "#.###.#",
      "#...#.#",
      "#.###.#",
      "#.....#",
      "#######"
    ],
    "start": [
      1,
      1
    ],
    "exit": [
      5,
      1
    ]
  },
  {
    "name": "折返的光",
    "map": [
      "#######",
      "#.....#",
      "###.#.#",
      "#.....#",
      "#.#####",
      "#.....#",
      "#######"
    ],
    "start": [
      1,
      1
    ],
    "exit": [
      5,
      5
    ]
  },
  {
    "name": "双重折线",
    "map": [
      "#########",
      "#...###.#",
      "#.#####.#",
      "#.#.....#",
      "#.#.#.#.#",
      "#.#.#.#.#",
      "#.#.#.#.#",
      "#...#...#",
      "#########"
    ],
    "start": [
      1,
      1
    ],
    "exit": [
      7,
      1
    ]
  },
  {
    "name": "深海回信",
    "map": [
      "#########",
      "#.......#",
      "###.###.#",
      "#.......#",
      "#.###.###",
      "#.......#",
      "###.###.#",
      "#.......#",
      "#########"
    ],
    "start": [
      1,
      1
    ],
    "exit": [
      1,
      7
    ]
  }
];
LEVELS.forEach(l=>{Object.freeze(l.map);Object.freeze(l.start);Object.freeze(l.exit);Object.freeze(l);});Object.freeze(LEVELS);
const VECTORS=Object.freeze([[0,-1],[1,0],[0,1],[-1,0]].map(Object.freeze));
function create(levelId=0){if(!Number.isInteger(levelId)||!LEVELS[levelId])throw new RangeError('Unknown level');const l=LEVELS[levelId];return{levelId,x:l.start[0],y:l.start[1],heading:1,mode:'playing',resumeMode:'playing',revealMs:1500,firstMove:true,celebrateMs:0,feedback:'start'};}
function reducer(s,a){
 if(!s||!a)return s;
 if(a.type==='pause')return['playing','won'].includes(s.mode)?{...s,resumeMode:s.mode,mode:'paused'}:s;
 if(a.type==='resume')return s.mode==='paused'?{...s,mode:s.resumeMode}:s;
 if(a.type==='tick'){
  if(!Number.isFinite(a.ms)||a.ms<=0||s.mode==='paused')return s;
  if(s.mode==='playing'&&!s.firstMove&&s.revealMs>0)return{...s,revealMs:Math.max(0,s.revealMs-a.ms)};
  if(s.mode==='won'&&s.celebrateMs>0)return{...s,celebrateMs:Math.max(0,s.celebrateMs-a.ms)};
  return s;
 }
 if(s.mode!=='playing')return s;
 if(a.type==='pulse')return{...s,revealMs:1500,firstMove:false,feedback:'pulse'};
 if(a.type==='turn'&&['left','right'].includes(a.dir))return{...s,heading:(s.heading+(a.dir==='left'?3:1))%4,feedback:'turn'};
 if(a.type!=='move'||!['forward','back'].includes(a.dir))return s;
 const l=LEVELS[s.levelId],[vx,vy]=VECTORS[s.heading],sign=a.dir==='forward'?1:-1,nx=s.x+vx*sign,ny=s.y+vy*sign,open=l.map[ny]?.[nx]==='.';
 const x=open?nx:s.x,y=open?ny:s.y,won=x===l.exit[0]&&y===l.exit[1];
 return{...s,x,y,mode:won?'won':'playing',resumeMode:won?'won':'playing',celebrateMs:won?750:0,firstMove:false,revealMs:s.firstMove?800:s.revealMs,feedback:won?'won':open?'move':'bump'};
}
function tutorial(s){if(s.levelId!==0||s.mode!=='playing')return null;const target={'1,1':1,'2,1':2,'2,2':2,'2,3':1}[s.x+','+s.y];if(target===undefined)return null;const d=(target-s.heading+4)%4;return d===0?'forward':d===3?'left':'right';}
return{VERSION,SEED,LEVELS,VECTORS,create,reducer,tutorial};
});
