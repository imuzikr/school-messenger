'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),limits=require('../js/attachment-limits.js');
test('attachment limits accept exact boundaries and reject excess count, individual size and combined size',()=>{
 assert.equal(limits.validate(Array(20).fill(1)),'');assert.match(limits.validate(Array(21).fill(1)),/20/);
 assert.equal(limits.validate([limits.maxFileBytes]),'');assert.match(limits.validate([limits.maxFileBytes+1]),/500 MB/);assert.equal(limits.validate([limits.maxFileBytes,limits.maxFileBytes,limits.maxFileBytes,limits.maxFileBytes,48*1024*1024]),'');assert.match(limits.validate([limits.maxFileBytes,limits.maxFileBytes,limits.maxFileBytes,limits.maxFileBytes,48*1024*1024+1]),/2 GB/);
 for(const count of [0,1,2,3,100,2*1024*1024])assert.equal(limits.dataBytes('data:application/octet-stream;base64,'+Buffer.alloc(count).toString('base64')),count);
});
