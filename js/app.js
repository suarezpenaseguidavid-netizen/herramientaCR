(() => {
const video = document.querySelector('#video');
const canvas = document.querySelector('#photo');
const ctx = canvas.getContext('2d');
const placeholder = document.querySelector('#cameraPlaceholder');
const status = document.querySelector('#status');
const scaleStatus = document.querySelector('#scaleStatus');
const pending = document.querySelector('#pending');
const startBtn = document.querySelector('#startCamera');
const stopBtn = document.querySelector('#stopCamera');
const captureBtn = document.querySelector('#capture');
const calibrateBtn = document.querySelector('#calibrate');
const measureModeBtn = document.querySelector('#measureMode');
const saveBtn = document.querySelector('#saveMeasure');
const clearBtn = document.querySelector('#clearPoints');
const exportBtn = document.querySelector('#export');
let stream = null, photoTaken = false, mode = 'none', points = [], scale = null, measures = [];

function setStatus(msg, error=false){ status.textContent=msg; status.classList.toggle('error',error); }
function updateControls(){
 calibrateBtn.disabled=!photoTaken;
 measureModeBtn.disabled=!photoTaken || !scale;
 clearBtn.disabled=points.length===0;
 saveBtn.disabled=!(photoTaken && scale && mode==='measure' && points.length===2);
 exportBtn.disabled=measures.length===0;
}
function drawPoints(){
 if(!photoTaken)return;
 ctx.drawImage(window._photoImage,0,0,canvas.width,canvas.height);
 points.forEach((p,i)=>{
   ctx.beginPath();ctx.arc(p.x,p.y,Math.max(5,canvas.width/180),0,Math.PI*2);
   ctx.fillStyle=i%2===0?'#ff3b30':'#00c7a5';ctx.fill();
   ctx.lineWidth=Math.max(2,canvas.width/500);ctx.strokeStyle='white';ctx.stroke();
   ctx.fillStyle='white';ctx.font=`bold ${Math.max(16,canvas.width/35)}px system-ui`;
   ctx.fillText(String(i+1),p.x+8,p.y-8);
 });
 if(points.length===2){
   ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);ctx.lineTo(points[1].x,points[1].y);
   ctx.strokeStyle='#ffcc00';ctx.lineWidth=Math.max(3,canvas.width/350);ctx.stroke();
 }
}
startBtn.addEventListener('click',async()=>{
 if(!navigator.mediaDevices?.getUserMedia){setStatus('Este navegador no permite usar la cámara aquí. Abre la página mediante HTTPS o localhost en un navegador compatible.',true);return;}
 try{
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   video.srcObject=stream;video.classList.remove('hidden');canvas.style.display='none';placeholder.classList.add('hidden');
   await video.play();captureBtn.disabled=false;stopBtn.disabled=false;startBtn.disabled=true;
   setStatus('Cámara activa. Encuadra la ventana y toma una foto.');
 }catch(e){setStatus(e.name==='NotAllowedError'?'Permiso denegado. Autoriza la cámara en los permisos del navegador y vuelve a intentarlo.':'No se pudo abrir la cámara: '+e.message,true);}
});
stopBtn.addEventListener('click',()=>{
 if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;
 stopBtn.disabled=true;startBtn.disabled=false;captureBtn.disabled=true;setStatus('Cámara apagada. La foto capturada se conserva.');
});
captureBtn.addEventListener('click',()=>{
 if(!video.videoWidth){setStatus('Espera a que la cámara esté lista.',true);return;}
 canvas.width=video.videoWidth;canvas.height=video.videoHeight;
 const img=new Image();img.onload=()=>{window._photoImage=img;photoTaken=true;points=[];scale=null;mode='none';
   video.classList.add('hidden');canvas.style.display='block';drawPoints();
   scaleStatus.textContent='Escala aún no calibrada.';setStatus('Foto capturada. Calibra usando dos puntos de una referencia conocida.');updateControls();};
 img.src=video.srcObject ? (()=>{ctx.drawImage(video,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.92)})() : '';
});
calibrateBtn.addEventListener('click',()=>{
 if(!photoTaken)return;mode='calibrate';points=[];drawPoints();updateControls();
 pending.textContent='Calibración: toca dos extremos de la referencia conocida.';
 setStatus('Modo calibración activo. Selecciona los dos extremos de la referencia en la foto.');
});
measureModeBtn.addEventListener('click',()=>{
 if(!scale)return;mode='measure';points=[];drawPoints();updateControls();
 pending.textContent='Medición: toca los dos extremos del vano.';
 setStatus('Modo medición activo. Selecciona dos extremos del ancho o alto.');
});
canvas.addEventListener('click',(e)=>{
 if(!photoTaken || mode==='none')return;
 const r=canvas.getBoundingClientRect();const x=(e.clientX-r.left)*canvas.width/r.width;const y=(e.clientY-r.top)*canvas.height/r.height;
 if(points.length>=2)points=[];
 points.push({x,y});drawPoints();updateControls();
 if(points.length===2){
   const px=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
   if(mode==='calibrate'){
     const known=parseFloat(document.querySelector('#knownLength').value);
     if(!(known>0)){setStatus('Introduce una longitud de referencia válida.',true);return;}
     scale=known/px;scaleStatus.textContent=`Escala calibrada: ${scale.toFixed(4)} cm por píxel.`;
     pending.textContent=`Referencia seleccionada: ${px.toFixed(1)} píxeles.`;
     mode='none';setStatus('Calibración lista. Ahora pulsa “Medir vano”.');
   }else{
     const cm=px*scale;pending.textContent=`Medida seleccionada: ${cm.toFixed(1)} cm (${px.toFixed(1)} píxeles).`;
     setStatus('Medida calculada. Puedes guardarla o deshacer los puntos.');
   }
 }
 updateControls();
});
saveBtn.addEventListener('click',()=>{
 if(points.length!==2||!scale)return;
 const px=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
 const cm=px*scale;const name=document.querySelector('#measureName').value.trim()||`Medida ${measures.length+1}`;
 measures.push({name,cm,px});renderMeasures();points=[];mode='none';drawPoints();pending.textContent='Medida guardada. Pulsa “Medir vano” para registrar otra.';
 document.querySelector('#measureName').value=`Medida ${measures.length+1}`;updateControls();
});
function renderMeasures(){
 const list=document.querySelector('#measureList');list.innerHTML='';
 if(!measures.length){list.innerHTML='<p class="hint">Tus medidas aparecerán aquí.</p>';return;}
 measures.forEach((m,i)=>{const div=document.createElement('div');div.className='measure';
   const left=document.createElement('div');const strong=document.createElement('b');strong.textContent=m.name;
   const small=document.createElement('small');small.textContent=`${m.px.toFixed(1)} píxeles`;
   left.append(strong,document.createElement('br'),small);
   const right=document.createElement('span');right.className='stat';right.textContent=`${m.cm.toFixed(1)} cm`;
   div.append(left,right);list.append(div);
 });
}
clearBtn.addEventListener('click',()=>{points=[];drawPoints();pending.textContent='Puntos borrados. Selecciona nuevamente.';updateControls();});
exportBtn.addEventListener('click',()=>{
 const content=['VanoMedidor — Registro de medidas',new Date().toLocaleString('es-CO'),'',...measures.map((m,i)=>`${i+1}. ${m.name}: ${m.cm.toFixed(1)} cm (${m.px.toFixed(1)} px)`),'','Nota: medidas aproximadas; verificar con cinta métrica.'].join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));a.download='medidas-vanos.txt';a.click();URL.revokeObjectURL(a.href);
});
document.querySelector('#reset').addEventListener('click',()=>{
 points=[];scale=null;photoTaken=false;mode='none';measures=[];window._photoImage=null;
 canvas.style.display='none';video.classList.remove('hidden');placeholder.classList.remove('hidden');
 scaleStatus.textContent='Escala aún no calibrada.';pending.textContent='Aún no hay puntos seleccionados.';
 renderMeasures();updateControls();setStatus('Reiniciado. Puedes tomar una nueva foto.');
});
})();