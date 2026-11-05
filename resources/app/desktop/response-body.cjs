'use strict';
// Collects an HTTP response body as raw bytes and decodes UTF-8 once at the end, so a
// multi-byte character (Korean text) split across network chunks is never corrupted.
// The size limit is counted in received bytes.
const MAX_RESPONSE_BYTES=16*1024*1024;
function createBodyCollector(limit=MAX_RESPONSE_BYTES){
  const chunks=[];let bytes=0;
  return {
    // Returns false once the limit is exceeded; the caller then aborts the response.
    push(chunk){
      const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
      bytes+=buffer.length;
      if(bytes>limit)return false;
      chunks.push(buffer);return true;
    },
    get bytes(){return bytes;},
    text(){return Buffer.concat(chunks).toString('utf8');}
  };
}
module.exports={createBodyCollector,MAX_RESPONSE_BYTES};
