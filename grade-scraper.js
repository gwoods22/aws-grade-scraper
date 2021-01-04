const chromeLambda = require("chrome-aws-lambda");
const fetch = require("node-fetch")
// aws-sdk is always preinstalled in AWS Lambda in all Node.js runtimes
const S3Client = require("aws-sdk/clients/s3");

// create an S3 client
const s3 = new S3Client({ region: process.env.S3_REGION });

const accountSID = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const username = process.env.MOSAIC_USERNAME;
const password = process.env.MOSAIC_PASSWORD;

const client = require('twilio')(accountSID, authToken); 

exports.handler = async event => {     
    var browser, page;
    try {  
        browser = await chromeLambda.puppeteer.launch({
            args: chromeLambda.args,
            executablePath: await chromeLambda.executablePath,
            defaultViewport: {
                width: 800,
                height: 600
            }
        });
        page = await browser.newPage();
        await page.setDefaultTimeout(15000);

        await page.goto('https://epprd.mcmaster.ca/psp/prepprd/?cmd=login');

        // username
        await page.waitForSelector("#userid");
        await page.type("#userid", username);

        // password
        await page.waitForSelector("#pwd");
        await page.type("#pwd", password);

        // submit button
        await page.waitForSelector(".ps_box-button > span > input")
        await page.click(".ps_box-button > span > input")

        // grades tile
        await page.waitForSelector(".ps_grid-div.ps_grid-body > div:nth-child(10) > div:nth-child(1) > div", {
            visible: true
        });
        await page.click(".ps_grid-div.ps_grid-body > div:nth-child(10) > div:nth-child(1) > div");

        // --- Sometimes not needed ---
        // modal ok button
        await page.waitForSelector("#okbutton input", {visible: true});
        await page.click("#okbutton input");

        //wait for iframe
        await page.waitForSelector("#ptifrmtarget")
        await page.waitForTimeout(1000)

        // get content from iframe
        const target = await page.frames().find(f => f.name() === 'TargetContent')

        // --- Sometimes not needed ---
        // change term
        await target.waitForSelector("#ACE_width .PSPUSHBUTTON.Left")
        await target.click("#ACE_width .PSPUSHBUTTON.Left");   

        // fall 2020
        await target.waitForSelector("#ACE_width > tbody > tr:nth-child(4) table table > tbody > tr:nth-child(3) input");
        await target.click("#ACE_width > tbody > tr:nth-child(4) table table > tbody > tr:nth-child(3) input");

        // submit button
        await target.waitForSelector("#ACE_width .PSPUSHBUTTON:not(.Left)");
        await target.click("#ACE_width .PSPUSHBUTTON:not(.Left)");

        //modal ok button
        await page.waitForSelector("#okbutton input", {visible: true});
        await page.click("#okbutton input");
        
        // get new content iframe
        await page.waitForSelector("#ptifrmtarget")
        const newTarget = await page.frames().find(f => f.name() === 'TargetContent');

        const screenshotBuffer = await page.screenshot({
            clip: {
                x: 34,
                y: 259,
                width: 631,
                height: 166
            }
        })

        // upload the image using the current timestamp as filename
        const screenshot = await s3
        .upload({
            Bucket: process.env.S3_BUCKET,
            Key: `${Date.now()}.png`,
            Body: screenshotBuffer,
            ContentType: "image/png",
            ACL: "public-read"
        })
        .promise();

        // get raw grade data
        const gradeData = await newTarget.evaluate(() => {
            let rows = Array.from(document.querySelectorAll(".PSLEVEL1GRID > tbody > tr")).slice(1)
            return rows.map(el => {
                let textArr = el.innerText.split('\n');
                return textArr.filter((el) => /\S/.test(el));
            })
        });

        await browser.close()

        let result = gradeData.map(x => (
            {
                posted: x.length === 6,
                grade: x.length === 6 ? x[4] : '',
                course: x[0] + " - " + x[1]
            }
        )); 

        let textMessage = "🚨NEW GRADES!!🚨".concat(gradeData.map(x => {
            if (x.length === 6) {
                return '\n' + x[0] + '\t' + x[4]
            }
        }).join(''))
        .concat(`\n${(new Date).getHours() - 5}:${(new Date).getMinutes()}`)
        // add time so that each message is unique and twilio doesn't suppress
        // sending the same text to the same number again and again

    const posted = await getPosted();

        // new grade checking
        let newGrades = false
        for (let i = 0; i < gradeData.length; i++) {
            // check if grade has been posted
            if (gradeData[i].length === 6) {
                // check if grade is different than posted.json
                if (gradeData[i][4] !== posted[i]) {
                newGrades = true
                }
            }
        }

        if (newGrades) {
            console.log('Trying to send text.');
            await client.messages 
            .create({ 
                body: textMessage,
                from: '+16477225710',       
                to: '+17057940402' 
            }) 
            .then(response => {
                console.log('Text message sent'); 
                console.log(response.sid); 
            })
            .catch((e) => {
                console.log("TWILIO ERROR");
                console.log(Error(e));
            });
        } else {
            console.log('No new grades');
        }
        
        return { 
            new: newGrades,
            grades: result,
            text_message: textMessage,
            screenshot: screenshot.Location
        };  
    } catch (e) {
        console.log(e.name);
        console.log(e.message);
        console.log('Trying to send alert text');

        let textMessage = e.name+'\n'+e.message
        await client.messages 
        .create({ 
            body: textMessage,
            from: '+16477225710',       
            to: '+17057940402' 
        }) 
        .then(response => {
            console.log('Text message sent'); 
            console.log(response.sid); 
        })
        .catch((e) => {
            console.log("TWILIO ERROR");
            console.log(Error(e));
        });

        await browser.close()

        return {
            error: e.name,
            message: e.message
        }
    }
};

function getPosted() {
    return fetch("https://raw.githubusercontent.com/gwoods22/aws-grade-scraper/master/posted.json")
    .then(x => x.text())
    .then(x => JSON.parse(x).posted )
}