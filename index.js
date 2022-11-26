const express = require('express');
const fs = require('fs');
const dbRouter = require('./db-routes');


const app = express();
app.use(express.json());
app.use('/db', dbRouter);


app.all('*', (req, res) => {
  res.json({ ti_saluta: "stocazzo" });
})

app.listen(3000);