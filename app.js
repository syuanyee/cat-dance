/* No uploads, external services or runtime dependencies. */
'use strict';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d'),video=$('source');
const layer=document.createElement('canvas');layer.width=648;layer.height=600;
const lc=layer.getContext('2d',{willReadFrequently:true});
let posterReady=false;
let imageAspect=720/1280;
let bg=null,palette='mint',ready=false,busy=false,drag=null,recorder=null,stream=null,audioCtx=null,audioDest=null,audioSource=null,audioGain=null,resultURL=null,resultBlob=null,cancelled=false,recordError=null,wakeLock=null;
const state={x:.5,y:.6,size:.85}, palettes={mint:['#dce9d5','#a8c7ac'],peach:['#fff1df','#e9b3a3'],night:['#50667c','#142e37'],cream:['#fff8e5','#dfc98d']};
const types=['video/mp4;codecs=avc1.424028,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'];
const mime=window.MediaRecorder?types.find(t=>MediaRecorder.isTypeSupported(t)):null;
$('format').textContent=mime?(mime.includes('mp4')?'MP4':'WebM'):'此瀏覽器不支援影片輸出';
const status=message=>$('status').textContent=message;
function bounds(){const w=canvas.width*state.size,h=w*600/648;return {x:canvas.width*state.x-w/2,y:canvas.height*state.y-h/2,w,h};}
function sync(){for(const [id,value]of [['size',state.size*100],['posX',state.x*100],['posY',state.y*100]])$(id).value=Math.round(value);$('sizeValue').value=Math.round(state.size*100)+'%';$('xValue').value=Math.round(state.x*100)+'%';$('yValue').value=Math.round(state.y*100)+'%';}
function resize(){
  const shortEdge=Number($('quality').value),longLimit=Math.round(shortEdge*16/9);
  const scale=Math.min(shortEdge/Math.min(imageAspect,1),longLimit/Math.max(imageAspect,1));
  canvas.width=Math.max(2,Math.ceil(imageAspect*scale/2)*2);
  canvas.height=Math.max(2,Math.ceil(scale/2)*2);
  canvas.parentElement.style.aspectRatio=canvas.width+'/'+canvas.height;
  $('dimensions').textContent=canvas.width+' × '+canvas.height;
}

