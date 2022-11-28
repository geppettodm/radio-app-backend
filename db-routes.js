const { MongoClient } = require("mongodb");
const ObjectID = require("mongodb").ObjectId;
const gis = require('async-g-i-s');

async function importGoogleImage() {
    const { googleImage } = await import("free-google-image-search");
    return googleImage;
}


const express = require('express');
const router = express.Router();


const plcs = ["Italy", "United States", "Brazil", "Argentina", "Cuba", "Mexico", "United Kingdom", "Colombia", "Chile",
    "Spain", "France", "Germany", "Greece"];
let locations = [];
let db;
connectDB();
//await initdb();

async function connectDB() {
    const uri = process.env.MONGOURI;
    const client = await new MongoClient(uri, { directConnection: true });
    await client.connect();
    db = client.db('radiodb');
}

async function testdb() {
    try {
        const query = { nome: 'stocazzo' };
        return db.collection('users').findOne(query);

    } catch (error) {
        return error;
    }
}

async function initdb(req, res) {
    let tofetch = "http://radio.garden/api/ara/content/places";
    let places = [];
    locations = await (await fetch(tofetch)).json();
    locations.data.list.forEach(async (element) => {
        if (plcs.includes(element.country)) {
            places.push(element);
        }
    });
    locations = places;
    try {
        return await addRadiosToDb();
    } catch (err) { return err };
}

async function addRadiosToDb() {
    let query;
    try {
        locations.forEach(async item => {
            query = { city: item.title };
            let n = await db.collection('radios').countDocuments(query);
            if (n < 1) {
                let tofetch = 'http://radio.garden/api/ara/content/page/' + item.id + '/channels'
                let radios = await (await fetch(tofetch)).json();
                radios.data.content[0].items.forEach(async radio => {
                    let conn = radio.href.split("/")[3];
                    let doc = {
                        name: radio.title.toLowerCase(),
                        city: item.title,
                        geo: item.geo,
                        country: item.country,
                        conn: conn,
                    }
                    await db.collection('radios').insertOne(doc);
                })
            }
        })
        return { radioAdded: ok };
    } catch (err) { return err }
}

async function randomRadios(req) {
    let number = Number(req.query.number);
    let rand = [];

    if (!number || number < 1) number = 10;

    const agg = db.collection('radios').aggregate([{ $sample: { size: number } }]);
    for await (const doc of agg) {
        rand.push(doc);
    }
    return rand;
}

async function queryRadios(req) {
    let skip = Number(req.query.skip);
    let limit = Number(req.query.limit);
    let string = String(req.query.string);

    if (string.length < 3) return null;

    let page = [];
    if (!skip || skip < 0) skip = 0;
    if (!limit || limit < 1) limit = 10;

    string = string.toLowerCase();
    let query = { "name": { $regex: string } };
    const cursor = db.collection('radios').find(query).sort({ "name": 1 }).limit(limit).skip(skip);
    for await (const doc of cursor) {
        page.push(doc);
    }
    return page;
}

async function returnRadioConn(req) {
    let id = req.query.id;
    let query = { "_id": new ObjectID(id) };
    if (id) {
        return await db.collection('radios').findOne(query, { projection: { conn: 1, _id: 0 } });
    } else return null;
}

async function returnRadio(req) {
    let id = req.query.id;
    let query = { "_id": new ObjectID(id) };
    if (id) {
        return await db.collection('radios').findOne(query);
    } else return null;
}

async function returnImageURL(string) {
    let url;
    try{
        url = await gis(string);
    } catch (err){console.log(err)}
    return url[0].url;
}

async function getRadioImage(id){
    let query = { "_id": new ObjectID(id) };
    let radio = await db.collection('radios').findOne(query);
    if(!radio.image){
        const url = await returnImageURL(radio.name);
        const updateDoc = {$set: {image: url}};
        //to not create a document if no documents match the filter
        const option = {upsert:false};
        await db.collection('radios').updateOne(query, updateDoc, option);
    }
    radio = await db.collection('radios').findOne(query);
    return radio.image;
}

router.get('/initdb', async (req, res) => {
    res.json(await initdb(req, res))
})

router.get('/testdb', async (req, res) => {
    res.json(await testdb());
})

router.get('/random', async function (req, res) { res.json(await randomRadios(req)) });
router.get('/query', async function (req, res) { res.json(await queryRadios(req)) });
router.get('/radio/url', async function (req, res) { res.json(await returnRadioConn(req)) });
router.get('/radio', async function (req, res) { res.json(await returnRadio(req)) })

router.get('/img', async function (req, res) {res.json(await returnImageURL(req.query.string))});
router.get('/get-img', async function (req, res) {res.json(await getRadioImage(req.query.id))});

module.exports = router