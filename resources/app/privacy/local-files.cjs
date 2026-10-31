'use strict';
const fs=require('node:fs'),{randomUUID}=require('node:crypto'),io=require('./file-io.cjs');
class LocalFiles{
  constructor(root,store){this.root=root;this.store=store;fs.mkdirSync(root,{recursive:true,mode:0o700});}
  path(id,suffix){return io.filePath(this.root,id,suffix);}
  cleanup(){
    const protectedIds=new Set([...this.store.all('file').map(r=>r.value.localFile),...this.store.all('file-download').map(r=>r.value.localFile),...this.store.all('relay-outbox').flatMap(r=>(r.value.files||[]).map(f=>f.blob?.localFile))].filter(Boolean));
    for(const kind of ['file-staging','file-blob'])for(const row of this.store.all(kind)){if(protectedIds.has(row.id)||!(row.value.createdAt<Date.now()-86400000))continue;for(const suffix of ['.part','.blob'])fs.rmSync(this.path(row.id,suffix),{force:true});this.store.remove(kind,row.id);}
  }
  async begin(value){
    if(!Number.isSafeInteger(value.bytes)||value.bytes<0||value.bytes>io.MAX_FILE||typeof value.name!=='string'||!value.name||value.name.length>180)io.fail(413,'첨부 파일은 각각 500 MB 이하로 선택해 주세요.');
    const id=randomUUID(),meta={localFile:id,name:value.name,bytes:value.bytes,mime:/^[a-zA-Z0-9.+\/-]+$/.test(value.mime||'')?value.mime:'application/octet-stream',createdAt:Date.now()};
    const file=await fs.promises.open(this.path(id,'.part'),'wx',0o600);await file.close();this.store.put('file-staging',id,meta);return meta;
  }
  async chunk(value){if(!ArrayBuffer.isView(value.data)||value.data.byteLength>io.CHUNK)io.fail(413,'파일 조각 크기가 올바르지 않습니다.');const meta=this.store.get('file-staging',value.localFile);if(!meta)io.fail(404,'준비 중인 파일을 찾을 수 없습니다.');const offset=await io.writeChunk(this.path(meta.localFile,'.part'),value.offset,Buffer.from(value.data),meta.bytes);return {offset};}
  async finish(id){const meta=this.store.get('file-staging',id);if(!meta)io.fail(404,'준비 중인 파일을 찾을 수 없습니다.');const source=fs.existsSync(this.path(id,'.part'))?this.path(id,'.part'):this.path(id);if((await fs.promises.stat(source)).size!==meta.bytes)io.fail(409,'파일 준비가 아직 끝나지 않았습니다.');const result={...meta,sha256:await io.hashFile(source),size:(meta.bytes/1024/1024).toFixed(1)+' MB'};if(source!==this.path(id))await fs.promises.rename(source,this.path(id));this.store.transaction(()=>{this.store.put('file-blob',id,result);this.store.remove('file-staging',id);});return result;}
  get(id){const meta=this.store.get('file-blob',id);if(!meta||!fs.existsSync(this.path(id))||fs.statSync(this.path(id)).size!==meta.bytes)io.fail(409,'PC에 보관된 첨부 파일을 찾을 수 없습니다. 다시 첨부해 주세요.');return meta;}
  async cancel(id){if(!this.store.get('file-staging',id))return;await fs.promises.rm(this.path(id,'.part'),{force:true});this.store.remove('file-staging',id);}
}
module.exports={LocalFiles};
