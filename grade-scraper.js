const chromeLambda = require("chrome-aws-lambda");
// aws-sdk is always preinstalled in AWS Lambda in all Node.js runtimes
const S3Client = require("aws-sdk/clients/s3");
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const { firstOK, clickChangeTerm, selectTerm, termSelector, lastOK, screenshotClip } = require('./config.json')

// create an S3 and Dynamo client
const dbclient = new DynamoDBClient({ region: process.env.S3_REGION });
const s3 = new S3Client({ region: process.env.S3_REGION });

const accountSID = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const username = process.env.MOSAIC_USERNAME;
const password = process.env.MOSAIC_PASSWORD;

const client = require('twilio')(accountSID, authToken); 

exports.handler = async event => {     
    return await scrape()
}

// account for EST daylight savings
const ESToffset = () => {
    if (
        (new Date()).getTimezoneOffset() < 
        Math.max( (new Date(0, 1)).getTimezoneOffset(), (new Date(6, 1)).getTimezoneOffset() )
    ) return -4
    else return -5
}

const scrape = async (retry = false) => {
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

         // get all tile titles from first page
         await page.waitForSelector(".ps_box-scrollarea > div:first-child .ps_grid-div.ps_grid-body > div > div:first-child > div > div > span", {visible: true});
         let titles = await page.$$eval(
             ".ps_box-scrollarea > div:first-child .ps_grid-div.ps_grid-body > div > div:first-child > div > div > span",
             options => options.map(option => option.innerText)
         );
         
         let gradesIndex = titles.indexOf('Grades') + 1  
 
         // click grades tile
         await page.click(`.ps_grid-div.ps_grid-body > div:nth-child(${gradesIndex}) > div:first-child > div`);
 
        // modal ok button in front of change term
        if (firstOK) {
            await page.waitForSelector("#okbutton input", {visible: true});
            await page.click("#okbutton input");
        }

        // --------- CHANGE TERM START ---------
        // wait for iframe
        await page.waitForSelector("#ptifrmtarget")
        await page.waitForTimeout(1000)

        // get content from iframe
        const target = await page.frames().find(f => f.name() === 'TargetContent')

        // click change term button if it doesn't already pop up
        if (clickChangeTerm) {
            await target.waitForSelector("#ACE_width .PSPUSHBUTTON.Left")
            await target.click("#ACE_width .PSPUSHBUTTON.Left");   
        }

        if (selectTerm) {
            // select term based on config object
            await target.waitForSelector("#ACE_width > tbody > tr:nth-child(4) table table > tbody > tr:nth-child(3) input");
            await target.click(`#ACE_width > tbody > tr:nth-child(4) table table > tbody > tr:nth-child(${termSelector}) input`);
            
            // submit button
            await target.waitForSelector("#ACE_width .PSPUSHBUTTON:not(.Left)");
            await target.click("#ACE_width .PSPUSHBUTTON:not(.Left)");
        }
        // --------- CHANGE TERM END ---------


        // modal ok button after loading the grades page
        if (lastOK) {
            await page.waitForSelector("#okbutton input", {visible: true});
            await page.click("#okbutton input");
        }

        // get new content iframe
        await page.waitForSelector("#ptifrmtarget")
        await page.waitForTimeout(1000)
        const newTarget = await page.frames().find(f => f.name() === 'TargetContent');

        const screenshotBuffer = await page.screenshot({
            clip: screenshotClip
        })

        // upload the image using the current timestamp as filename
        const screenshot = await s3
        .upload({
            Bucket: process.env.S3_SCREENSHOT_BUCKET,
            Key: `${Date.now()}.png`,
            Body: screenshotBuffer,
            ContentType: "image/png",
            ACL: "public-read"
        })
        .promise();

        // get raw grade data
        const gradeData = await newTarget.evaluate(() => {
            let rows = Array.from(document.querySelectorAll("#ACE_width > tbody > tr:nth-child(8) .PSLEVEL1GRID > tbody > tr")).slice(1)
            return rows.map(el => {
                let text = el.innerText.split('\n')
                    .filter((el) => /\S/.test(el));
                    // filter by only keeping non whitespace
                
                return {
                    posted: text.length >= 5,
                    grade: (text.length >= 5) ? text[4] : '',
                    course: text[0] + " - " + text[1],
                    courseCode: text[0]
                }
            })
        });

        await browser.close()

        let hours = (new Date).getHours() + ESToffset()
        let minutes = (new Date).getMinutes()
        let timestamp = `\n${
            hours > 12 ? hours - 12 : hours
        }:${
            minutes < 10 ? '0'+minutes : minutes
        } ${
            hours > 12 ? 'pm' : 'am'
        }`

        let textMessage = "🚨NEW GRADES!!🚨".concat(gradeData.map(x => {
            if (x.posted) {
                return '\n' + x.courseCode + '\t' + x.grade
            }
        }).join(''))
        
        // ----Removed----
        // .concat(timestamp)
        // add time so that each message is unique and twilio doesn't suppress
        // sending the same text to the same number again and again

        const posted = await getPosted(gradeData.length);

        // new grade checking
        let newGrades = false
        for (let i = 0; i < gradeData.length; i++) {
            // check if grade has been posted
            if (gradeData[i].posted) {
                // check if grade is different than grades in DynamoDB
                if (gradeData[i].grade !== posted[i]) {
                    newGrades = true;
                    break;
                }
            }
        }

        if (newGrades) {
            await updatePosted(gradeData);

            console.log('Trying to send text.');
            await client.messages 
            .create({ 
                body: textMessage,
                from: '+16477225710',       
                to: '+17057940402',
                mediaUrl: screenshot.Location
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
            grades: gradeData,
            text_message: textMessage,
            screenshot: screenshot.Location
        };  
    } catch (e) {
        if (retry) {
            console.log(e, e.trace);
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

            if (browser) await browser.close()

            return {
                error: e,
                message: e.message,
                trace: e.trace
            }
        } else {
            console.log(e, e.trace);
            console.log('Retrying scrape');
            return await scrape(true);
        }
    }
};

async function getPosted(gradeCount) {
    let posted = Array(gradeCount).fill('')
    for (let i=0; i<gradeCount; i++) {
        const params = {
            TableName: "posted-grades",
            Key: { id: { N: i.toString() },  },
        };
        const data = await dbclient.send(new GetItemCommand(params));

        posted[i] = data.Item.grade['S'];
    }
    return posted
}


async function updatePosted(gradeData) {
    for (let i=0; i<gradeData.length; i++) {
        let item = gradeData[i];
        if (item.posted) { 
            let params = generateParams(i, item);

            const response = await dbclient.send(new PutItemCommand(params));
            if (response.$metadata.httpStatusCode !== 200) throw new Error('DynamoDB Put Item Error')
            
            console.log(`Updating ${item.courseCode} grade`);
        }
    }
}

function generateParams(id, x) {
    return {
        TableName: "posted-grades",
        Item: {
            id: { N: id.toString() },
            grade: { S: x.grade },
            course: { S: x.courseCode },
        }
    }
};