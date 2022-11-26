const { MongoClient } = require("mongodb");

const express = require('express');
const router = express.Router();


const plcs = ["Italy", "United States", "Brazil", "Argentina", "Cuba", "Mexico", "United Kingdom", "Peru", "Colombia", "Chile",
    "Spain", "France", "Portugal", "Germany", "Poland", "Austria", "Switzerland", "Netherlands", "Belgium", "Greece"];
let locations = [];
let db;
connectDB();

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
    let nr;
    try {
        nr = await addRadiosToDb();
        return nr;
    } catch (err) { return err };
}

async function addRadiosToDb() {
    let query;
    let nr = 0;
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
                        name: radio.title,
                        city: item.title,
                        geo: item.geo,
                        country: item.country,
                        conn: conn,
                    }
                    await db.collection('radios').insertOne(doc);
                    nr++;
                })
            }
        })
        return { radioAdded: nr };
    } catch (err) { return err }
}


router.get('/initdb', async (req, res) => {
    res.json(await initdb(req, res))
})

router.get('/testdb', async (req, res) => {
    res.json(await testdb());
})

module.exports = router