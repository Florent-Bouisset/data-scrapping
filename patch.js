
const cliProgress = require('cli-progress');
const assert = require('assert');
const HTMLParser = require('node-html-parser');
const cheerio = require("cheerio");
const { ObjectID } = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const urlDB = 'mongodb://localhost:27017/mydb';
const dbName = 'ProjectThesis'
const collectionName = 'Thesis'


function stripHtml(html) {
    return html.replace(/(<([^>]+)>)/gi, "");
}

function getStringFromHtml(html, selector) {
    //const html = object.HTML;
    const $ = cheerio.load(html);
    const partOfHtml = cheerio.html($(selector))
    const dataString = stripHtml(partOfHtml)
    return dataString;
}
function getApplicantFromHtml(object) {
    const selector = '.ps-patent-result--fields--group .ps-field:nth-child(3) .ps-field--value'
    return getStringFromHtml(object, selector)
}

function getInventorFromHtml(object) {
    const selector = '.ps-patent-result--fields--group .ps-field:nth-child(4) .ps-field--value'
    return getStringFromHtml(object, selector)
}

function getCountryCodeFromHtml(object) {
    const selector = '.ps-patent-result--title--ctr-pubdate span:first-child'
    return getStringFromHtml(object, selector)
}

function getDateFromHtml(object) {
    const selector = '.ps-patent-result--title--ctr-pubdate span:last-child'
    return getStringFromHtml(object, selector)
}

function getIdBrevetFromHtml(object) {
    const selector = '.notranslate.ps-patent-result--title--patent-number'
    return getStringFromHtml(object, selector)
}

function getTitleFromHtml(object) {
    const selector = '.ps-patent-result--title--title.content--text-wrap'
    return getStringFromHtml(object, selector)
}

function getContentFromHtml(object) {
    const selector = '.ps-patent-result--abstract'
    return getStringFromHtml(object, selector)
}


async function getArrayID() {
    // connect to your cluster
    const client = await MongoClient.connect(urlDB,);
    // specify the DB's name
    const db = client.db(dbName);
    // execute find query
    const items = await db.collection(collectionName).find({}).project({ _id: 1 }).map(x => x._id).toArray();
    // close connection
    client.close();
    return items
}

async function editOneDocument(id) {
    // connect to your cluster
    try {
        const client = await MongoClient.connect(urlDB,);

        // specify the DB's name
        const db = client.db(dbName);

        let data = await db.collection(collectionName).find({ _id: id }).project({ HTML: 1 }).map(x => x.HTML).toArray();
        data = data[0];

        var title = getTitleFromHtml(data)
        var content = getContentFromHtml(data)
        var country = getCountryCodeFromHtml(data)
        var brevet = getIdBrevetFromHtml(data)
        var date = getDateFromHtml(data)
        var applicant = getApplicantFromHtml(data)
        var inventor = getInventorFromHtml(data)

        var newValues = { 'title': title, 'country': country, 'date': date, 'idBrevet': brevet, 'content': content, 'applicant': applicant, 'inventor': inventor }

        db.collection(collectionName).findOneAndUpdate(
            { _id: id },
            { $set: newValues },
            { returnOriginal: false, upsert: true },

            function (err, doc) {
                if (err) {
                    console.log('Erreur ')
                }
            }
        )
        client.close()
    }
    catch (e) {
        console.log("Document " + id + " skipped");
        return
    }
}

async function main() {
    let array = await getArrayID()
    const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar1.start(array.length, 0)

    for (let i = 0; i < array.length; i++) {
        await editOneDocument(array[i])
        bar1.update(i + 1);
    }
}

main()