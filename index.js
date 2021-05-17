const puppeteer = require('puppeteer');
const readline = require("readline");
const fs = require("fs");
const path = require("path");

OPTIONS = require("./settings.json");

//services
const downloadImages = require("./services/downloadImages");
const scrapeURLs = require("./services/scrapeURLs");

//GET SEARCH TEXT
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let searchText = "";

function getSearchText(){
    rl.question("Enter search text:", text => {
        searchText = text;
        if(!searchText){
            console.log("\nYou must write search text.");
            getSearchText();
        }

        parser();
    });
}

getSearchText();


//PARSING

async function parser(){
    try{
        const browser = await puppeteer.launch({
            // headless: false
        });
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['font'].indexOf(request.resourceType()) !== -1) {
                request.abort();
            } else {
                request.continue();
            }
        });
        await page.goto(`https://yandex.ru/images/search?text=${searchText}`);
        await page.setViewport({
            width: 1200,
            height: 800
        });

        console.log("Getting URLs...");
        let urls = await scrapeURLs(page, OPTIONS.MAX_IMAGES, OPTIONS.SCROLL_DELAY);

        fs.writeFileSync(OPTIONS.URLS_FILE + ".json", JSON.stringify({ urls }));

        console.log(`URLs are ready! (${urls.length})`);

        await browser.close();

        if(OPTIONS.DOWNLOAD_IMAGES){
            console.log("Downloading images from URLs...");
            const filesDownloaded = await downloadImages(urls, path.join(__dirname, OPTIONS.IMAGES_FOLDER));
            console.log(`Downloaded ${filesDownloaded} images from ${urls.length} URLs.`);
        }

        console.log("Done!");

        process.exit(0);
    } catch(err){
        console.log(err);
    }
};