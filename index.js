const express = require('express');
const fs = require('fs');
const dbRouter = require('./db-routes');
const jwt = require('jsonwebtoken');
const cors = require ('cors')



const app = express();
app.use(express.json());
app.options('*', cors())
app.use(logger);

app.post('/newuser', (req, res) => {
  const username = req.body.username;

  //TODO 
  //aggiungere l'utente nel db
  const accessToken = generateAccessToken(username);
  res.json({ accessToken: accessToken });
})

app.post('/login', (req, res) => {
  const username = req.body.username;
  const accessToken = generateAccessToken(username);
  res.json({ accessToken: accessToken });
})


app.use(authToken)
app.use('/db', dbRouter);


app.all('*', (req, res) => {
  res.json({ ti_saluta: "stocazzo" });
})

app.listen(3000);



function logger(req,res,next) {
  console.log(`${new Date()} -> ${req.protocol}://${req.get('host')}${req.originalUrl} @ ${req.ip}`);
  res.header("Access-Control-Allow-Origin", "*");
  next();
}

function generateAccessToken(username) {
  return jwt.sign( {username:username}, process.env.TOKEN_GEN, { expiresIn: '1800s' })
}

function authToken(req,res, next){
  const token = req.headers.accesstoken
  if(token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.TOKEN_GEN, (err, data) => {
    if(err!==null) return res.sendStatus(401)
    next();
  })
}
