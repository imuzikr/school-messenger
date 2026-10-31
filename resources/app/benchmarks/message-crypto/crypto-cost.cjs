'use strict';
// PERFORMANCE FIXTURE ONLY. This is not an audited messaging protocol, and must
// never be imported by the shipped application. No identity/key lifecycle, key
// transparency, ratchet, multi-device recovery, or replay database is provided.
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const b64 = value => Buffer.from(value).toString('base64');
const un64 = value => Buffer.from(value, 'base64');
const keyPair = () => crypto.generateKeyPairSync('x25519');
const signingPair = () => crypto.generateKeyPairSync('ed25519');

function seal(key, bytes, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {iv:b64(iv), data:b64(ciphertext), tag:b64(cipher.getAuthTag())};
}
function open(key, box, aad) {
  const cipher = crypto.createDecipheriv('aes-256-gcm', key, un64(box.iv));
  cipher.setAAD(Buffer.from(aad));
  cipher.setAuthTag(un64(box.tag));
  return Buffer.concat([cipher.update(un64(box.data)), cipher.final()]);
}
function wrappingKey(privateKey, publicKey, messageId, recipientId) {
  const shared = crypto.diffieHellman({privateKey, publicKey});
  return Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.from(messageId),
    Buffer.from('dingdong-benchmark-only/' + recipientId), 32));
}
function encryptContent(content, messageId, recipients, signer) {
  const ephemeral = keyPair();
  const contentKey = crypto.randomBytes(32);
  const packet = {
    fixture:'NOT-FOR-PRODUCTION-v1', id:messageId,
    ephemeral:b64(ephemeral.publicKey.export({type:'spki', format:'der'})),
    content:seal(contentKey, Buffer.from(JSON.stringify(content)), messageId),
    keys:recipients.map(recipient => ({id:recipient.id, ...seal(
      wrappingKey(ephemeral.privateKey, recipient.publicKey, messageId, recipient.id),
      contentKey, messageId + '/' + recipient.id)}))
  };
  const payload = JSON.stringify(packet);
  return JSON.stringify({payload, signature:b64(crypto.sign(null, Buffer.from(payload), signer.privateKey))});
}
function decryptContent(serialized, messageId, recipient, signerPublic) {
  const envelope = JSON.parse(serialized);
  assert.ok(crypto.verify(null, Buffer.from(envelope.payload), signerPublic, un64(envelope.signature)), 'signature');
  const packet = JSON.parse(envelope.payload);
  assert.equal(packet.fixture, 'NOT-FOR-PRODUCTION-v1');
  assert.equal(packet.id, messageId);
  const wrapped = packet.keys.find(entry => entry.id === recipient.id);
  assert.ok(wrapped, 'recipient key missing');
  const ephemeral = crypto.createPublicKey({key:un64(packet.ephemeral), type:'spki', format:'der'});
  const key = open(wrappingKey(recipient.privateKey, ephemeral, messageId, recipient.id), wrapped, messageId + '/' + recipient.id);
  return JSON.parse(open(key, packet.content, messageId).toString('utf8'));
}
function selfCheck() {
  const a = {id:'a', ...keyPair()}, b = {id:'b', ...keyPair()}, signer = signingPair();
  const original = {title:'시험 제목', body:'시험 본문', html:''};
  const packet = encryptContent(original, 'self-check', [a,b], signer);
  for (const recipient of [a,b]) assert.deepEqual(decryptContent(packet, 'self-check', recipient, signer.publicKey), original);
  assert.throws(() => decryptContent(packet, 'wrong-id', a, signer.publicKey));
  assert.throws(() => decryptContent(packet, 'self-check', {id:'outsider', ...keyPair()}, signer.publicKey));
  const modified = JSON.parse(packet);
  modified.payload = modified.payload.replace('NOT-FOR-PRODUCTION', 'BAD-FOR-PRODUCTION');
  assert.throws(() => decryptContent(JSON.stringify(modified), 'self-check', a, signer.publicKey));
  assert.throws(() => decryptContent(packet, 'self-check', {id:'a', ...keyPair()}, signer.publicKey));
  return {roundTrip:true, wrongIdRejected:true, wrongRecipientRejected:true, tamperRejected:true, wrongKeyRejected:true};
}
module.exports = {keyPair, signingPair, encryptContent, decryptContent, selfCheck};
