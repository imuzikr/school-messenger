/* Image selection controls live outside the editable HTML and never enter a message. */
(function(root){
  function attach(editor){
    const layer=document.createElement('div');layer.className='editor-image-resize-layer';layer.hidden=true;
    const box=document.createElement('div');box.className='editor-image-selection';layer.append(box);
    for(const [corner,label] of [['nw','왼쪽 위'],['ne','오른쪽 위'],['sw','왼쪽 아래'],['se','오른쪽 아래']]){
      const handle=document.createElement('button');handle.type='button';handle.dataset.imageCorner=corner;handle.className='editor-image-handle '+corner;handle.setAttribute('aria-label','이미지 '+label+' 크기 조절');box.append(handle);
    }
    document.body.append(layer);let selected=null,drag=null,frame=0,destroyed=false;
    const originalWidth=(img,value)=>value===null?img.removeAttribute('width'):img.setAttribute('width',value);
    const limit=width=>{const style=getComputedStyle(editor),max=Math.max(1,Math.min(4096,editor.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)));return Math.round(Math.max(Math.min(24,max),Math.min(max,width)));};
    function paint(){
      if(!selected?.isConnected||!editor.contains(selected)){selected=null;layer.hidden=true;return;}
      const e=editor.getBoundingClientRect(),r=selected.getBoundingClientRect();
      layer.hidden=!r.width||!r.height||r.bottom<=e.top||r.top>=e.bottom;
      Object.assign(layer.style,{left:e.left+'px',top:e.top+'px',width:e.width+'px',height:e.height+'px'});
      Object.assign(box.style,{left:r.left-e.left+'px',top:r.top-e.top+'px',width:r.width+'px',height:r.height+'px'});
    }
    function schedule(){if(destroyed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);}
    function select(img){selected=img;paint();}
    function commit(img,width){
      if(!img.isConnected)return;const index=[...editor.querySelectorAll('img')].indexOf(img),copy=img.cloneNode();copy.setAttribute('width',limit(width));copy.removeAttribute('height');
      editor.focus({preventScroll:true});const range=document.createRange();range.selectNode(img);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
      if(document.execCommand('insertHTML',false,copy.outerHTML))select(editor.querySelectorAll('img')[index]);
      else{img.setAttribute('width',limit(width));img.removeAttribute('height');select(img);editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText'}));}
    }
    function cancel(){if(!drag)return;const current=drag;drag=null;originalWidth(current.img,current.original);if(current.handle.hasPointerCapture(current.pointer))current.handle.releasePointerCapture(current.pointer);paint();}
    function editorDown(event){if(event.button!==0||event.target.tagName!=='IMG')return;event.preventDefault();editor.focus({preventScroll:true});const range=document.createRange();range.selectNode(event.target);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);select(event.target);}
    function outside(event){if(!layer.contains(event.target)&&!(editor.contains(event.target)&&event.target.tagName==='IMG')){cancel();selected=null;layer.hidden=true;}}
    function start(event){
      const handle=event.target.closest('[data-image-corner]');if(!handle||!selected||event.button!==0)return;event.preventDefault();event.stopPropagation();const r=selected.getBoundingClientRect();if(!r.width||!r.height)return;
      drag={img:selected,handle,pointer:event.pointerId,corner:handle.dataset.imageCorner,x:event.clientX,y:event.clientY,width:r.width,ratio:r.width/r.height,original:selected.getAttribute('width')};handle.setPointerCapture(event.pointerId);
    }
    function move(event){if(!drag||event.pointerId!==drag.pointer)return;event.preventDefault();const dx=(event.clientX-drag.x)*(drag.corner.endsWith('e')?1:-1),dy=(event.clientY-drag.y)*(drag.corner.startsWith('s')?1:-1)*drag.ratio;drag.img.setAttribute('width',limit(drag.width+(Math.abs(dx)>=Math.abs(dy)?dx:dy)));paint();}
    function finish(event){if(!drag||event.pointerId!==drag.pointer)return;const current=drag,width=current.img.getBoundingClientRect().width;drag=null;if(current.handle.hasPointerCapture(current.pointer))current.handle.releasePointerCapture(current.pointer);originalWidth(current.img,current.original);if(Math.abs(width-current.width)>=1)commit(current.img,width);else paint();}
    function key(event){
      if(event.key==='Escape'&&selected){event.preventDefault();event.stopPropagation();const img=selected;cancel();selected=null;layer.hidden=true;editor.focus({preventScroll:true});if(img.isConnected){const range=document.createRange();range.setStartAfter(img);range.collapse(true);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}return;}
      if(!selected||!event.target.closest('[data-image-corner]'))return;
      const direction={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[event.key];if(!direction)return;event.preventDefault();const corner=event.target.dataset.imageCorner;commit(selected,selected.getBoundingClientRect().width+direction*(event.shiftKey?10:1));box.querySelector('[data-image-corner="'+corner+'"]').focus({preventScroll:true});
    }
    layer.addEventListener('pointerdown',start);layer.addEventListener('pointermove',move);layer.addEventListener('pointerup',finish);layer.addEventListener('pointercancel',cancel);layer.addEventListener('lostpointercapture',cancel);
    editor.addEventListener('pointerdown',editorDown);editor.addEventListener('load',schedule,true);document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);window.addEventListener('blur',cancel);
    const resize=new ResizeObserver(schedule);resize.observe(editor);const mutation=new MutationObserver(schedule);mutation.observe(editor,{childList:true,subtree:true,attributes:true,characterData:true});
    return ()=>{if(destroyed)return;destroyed=true;cancel();cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();editor.removeEventListener('pointerdown',editorDown);editor.removeEventListener('load',schedule,true);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);document.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);window.removeEventListener('blur',cancel);layer.remove();};
  }
  root.DingdongImageResize={attach};
})(window);
