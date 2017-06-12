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
    if(err) console.log(err);
  });
  memcached.set('lock_flag', 0, 100000, (err) => {
    if(err) console.log(err);
  });

  // check memcached data
  memcached.getMulti(['sum_data', 'lock_flag'], function (err, data) {
    console.log('sum_data:', data.sum_data);
    console.log('lock_flag:', data.lock_flag);
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
    let sum_data;
    memcached.get('sum_data', (err, data) => {
      sum_data = data;
    });
    setTimeout(()=>{
      console.log(`WORKED!! ${process.pid} with time : ${time}ms`);
      res.send(`worker ${process.pid} with time : ${time}ms ... memcached data : ${sum_data}`);
    }, time);
  });

  app.get('/post_test', (req, res) => {
    // let data = req.body.data;
    res.redirect('/?time=3000');
  });

  app.listen(8000);

  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', function (text) {
    if (text === 'get_data\n') {
      memcached.getMulti(['sum_data', 'lock_flag'], function (err, data) {
        console.log('sum_data:', data.sum_data, "- from", process.pid);
        console.log('lock_flag:', data.lock_flag, "- from", process.pid);
      });
    } else if (text === 'get_flag\n') {
      memcached.get('lock_flag', (err, data) => {
        console.log(data);
      });
    } else {
      let val = text.replace('\n','') * 1;

      // get flag
      let flag = 0;
      memcached.get('lock_flag', (err, data) => {
        flag = data;
      });
      console.log(flag, typeof(flag));
      // check flag
      while (flag === 1) {
        console.log('inside while loop');
        memcached.get('lock_flag', (err, data) => {
          flag = data*1;
        });
      }
      // incr flag
      memcached.set('lock_flag', 1, (err) => {
        if (err) console.log(err);
      });

      // save data
      memcached.incr('sum_data', val, function (err) { 
        if (err) console.log(err);
      });
      // decr flag
      memcached.set('lock_flag', 0, (err) => {
        if (err) console.log(err);
      });

      memcached.get('sum_data', function (err, data) {
        console.log('sum : ', data, " - from ", process.pid);
      });
    }
    // process.exit();
  });
}

function getLockFlag() {
  let flag;
  memcached.get('lock_flag', (err, data) => {
    console.log('data:', data);
    flag = data*1;
    console.log(flag);
    return flag;
  });
}