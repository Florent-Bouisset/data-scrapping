
const cliProgress = require('cli-progress');
const puppeteer = require('puppeteer');
const assert = require('assert')
const MongoClient = require('mongodb').MongoClient;
const urlDB = 'mongodb://localhost:27017/mydb';
const dbName = 'ProjectThesis'



async function postThesisInDB(data, database) {
    await database.collection('ThesisWritingAndAutomation').insertOne({
        HTML: data
    })
}

async function getAllArticleOfThePage(page, db) {
    const maxArticlePerPage = 200
    for (let article = 0; article < maxArticlePerPage; article++) {
        let innerHTML = await page.$eval(`[data-ri="${article}"]`, (element => { return element.innerHTML }));
        await postThesisInDB(innerHTML, db)
    }
}

async function changeArticlePerPage(page) {
    const listSelector = '[id="resultListCommandsForm:perPage:input"]';
    await page.waitForSelector(listSelector);
    await page.select(listSelector, "200");

}





async function goToNextPage(page) {
    const nextPageBtn = '[aria-label="Next Page"]';
    await page.waitForSelector(nextPageBtn);
    await page.click(nextPageBtn)
}

async function scrapAllArticle(page, db) {
    const maxPage = 21;
    const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar1.start(maxPage, 0)
    for (let actualPage = 0; actualPage < maxPage; actualPage++) {
        await page.waitFor(10000)
        await getAllArticleOfThePage(page, db);
        await goToNextPage(page);
        bar1.update(actualPage + 1);
    }
}

async function research(search, page) {
    const url = 'https://patentscope.wipo.int/search/en/search.jsf';
    const searchSelector = '[id="simpleSearchForm:fpSearch:input"]';
    await page.goto(url);
    await page.waitForSelector(searchSelector);
    await page.type(searchSelector, search)
    await page.waitFor(1000)
    await page.keyboard.press('Enter');
}



(async () => {
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null, });
    const pages = await browser.pages();
    const page = pages[0];
    await page.setViewport({
        width: 800,
        height: 1000,
    });  //
    MongoClient.connect(urlDB, async function (err, client) {
        assert.equal(null, err);
        console.log("Connected to the data base successfully");
        const db = client.db(dbName);

        await research('Writing) AND (Automation', page);
        page.waitFor(3000)
        await changeArticlePerPage(page);
        page.waitFor(3000)
        await scrapAllArticle(page, db);
        await browser.close();
        client.close();
    })
})();
