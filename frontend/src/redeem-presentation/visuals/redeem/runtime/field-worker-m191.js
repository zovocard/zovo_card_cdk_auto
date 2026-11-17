/* Same renderer, off the UI thread. One in-flight job; buffers are transferred. */
'use strict';
import {create} from './field-kernel-m191.js';
const renderer=create();
self.onmessage=({data})=>{
 if(data.type!=='frame')return;
 try{const start=performance.now(),output=renderer.render(data.job,data.buffer);
  self.postMessage({type:'frame',id:data.id,key:data.key,width:data.job.width,height:data.job.height,time:data.job.time,computeMs:performance.now()-start,buffer:output.buffer},[output.buffer]);
 }catch(error){self.postMessage({type:'error',message:String(error)});}
};