function keyFrame(){if(video.readyState<2)return;lc.drawImage(video,0,0,648,600);const frame=lc.getImageData(0,0,648,600),d=frame.data,k=+$('key').value;for(let i=0;i<d.length;i+=4){const excess=d[i+1]-Math.max(d[i],d[i+2]);const alpha=1-Math.min(1,Math.max(0,(excess-k)/45));d[i+3]=Math.round(alpha*255);if(excess>12)d[i+1]=Math.min(d[i+1],Math.max(d[i],d[i+2])+12);}lc.putImageData(frame,0,0);}
function draw(){const w=canvas.width,h=canvas.height;const colors=palettes[palette],gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,colors[0]);gradient.addColorStop(1,colors[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);if(bg){const s=Math.min(w/bg.width,h/bg.height);ctx.drawImage(bg,(w-bg.width*s)/2,(h-bg.height*s)/2,bg.width*s,bg.height*s);}else{ctx.fillStyle=palette==='night'?'#ffffff0c':'#ffffff35';ctx.beginPath();ctx.arc(w*.88,h*.16,w*.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(w*.1,h*.97,w*.8,h*.25,-.25,0,Math.PI*2);ctx.fill();}const b=bounds();ctx.save();if($('flip').checked){ctx.translate(b.x+b.w,b.y);ctx.scale(-1,1);ctx.drawImage(layer,0,0,b.w,b.h);}else ctx.drawImage(layer,b.x,b.y,b.w,b.h);ctx.restore();const sel=$('selection');sel.style.left=b.x/w*100+'%';sel.style.top=b.y/h*100+'%';sel.style.width=b.w/w*100+'%';sel.style.height=b.h/h*100+'%';sel.hidden=busy||(!ready&&!posterReady);const t=video.currentTime||0;$('time').textContent='00:'+String(Math.floor(t)).padStart(2,'0')+' / 00:12';if(busy)$('progress').value=t/video.duration;}
let previous=-1;function loop(){if(ready&&(video.currentTime!==previous)){keyFrame();previous=video.currentTime;}draw();requestAnimationFrame(loop);}resize();loop();
function initializeVideo(){if(video.readyState<2)return;const first=!ready;ready=true;keyFrame();draw();$('play').disabled=false;$('export').disabled=!mime||!canvas.captureStream;if(first&&!bg)status('請上傳背景圖片。');}
video.addEventListener('loadeddata',initializeVideo);
video.addEventListener('canplay',initializeVideo);
initializeVideo();
video.addEventListener('error',()=>status('小貓素材載入失敗。請透過網站網址開啟，並確認 assets/cats.mp4 存在。'));
video.addEventListener('ended',()=>{if(busy){if(recorder?.state==='recording')recorder.stop();}else $('play').textContent='▶ 播放預覽';});
$('play').onclick=async()=>{try{if(video.paused){if(video.ended)video.currentTime=0;video.loop=true;await video.play();$('play').textContent='Ⅱ 暫停預覽';}else{video.pause();$('play').textContent='▶ 播放預覽';}}catch{status('播放失敗，請再點一次播放。');}};
for(const id of ['size','posX','posY'])$(id).oninput=()=>{state.size=+$('size').value/100;state.x=+$('posX').value/100;state.y=+$('posY').value/100;sync();};
$('key').oninput=()=>{keyFrame();};$('quality').onchange=resize;
$('reset').onclick=()=>{Object.assign(state,{x:.5,y:.6,size:.85});$('flip').checked=false;sync();};
$('background').onchange=async event=>{const file=event.target.files[0];if(!file)return;if(file.size>30*1024*1024){status('圖片超過 30 MB，請選擇較小的圖片。');event.target.value='';return;}const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const s=Math.min(1,2560/Math.max(img.width,img.height));const temp=document.createElement('canvas');temp.width=Math.round(img.width*s);temp.height=Math.round(img.height*s);temp.getContext('2d').drawImage(img,0,0,temp.width,temp.height);bg=temp;imageAspect=img.naturalWidth/img.naturalHeight;resize();$('filename').textContent=file.name;initializeVideo();fitPreview();draw();
// Bring the updated composition into view on stacked/mobile layouts.
document.querySelector('.preview').scrollIntoView({behavior:'smooth',block:'start'});
video.muted=true;video.loop=true;
try{await video.play();$('play').textContent='Ⅱ 暫停預覽';status('背景已更新，可拖曳調整小貓位置。');}
catch{status('背景已更新。點擊「播放預覽」讓小貓跳舞。');}
}catch{status('無法讀取這張圖片，請使用 JPG、PNG 或 WebP。');}finally{URL.revokeObjectURL(url);}};
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height};}
canvas.onpointerdown=e=>{if(busy||(!ready&&!posterReady)||drag)return;const p=point(e),b=bounds(),tolerance=25*canvas.width/canvas.clientWidth;const corner=Math.hypot(p.x-b.x-b.w,p.y-b.y-b.h)<tolerance;if(corner||(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)){drag={id:e.pointerId,p,x:state.x,y:state.y,size:state.size,corner};canvas.setPointerCapture(e.pointerId);}};
canvas.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const p=point(e);if(drag.corner)state.size=Math.max(.2,Math.min(1.5,drag.size+2*(p.x-drag.p.x)/canvas.width));else{state.x=Math.max(0,Math.min(1,drag.x+(p.x-drag.p.x)/canvas.width));state.y=Math.max(0,Math.min(1,drag.y+(p.y-drag.p.y)/canvas.height));}sync();};
canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
async function audio(){if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();audioSource=audioCtx.createMediaElementSource(video);audioGain=audioCtx.createGain();audioDest=audioCtx.createMediaStreamDestination();audioSource.connect(audioGain);audioGain.connect(audioDest);}await audioCtx.resume();audioGain.gain.value=$('sound').checked?1:0;video.muted=false;}
function seekStart(){return new Promise((resolve,reject)=>{if(video.currentTime===0){resolve();return;}const timer=setTimeout(()=>{video.removeEventListener('seeked',done);reject(new Error('素材定位逾時，請重試。'));},5000);function done(){clearTimeout(timer);resolve();}video.addEventListener('seeked',done,{once:true});video.currentTime=0;});}
function cleanup(){video.pause();video.muted=true;busy=false;stream?.getVideoTracks().forEach(t=>t.stop());stream=null;$('editor').disabled=false;$('play').disabled=false;$('play').textContent='▶ 播放預覽';$('progress').hidden=true;$('cancel').hidden=true;wakeLock?.release().catch(()=>{});wakeLock=null;}
$('export').onclick=async()=>{if(busy||!ready||!mime)return;busy=true;cancelled=false;recordError=null;$('editor').disabled=true;$('play').disabled=true;$('download').hidden=true;$('share').hidden=true;$('progress').hidden=false;$('progress').value=0;$('cancel').hidden=false;status('正在準備輸出…');video.pause();video.loop=false;try{await audio();await seekStart();if(cancelled){cleanup();return;}keyFrame();draw();stream=canvas.captureStream(30);if($('sound').checked)audioDest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:canvas.width>=1080?8000000:4500000});const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>{recordError=e.error||new Error('編碼失敗');status('輸出失敗，請降低畫質後重試。');};recorder.onstop=()=>{const failed=recordError;cleanup();if(cancelled){status('已取消輸出，可繼續編輯。');return;}if(failed||!chunks.length){status('輸出失敗，請降低畫質後重試。');return;}resultBlob=new Blob(chunks,{type:recorder.mimeType});if(resultURL)URL.revokeObjectURL(resultURL);resultURL=URL.createObjectURL(resultBlob);$('download').href=resultURL;$('download').download='cat-dance.'+(resultBlob.type.includes('mp4')?'mp4':'webm');$('download').textContent='↓ 下載影片 · '+(resultBlob.size/1048576).toFixed(1)+' MB';$('download').hidden=false;const file=new File([resultBlob],$('download').download,{type:resultBlob.type});$('share').hidden=!navigator.canShare?.({files:[file]});status('影片已完成，請下載。');};try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}if(cancelled){cleanup();return;}recorder.start(250);await video.play();status('正在合成影片… 請保持此頁開啟。');}catch(e){recordError=e;if(recorder?.state==='recording')recorder.stop();else cleanup();status('無法輸出：'+e.message+' 可嘗試降低畫質或更換瀏覽器。');}};
$('cancel').onclick=()=>{cancelled=true;if(recorder?.state==='recording')recorder.stop();else status('正在取消…');};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&busy){cancelled=true;if(recorder?.state==='recording')recorder.stop();}});
$('share').onclick=async()=>{if(!resultBlob)return;try{await navigator.share({files:[new File([resultBlob],$('download').download,{type:resultBlob.type})]});}catch(e){if(e.name!=='AbortError')status('分享失敗，請使用下載影片按鈕。');}};

