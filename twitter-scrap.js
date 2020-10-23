const cliProgress = require('cli-progress');
const {
    promisify
} = require('util')
const sleep = promisify(setTimeout)
const puppeteer = require('puppeteer');
const assert = require('assert')
const MongoClient = require('mongodb').MongoClient;
const urlDB = 'mongodb://localhost:27017/mydb';
const dbName = 'ProjectThesis'
const collectionName = 'TweetsArtificialIntelligence'


var Twitter = require('twitter');
var config = require('./config.js');
var T = new Twitter(config);
var minId;
var minIdInit = false;

// Set up your search parameters
var params = {
    q: '#ArtificialIntelligence AND -filter:retweets',
    tweet_mode: 'extended',
    count: 80,
    result_type: 'recent',
    lang: 'en'
}

async function dropCollection() {
    try {
        let clientMongo = await MongoClient.connect(urlDB)
        const db = clientMongo.db(dbName);
        await db.collection(collectionName).drop()
        clientMongo.close();
    } catch (e) {
        console.log("Can't drop collection, script continued without deleting")
    }
    console.log("Collection dropped")
}

async function saveTweetInDB(db, tweet) {
    await db.collection(collectionName).insertOne(tweet)
}

async function updateQuery() {
    params.max_id = minId
}

async function waitIfLowOnRemainingRequests(remainingAmount) {
    if (remainingAmount < 10) {
        const waitingBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

        var timer = 0
        const timeToWait = 15 * 60 * 1000 //15 minutes
        console.log("Waiting 15 minutes to regain requests")
        waitingBar.start(timeToWait / 1000, 0)
        while (timer < timeToWait) {
            await sleep(1000)
            timer += 1000
            waitingBar.update(timer / 1000)
        }
        waitingBar.stop()
    }
}

async function updateMinId(currentId) {
    if (!minIdInit) {
        minIdInit = true
        minId = currentId
    }
    if (currentId < minId) {
        minId = currentId
    }
    params.max_id = minId
}

async function doOneRequest() {
    return new Promise((resolve, reject) => {
        T.get('search/tweets', params, async function (err, data, response) {
            if (!err) {
                var client = await MongoClient.connect(urlDB)
                var db = client.db(dbName);
                if (response.caseless.dict.status === "200 OK") {
                    for (let i = 0; i < await data.statuses.length; i++) {
                        await saveTweetInDB(db, data.statuses[i])
                        let id = await data.statuses[i].id
                        await updateMinId(id)
                    }
                    let remainingRequest = response.caseless.dict['x-rate-limit-remaining']
                    await waitIfLowOnRemainingRequests(remainingRequest);
                } else {}
                await client.close();

                resolve()
            } else {
                console.log(err);
                reject()
            }
        })
    })
}



async function getAllTweets() {

    const multibar = new cliProgress.MultiBar({
        format: ' {bar} | {task} | {value}/{total}',
        clearOnComplete: false,
        hideCursor: true

    }, cliProgress.Presets.shades_grey);

    const b1 = multibar.create(1000, 0, {
        task: "succeeded requests"
    });
    const b2 = multibar.create(1000, 0, {
        task: "failed requests   "
    });

    while (true) {
        try {
            await doOneRequest()
            await updateQuery()
            b1.increment()
        } catch (e) {
            b2.increment()

        }
    }

}

getAllTweets()