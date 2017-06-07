'use strict';

const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
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
    setTimeout(()=>{
      console.log(`WORKED!! ${process.pid}`);
      res.send(`worker ${process.pid}`);
    }, 3000);
  });

  app.listen(8000);
}