// Fit every aspect ratio inside the preview, including narrow phones.
function fitPreview(){const stage=document.querySelector('.stage'),wrap=canvas.parentElement;const availableW=stage.clientWidth-44,availableH=stage.clientHeight-44;const scale=Math.min(availableW/canvas.width,availableH/canvas.height);wrap.style.width=canvas.width*scale+'px';wrap.style.height=canvas.height*scale+'px';}
new ResizeObserver(fitPreview).observe(document.querySelector('.stage'));
$('quality').addEventListener('change',fitPreview);fitPreview();

// A still frame is independent of mobile video preload/autoplay policies.
const poster=new Image();
poster.onload=()=>{
  posterReady=true;
  if(!ready){lc.clearRect(0,0,648,600);lc.drawImage(poster,0,0,648,600);draw();status('點擊播放預覽，或上傳背景圖片。');}
};
poster.onerror=()=>{if(!ready)status('點擊播放預覽載入小貓。');};
poster.src='assets/cats-poster.png';
// Keep manual playback available even when the browser refuses to preload.
$('play').disabled=false;
video.muted=true;
video.defaultMuted=true;
video.loop=true;
video.addEventListener('playing',()=>{initializeVideo();$('play').textContent='Ⅱ 暫停預覽';});
video.addEventListener('pause',()=>{$('play').textContent='▶ 播放預覽';});
video.load();
video.play().catch(()=>{/* The poster remains visible; the play button retries with a user gesture. */});
