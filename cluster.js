'use strict';

const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;
const util = require('util');
const Memcached = require('memcached');

let memcached = new Memcached();
memcached.connect('127.0.0.1:11211', function(err, conn){
  if (err) {
    console.log(conn.server);
  } else {
    // console.log(conn);
  }
});

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  const spawn = require('child_process').spawn;
  const launch_memcached = spawn('memcached');

  launch_memcached.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });
  
  memcached.set('sum_data', 0, 100000, (err) => {
    if(err) throw new err;
  });
  memcached.get('sum_data', function (err, data) {
    console.log(data);
  });

  // Fork
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Workers can share any TCP connection
  // IN this case it is an HTTP server
  // http.createServer((req, res) => {
  //   res.writeHead(200);
  //   res.end('hello world\n');
  // }).listen(8000);
  console.log(`Worker ${process.pid} started`);

  const express = require('express');
  const app = express();

  app.get('/', (req, res) => {
    let time = req.query.time*1
    setTimeout(()=>{
      console.log(`WORKED!! ${process.pid} with time : ${time}ms`);
      res.send(`worker ${process.pid} with time : ${time}ms`);
    }, time);
  });

  app.listen(8000);

  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', function (text) {
    if (text === 'get_data\n') {
      memcached.get('sum_data', function (err, data) {
        console.log('sum : ', data, " - from ", process.pid);
      });
    } else {
      let val = text.replace('\n','') * 1;
      memcached.incr('sum_data', val, function (err) { 
        console.log(err);
       });
      memcached.get('sum_data', function (err, data) {
        console.log('sum : ', data, " - from ", process.pid);
      });
    }
    // process.exit();
  });
}