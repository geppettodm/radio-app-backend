const { MongoClient } = require("mongodb");
const ObjectID = require("mongodb").ObjectId;
const gis = require('async-g-i-s');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');


const express = require('express');
const router = express.Router();

// INIZIALIZZAZIONE DB E TEST

const plcs = ["Italy", "Brazil", "Cuba", "United Kingdom", "Spain", "France",
    "Germany", "Greece"];
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

// FUNZIONI DB

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
        if (!doc.image) {
            doc.image = await getRadioImage(doc._id);
        }
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
    skip = skip * limit

    string = string.toLowerCase();
    let query = { "name": { $regex: string } };
    const cursor = db.collection('radios').find(query).sort({ "name": 1 }).limit(limit).skip(skip);
    for await (const doc of cursor) {
        if (!doc.image) {
            doc.image = await getRadioImage(doc._id);
        }
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
    let url = null;
    // try {
    //     url = await gis(string);
    //     return url[0].url;
    // } catch (err) { console.log(url) }
    return url
}

async function getRadioImage(id) {
    let query = { "_id": new ObjectID(id) };
    let radio = await db.collection('radios').findOne(query);
    if (!radio.image) {
        const url = await returnImageURL(radio.name);
        const updateDoc = { $set: { image: url } };
        //to not create a document if no documents match the filter
        const option = { upsert: false };
        await db.collection('radios').updateOne(query, updateDoc, option);
    }
    radio = await db.collection('radios').findOne(query);
    return radio.image;
}

async function getRadioNear(req) {
    let skip = Number(req.query.skip);
    let limit = Number(req.query.limit);
    let x = Number(req.query.x);
    let y = Number(req.query.y);
    let ext = Number(req.query.ext);


    let page = [];
    if (!skip || skip < 0) skip = 0;
    if (!limit || limit < 1) limit = 3;
    skip = skip * limit


    let query = {
        $and: [{ 'geo.1': { $lt: (x + ext) } }, { 'geo.1': { $gt: (x - ext) } },
        { 'geo.0': { $lt: (y + ext) } }, { 'geo.0': { $gt: (y - ext) } }]
    };
    let cursor = await db.collection("radios").find(query).sort({ "city": 1 }).limit(limit).skip(skip)

    for await (const doc of cursor) {
        if (!doc.image) {
            doc.image = await getRadioImage(doc._id);
        }
        page.push(doc);
    }
    if (page.length > 0) return page
    return
}

async function getRadioArea(req) {
    let area = req.query.country;
    let page = []

    const agg = db.collection('radios').aggregate([{ $match: { country: area } }, { $sample: { size: 10 } }]);
    for await (const doc of agg) {
        if (!doc.image) {
            doc.image = await getRadioImage(doc._id);
        }
        page.push(doc);
    }
    return page
}

async function getUrl(req) {
    let fgd;
    try {
        fgd = await fetch(req.query.string);
        return fgd.url;
    } catch (err) {
        console.log(err);
        return null
    };
}

async function getFavourites(req) {
    const user = JSON.parse(Buffer.from(req.headers.accesstoken.split('.')[1], 'base64')).username
    const query = { username: user }
    const userDoc = await db.collection('users').findOne(query)
    if (!userDoc || !userDoc.favourites) return null
    let favs = [];
    for(let id in userDoc.favourites){
        favs.push(await db.collection('radios').findOne({ "_id": new ObjectID(userDoc.favourites[id]) }))
    }
    return favs;
}

async function addFavourite(req) {
    const id = req.body.id
    const username = JSON.parse(Buffer.from(req.headers.accesstoken.split('.')[1], 'base64')).username
    const user = db.collection('users').findOne({ username: username })

    db.collection('users').updateOne(
        { username: username },
        { $push: { favourites: id } }
    )

}

async function removeFavourite(req) {
    const id = req.body.id
    const username = JSON.parse(Buffer.from(req.headers.accesstoken.split('.')[1], 'base64')).username
    const user = db.collection('users').updateOne(
        { username: username },
        { $pull: { favourites: id } }
    )
}



// AUTENTICAZIONE E LOGIN

function authToken(req, res, next) {
    const token = req.headers.accesstoken
    if (token == null) return res.sendStatus(401)

    jwt.verify(token, process.env.TOKEN_GEN, (err, data) => {
        if (err !== null) return res.sendStatus(401)
        next();
    })
}

router.post('/newuser', async (req, res) => {
    const username = req.body.username;
    const y = await db.collection('users').findOne({ username: username })
    if (y) return res.status(400).send('Username already exists');
    const password = crypto.createHash('sha256').update(req.body.password).digest('base64');
    db.collection('users').insertOne({ username: username, password: password, favourites: [] });
    const accessToken = generateAccessToken(username);
    res.json({ accessToken: accessToken });
})

router.post('/login', async (req, res) => {
    const username = req.body.username;
    await db.collection('users').findOne({ username: username }).then((user) => {
        if (!user) return res.status(400).send('Username not found');
        const password = crypto.createHash('sha256').update(req.body.password).digest('base64');
        if (user.password !== password) return res.status(400).send('Wrong password');
        const accessToken = generateAccessToken(username);
        res.json({ accessToken: accessToken });
    });

})

function generateAccessToken(username) {
    return jwt.sign({ username: username }, process.env.TOKEN_GEN, { expiresIn: '1800s' })
}



router.use(authToken)
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

router.get('/img', async function (req, res) { res.json(await returnImageURL(req.query.string)) });
router.get('/get-img', async function (req, res) { res.json(await getRadioImage(req.query.id)) });

router.get('/near', async function (req, res) { res.json(await getRadioNear(req)) });
router.get('/radios', async function (req, res) { res.json(await getRadioArea(req)) });

router.get('/url', async function (req, res) { res.json(await getUrl(req)) })

router.get('/favourites', async function (req, res) { res.json(await getFavourites(req)) });
router.post('/add-favourite', async function (req, res) { res.json(await addFavourite(req)) });
router.post('/remove-favourite', async function (req, res) { res.json(await removeFavourite(req)) });



module.exports = router