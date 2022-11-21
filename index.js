const express = require ('express');
const { MongoClient } = require("mongodb");
const app = express();
const uri = require("./uri.json").uri;

const client = new MongoClient(uri, {directConnection:true});

app.get('/testdb', async (req,res) =>{
  res.json(await testdb());
})

async function testdb() {
  try {
    await client.connect();
    const users = client.db('radiodb').collection('users');
    const query = { nome: 'stocazzo' };
    return users.findOne(query);

  } catch(error){
    console.log(error);
  }
}

app.all('*', (req, res) => {
  res.json({ti_saluta:"stocazzo"});
})
app.listen(3000);