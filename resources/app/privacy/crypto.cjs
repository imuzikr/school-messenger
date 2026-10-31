'use strict';
// Standard JOSE JWE (RFC 7516) + JWS (RFC 7515), not the performance fixture.
// One content ciphertext; ECDH-ES+A256KW wraps its key for each account.
const {createHash}=require('node:crypto');
const jose=()=>import('jose');
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function newIdentity(){
  const j=await jose(), enc=await j.generateKeyPair('ECDH-ES+A256KW',{extractable:true}),sign=await j.generateKeyPair('EdDSA',{extractable:true});
  return {version:1,encryption:await j.exportJWK(enc.privateKey),signing:await j.exportJWK(sign.privateKey)};
}
function publicIdentity(identity){
  const {d:ed,...encryption}=identity.encryption,{d:sd,...signing}=identity.signing;
  return {version:1,encryption,signing};
}
async function validatePublic(identity){
  if(!identity||identity.version!==1||identity.encryption?.kty!=='EC'||identity.encryption.crv!=='P-256'||identity.signing?.kty!=='OKP'||identity.signing.crv!=='Ed25519')throw new Error('암호화 공개키 형식이 올바르지 않습니다.');
  for(const [key,fields] of [[identity.encryption,['kty','crv','x','y']],[identity.signing,['kty','crv','x']]]){
    if(Object.keys(key).some(k=>!fields.includes(k))||fields.some(k=>typeof key[k]!=='string')||JSON.stringify(key).length>500)throw new Error('공개키에 허용하지 않는 값이 있습니다.');
  }
  const j=await jose();await j.importJWK(identity.encryption,'ECDH-ES+A256KW');await j.importJWK(identity.signing,'EdDSA');
  return {version:1,encryption:{kty:'EC',crv:'P-256',x:identity.encryption.x,y:identity.encryption.y},signing:{kty:'OKP',crv:'Ed25519',x:identity.signing.x}};
}
async function fingerprint(identity){const p=await validatePublic(identity),j=await jose();return digest([await j.calculateJwkThumbprint(p.encryption),await j.calculateJwkThumbprint(p.signing)]);}
function context(kind,id,sender,targets,room=''){return {version:1,kind,id,sender,targets:[...new Set([sender,...targets])].sort(),room};}
async function encrypt(content,ctx,identity,publicKeys){
  const j=await jose(), encryptor=new j.GeneralEncrypt(bytes(content)).setProtectedHeader({enc:'A256GCM',typ:'ieum-content-v1'}).setAdditionalAuthenticatedData(bytes(ctx));
  for(const userId of ctx.targets){const key=publicKeys[userId];if(!key)throw new Error('수신자가 아직 암호화 키를 등록하지 않았습니다. 먼저 한 번 로그인해야 합니다.');
    encryptor.addRecipient(await j.importJWK(key.encryption,'ECDH-ES+A256KW')).setUnprotectedHeader({alg:'ECDH-ES+A256KW',kid:userId});}
  const jwe=await encryptor.encrypt();
  return new j.CompactSign(bytes({context:ctx,jwe})).setProtectedHeader({alg:'EdDSA',typ:'ieum-signed-content-v1'}).sign(await j.importJWK(identity.signing,'EdDSA'));
}
async function inspect(sealed,senderPublic,expected){
  if(typeof sealed!=='string'||sealed.length>7500000)throw new Error('암호화 메시지 크기가 올바르지 않습니다.');
  const j=await jose(),verified=await j.compactVerify(sealed,await j.importJWK(senderPublic.signing,'EdDSA'),{algorithms:['EdDSA']});
  if(verified.protectedHeader.typ!=='ieum-signed-content-v1')throw new Error('지원하지 않는 메시지 서명입니다.');
  const packet=JSON.parse(new TextDecoder().decode(verified.payload)),ctx=packet.context,jwe=packet.jwe;
  if(!same(ctx,expected)||!same(jwe?.recipients?.map(r=>r.header?.kid).sort(),ctx.targets)||jwe.recipients.some(r=>r.header.alg!=='ECDH-ES+A256KW'))throw new Error('메시지 발신자 또는 수신 대상이 일치하지 않습니다.');
  if(Buffer.from(jwe.aad||'','base64url').toString()!==JSON.stringify(ctx))throw new Error('메시지 인증 정보가 일치하지 않습니다.');
  const header=j.decodeProtectedHeader(jwe);
  if(header.enc!=='A256GCM'||header.typ!=='ieum-content-v1'||header.zip)throw new Error('지원하지 않는 메시지 암호화입니다.');
  return packet;
}
async function decrypt(sealed,ctx,identity,senderPublic,userId){
  const j=await jose(),packet=await inspect(sealed,senderPublic,ctx);
  if(!ctx.targets.includes(userId))throw new Error('이 메시지의 수신자가 아닙니다.');
  const jwe={...packet.jwe,recipients:packet.jwe.recipients.filter(r=>r.header.kid===userId)};
  const result=await j.generalDecrypt(jwe,await j.importJWK(identity.encryption,'ECDH-ES+A256KW'),{keyManagementAlgorithms:['ECDH-ES+A256KW'],contentEncryptionAlgorithms:['A256GCM']});
  return JSON.parse(new TextDecoder().decode(result.plaintext));
}
module.exports={newIdentity,publicIdentity,validatePublic,fingerprint,context,encrypt,decrypt,inspect,digest};
