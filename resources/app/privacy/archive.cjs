'use strict';
// Password-protected portable PC archive using standard JWE PBES2.
const enc=new TextEncoder();
function password(value){if(typeof value!=='string'||value.length<12||value.length>128)throw new Error('보관 파일 비밀번호는 12~128자로 입력하세요.');return enc.encode(value);}
async function seal(value,pass){const {CompactEncrypt}=await import('jose');return new CompactEncrypt(enc.encode(JSON.stringify(value))).setProtectedHeader({alg:'PBES2-HS512+A256KW',enc:'A256GCM',p2c:210000,typ:'dingdong-pc-archive-v1'}).encrypt(password(pass));}
async function open(value,pass){const {compactDecrypt}=await import('jose');let result;try{result=await compactDecrypt(value,password(pass),{keyManagementAlgorithms:['PBES2-HS512+A256KW'],contentEncryptionAlgorithms:['A256GCM'],maxPBES2Count:220000});}catch{throw new Error('보관 파일 비밀번호가 다르거나 파일이 손상되었습니다.');}if(!['dingdong-pc-archive-v1','ieum-pc-archive-v1'].includes(result.protectedHeader.typ))throw new Error('띵동 PC 보관 파일이 아닙니다.');return JSON.parse(new TextDecoder().decode(result.plaintext));}
module.exports={seal,open};
