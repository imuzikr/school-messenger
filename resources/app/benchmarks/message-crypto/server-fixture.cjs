'use strict';
// Starts the UNMODIFIED app server with an isolated, synthetic database.
const {startServer} = require('../../server/index.cjs');
const {DatabaseSync} = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');
let server, fixtureDb;
async function start() {
  server = await startServer({port:0, host:'127.0.0.1', address:'https://localhost:8443',
    dataDir:process.argv[2], schoolName:'Synthetic benchmark only',
    admin:{username:'benchmark-admin', password:'Synthetic-benchmark-password-123', name:'Benchmark'},
    onError:error => process.stderr.write(String(error.stack || error) + '\n')});
  fixtureDb = new DatabaseSync(path.join(server.dataDir, 'dingdong.sqlite'));
  fixtureDb.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const template = fixtureDb.prepare('SELECT * FROM users LIMIT 1').get();
  const insertUser = fixtureDb.prepare('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt,admin,disabled,must_change) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  const insertSession = fixtureDb.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)');
  const users = [];
  fixtureDb.exec('BEGIN');
  for (let index=0; index<71; index++) {
    const id = 'bench-user-' + String(index).padStart(3,'0');
    const token = crypto.randomBytes(32).toString('hex');
    insertUser.run(id,id,id,'교무부','교사','','',template.digest,template.salt,0,0,0);
    insertSession.run(crypto.createHash('sha256').update(token).digest('hex'), id, Date.now()+4*60*60*1000);
    users.push({id,token});
  }
  fixtureDb.exec('COMMIT');
  process.send({ready:true, port:server.port, certificate:server.connection.certificate, users});
}
process.on('message', async message => {
  try {
    if (message.kind==='reset') {
      fixtureDb.exec('BEGIN; DELETE FROM mails; DELETE FROM items; DELETE FROM events; DELETE FROM auto_deadline_sources; COMMIT;');
      process.send({rpc:message.rpc, ok:true});
    } else if (message.kind==='metrics') {
      process.send({rpc:message.rpc, cpu:process.cpuUsage(), memory:process.memoryUsage(), resources:process.resourceUsage()});
    } else if (message.kind==='inspect') {
      const row = fixtureDb.prepare('SELECT payload FROM mails WHERE id=?').get(message.id);
      process.send({rpc:message.rpc, payload:row ? JSON.parse(row.payload) : null,
        mails:fixtureDb.prepare('SELECT count(*) n FROM mails').get().n,
        recipients:fixtureDb.prepare('SELECT count(*) n FROM recipients').get().n,
        extractedItems:fixtureDb.prepare('SELECT count(*) n FROM items').get().n});
    } else if (message.kind==='close') {
      fixtureDb.close(); await server.close(); process.send({rpc:message.rpc, ok:true}); process.disconnect();
    }
  } catch (error) { process.send({rpc:message.rpc, error:String(error.stack || error)}); }
});
start().catch(error => {process.stderr.write(String(error.stack || error)+'\n');process.exit(1);});
