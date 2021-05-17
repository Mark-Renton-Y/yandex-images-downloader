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

module.exports = async function scrapeURLs(page, maxItems, scrollDelay){
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