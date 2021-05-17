//разбить проект на файлы

const DOWNLOAD_IMAGES = true;
const IMAGES_FOLDER = "images";
const URLS_FILE = "URLs";
const SCROLL_DELAY = 1800;
const MAX_IMAGES = 2000;

const puppeteer = require('puppeteer');
const readline = require("readline");
const fs = require("fs");
const path = require('path');
const detectFileType = require('detect-file-type');
const isImage = require("is-image");
const fetch = require("node-fetch");
const https = require("https");
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

const DIR = path.join(__dirname, IMAGES_FOLDER);

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
            console.log("\nYou need to write search text.");
            getSearchText();
        }

        parser();
    });
}

getSearchText();


//PARSING

async function downloadImages(urls){

    if (fs.existsSync(DIR)) {
        fs.rmdirSync(DIR, {recursive: true})
    }
    fs.mkdirSync(DIR);

    for(index in urls){
        let url = urls[index++];
        try{
            const fileExt = url.href.match(/\.[0-9a-z]+(?=\?.*$)/i);
            const file = fs.createWriteStream(
                DIR +
                "/image" +
                index +
                (fileExt ? fileExt[0] : "")
            );
            let res = await fetch(url.src, {
                agent: url.src.match(/^(https)/i) ? httpsAgent : null
            });
            
            await new Promise(resolve => {
                file.on("finish", resolve);
                res.body.pipe(file);
            });

            const filename = file.path;

            //fix file exts
            if(!isImage(filename)){
                await new Promise((resolve, reject) => {
                    detectFileType.fromFile(filename, (err, data) => {
                        if(!data){
                            reject(new Error("This is not an image"));
                            return;
                        }
                        if(err){
                            reject(err);
                            return;
                        }
                        fs.renameSync(filename, filename + "." + data.ext);
                        resolve();
                    });
                });
            }
        } catch(err) {
            console.log("Error occured while downloading: ", url.src);
        }
    }

    return fs.readdirSync(DIR).length;
}

async function getImgURLs(page){
    return await page.$$eval(".serp-item.serp-item_type_search", els => els.map(
        el => {
            const data = JSON.parse(el.getAttribute("data-bem"));
            return {
                src: data["serp-item"]["preview"][0]["url"],
                href: data["serp-item"]["img_href"]
            };
        }
    ));
}

async function scrapeURLs(page, maxItems, scrollDelay){
    const scrollDistance = 3000;
    
    let scrollTo = scrollDistance;
    let items = [];
    try{
        while(items.length < maxItems){
            items = await getImgURLs(page);
            await page.evaluate(`window.scrollTo(0, ${scrollTo})`);
            scrollTo += scrollDistance;
            await page.waitForTimeout(scrollDelay);
            let scrollHeight = await page.evaluate("document.body.scrollHeight")
            if(scrollTo >= scrollHeight) break;
        }
        return items;
    } catch(err){
        console.log(err);
        return items;
    }
}

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
        let urls = await scrapeURLs(page, MAX_IMAGES, SCROLL_DELAY);

        fs.writeFileSync(URLS_FILE + ".json", JSON.stringify({ urls }));

        console.log(`URLs are ready! (${urls.length})`);

        await browser.close();

        if(DOWNLOAD_IMAGES){
            console.log("Downloading images from URLs...");
            const filesDownloaded = await downloadImages(urls);
            console.log(`Downloaded ${filesDownloaded} images from ${urls.length} URLs.`);
        }

        console.log("Done!");

        process.exit(0);
    } catch(err){
        console.log(err);
    }
};