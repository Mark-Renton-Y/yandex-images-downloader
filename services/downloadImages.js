const fs = require("fs");
const detectFileType = require('detect-file-type');
const isImage = require("is-image");
const fetch = require("node-fetch");
const https = require("https");
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

module.exports = async function downloadImages(urls, dir){

    if (fs.existsSync(dir)) {
        fs.rmdirSync(dir, {recursive: true})
    }
    fs.mkdirSync(dir);

    for(index in urls){
        let url = urls[index++];
        try{
            const fileExt = url.href.match(/\.[0-9a-z]+(?=\?.*$)/i);
            const file = fs.createWriteStream(
                dir +
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

    return fs.readdirSync(dir).length;
}