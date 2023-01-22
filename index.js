const express = require('express');
const fs = require('fs');
const dbRouter = require('./db-routes');
const cors = require ('cors')
const jwt = require('jsonwebtoken');



const app = express();
app.use(express.json());
app.options('*', cors())
app.use(logger);




app.use('/db', dbRouter);



app.all('*', (req, res) => {
  res.json({ api_funzionante: "nessuna risposta disponibile" });
})

app.listen(3000);



function logger(req,res,next) {
  console.log(`${new Date()} -> ${req.protocol}://${req.get('host')}${req.originalUrl} @ ${req.ip}`);
  res.header("Access-Control-Allow-Origin", "*");
  next();
}

