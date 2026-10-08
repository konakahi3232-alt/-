const express=require('express');
const http=require('http');
const crypto=require('crypto');
const WebSocket=require('ws');
const path=require('path');
const app=express();
const server=http.createServer(app);
const wss=new WebSocket.Server({server,path:'/ws'});
const PORT=process.env.PORT||10000;
app.use(express.static(path.join(__dirname,'public')));
app.get('/', (req,res)=>{
  const publicIndex=path.join(__dirname,'public','index.html');
  const rootIndex=path.join(__dirname,'index.html');
  res.sendFile(require('fs').existsSync(publicIndex)?publicIndex:rootIndex);
});
app.get('/health',(req,res)=>res.json({ok:true,rooms:Object.keys(rooms).length}));
const rooms=new Map();
const ING={egg:['卵',1],sugar:['砂糖',1],soy:['しょうゆ',1],rice:['米',2],tomato:['トマト',1],oil:['油',1],beef:['牛肉',3],onion:['たまねぎ',1],pork:['豚肉',2],chicken:['鶏肉',2],lettuce:['レタス',1],bread:['パン',2],cheese:['チーズ',2],potato:['じゃがいも',1],carrot:['にんじん',1],fish:['魚',2],butter:['バター',1]};
const REC=[
['卵焼き',['egg','sugar','soy'],3],['オムライス',['egg','rice','tomato'],3],['チャーハン',['rice','egg','oil'],3],['牛丼',['beef','rice','onion'],3],['豚丼',['pork','rice','onion'],3],['親子丼',['egg','chicken','onion'],3],['肉じゃが',['beef','potato','carrot'],3],['カレー',['beef','potato','carrot'],3],['ポークソテー',['pork','oil','soy'],3],['野菜炒め',['carrot','onion','oil'],3],['トマトサラダ',['tomato','lettuce','oil'],3],['チーズサンド',['bread','cheese','lettuce'],3],['ハンバーガー',['bread','beef','lettuce'],3],['ピザトースト',['bread','cheese','tomato'],3],['ポテトサラダ',['potato','egg','carrot'],3],['ステーキ',['beef','oil','soy'],3],['目玉焼き',['egg','oil'],3],['塩むすび',['rice'],3],['フライドポテト',['potato','oil'],3],['トースト',['bread','butter'],3],['ゆで卵',['egg'],3],['たまごかけご飯',['egg','rice'],3],['チーズポテト',['potato','cheese'],3],['刺身',['fish'],3],['サンドイッチ',['bread','lettuce'],3]
].map((r,i)=>({id:i,name:r[0],need:r[1],points:r[2]}));
function id(n=6){return crypto.randomBytes(4).toString('hex').slice(0,n).toUpperCase()}
function deck(){let a=[]; for(let i=0;i<8;i++) for(const k of Object.keys(ING)) a.push(k); return a.sort(()=>Math.random()-.5)}
function playerView(p){return {id:p.id,name:p.name,hand:p.hand,score:p.score}}
function publicState(room){return {players:[...room.players.values()].map(playerView),turn:room.turn,started:room.started,log:room.log.slice(0,30)}}
function send(ws,msg){if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(msg))}
function broadcast(room,msg){for(const p of room.players.values()) send(p.ws,msg)}
function broadcastState(room){broadcast(room,{type:'state',state:publicState(room)})}
function materialCount(hand,need){const c={}; for(const x of hand)c[x]=(c[x]||0)+1; return need.every(x=>(c[x]||0)>=(need.filter(y=>y===x).length))}
function removeNeed(hand,need){const h=hand.slice(); for(const x of need){const i=h.indexOf(x); if(i>=0)h.splice(i,1); else return null} return h}
function addLog(room,s){room.log.unshift(s); room.log=room.log.slice(0,30)}
function getRoom(code){return rooms.get(String(code||'').trim().toUpperCase())}
function makeRoom(){let code; do code=id(6); while(rooms.has(code)); const r={code,players:new Map(),host:null,started:false,turn:null,log:[],deck:deck()}; rooms.set(code,r); return r}
function draw(room){if(room.deck.length<30) room.deck=deck(); return room.deck.pop()}
function refill(room,p){while(p.hand.length<4)p.hand.push(draw(room))}
function findPlayer(room,ws){for(const p of room.players.values()) if(p.ws===ws)return p; return null}
function leave(ws){for(const [code,room] of rooms){const p=findPlayer(room,ws); if(!p)continue; room.players.delete(p.id); addLog(room,`${p.name}さんが退出しました`); if(room.host===p.id) room.host=room.players.keys().next().value||null; if(room.turn===p.id) room.turn=room.players.keys().next().value||null; broadcastState(room); if(room.players.size===0) rooms.delete(code); return}}
function handle(ws,d){
 if(!d||typeof d.type!=='string')return;
 if(d.type==='create'){const room=makeRoom(); const p={id:id(8),name:String(d.name||'プレイヤー').slice(0,16),hand:[],score:0,ws};room.host=p.id;room.players.set(p.id,p);send(ws,{type:'joined',code:room.code,me:p.id,host:true});return}
 if(d.type==='join'){const room=getRoom(d.code); if(!room)return send(ws,{type:'error',message:'ルームが見つかりません。ルームIDを確認してください。'}); if(room.players.size>=8)return send(ws,{type:'error',message:'このルームは満員です。'}); const p={id:id(8),name:String(d.name||'プレイヤー').slice(0,16),hand:[],score:0,ws};room.players.set(p.id,p);send(ws,{type:'joined',code:room.code,me:p.id,host:false}); addLog(room,`${p.name}さんが参加しました！`); broadcastState(room); return}
 const room=getRoom(d.code); if(!room)return send(ws,{type:'error',message:'ルームに参加していません。'}); const p=room.players.get(d.me); if(!p||p.ws!==ws)return send(ws,{type:'error',message:'参加情報が確認できません。ページを開き直してください。'});
 if(d.type==='start'){if(room.host!==p.id)return; if(room.players.size<1)return; room.started=true; room.turn=[...room.players.keys()][0]; room.deck=deck(); for(const x of room.players.values()){x.hand=[];x.score=0;refill(room,x)} addLog(room,'ゲームを開始しました！'); broadcastState(room); return}
 if(!room.started)return send(ws,{type:'error',message:'ホストがゲームを開始するまで待ってください。'});
 if(d.type==='draw'){if(room.turn!==p.id)return send(ws,{type:'error',message:'今はあなたのターンではありません。'}); if(p.hand.length>=4)return send(ws,{type:'error',message:'手札が4枚なのでカードを引けません。'}); p.hand.push(draw(room)); addLog(room,`${p.name}さんがカードを1枚引きました`); broadcastState(room);return}
 if(d.type==='discard'){if(room.turn!==p.id)return send(ws,{type:'error',message:'今はあなたのターンではありません。'}); const i=Number(d.index); if(!Number.isInteger(i)||i<0||i>=p.hand.length)return; const k=p.hand[i];p.hand.splice(i,1);p.score-=ING[k][1];addLog(room,`${p.name}さんが${ING[k][0]}を捨てました（-${ING[k][1]}点）`); nextTurn(room,p.id);broadcastState(room);return}
 if(d.type==='cook'){if(room.turn!==p.id)return send(ws,{type:'error',message:'今はあなたのターンではありません。'}); const r=REC.find(x=>x.id===Number(d.recipe));if(!r)return; if(!materialCount(p.hand,r.need))return send(ws,{type:'error',message:'材料が足りません。'}); p.hand=removeNeed(p.hand,r.need);p.score+=r.points;refill(room,p);addLog(room,`${p.name}さんが「${r.name}」を作りました！ +${r.points}点`);nextTurn(room,p.id);broadcastState(room);return}
}
function nextTurn(room,current){const ids=[...room.players.keys()]; if(!ids.length)return; const i=ids.indexOf(current); room.turn=ids[(i+1)%ids.length]}
wss.on('connection',ws=>{ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);ws.on('message',raw=>{try{handle(ws,JSON.parse(raw))}catch(e){send(ws,{type:'error',message:'通信処理でエラーが起きました。'})}});ws.on('close',()=>leave(ws));});
setInterval(()=>{wss.clients.forEach(ws=>{if(!ws.isAlive)return ws.terminate();ws.isAlive=false;ws.ping()})},30000);
server.listen(PORT,'0.0.0.0',()=>console.log(`Food loss game server listening on ${PORT}`));
