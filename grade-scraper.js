const chromeLambda = require("chrome-aws-lambda");
const fetch = require("node-fetch")
const mailgun = require("mailgun-js");
const mg = mailgun({
    apiKey: process.env.MAILGUN_APIKEY, 
    domain: process.env.MAILGUN_DOMAIN
});

const accountSID = process.env.ACCOUNT_SID
const authToken = process.env.AUTH_TOKEN
const username = process.env.MOSAIC_USERNAME;
const password = process.env.MOSAIC_PASSWORD;

const client = require('twilio')(accountSID, authToken); 

exports.handler = async event => {   
    const posted = await getPosted();
    
    const browser = await chromeLambda.puppeteer.launch({
        args: chromeLambda.args,
        executablePath: await chromeLambda.executablePath,
    });
    const page = await browser.newPage();
    try {
        await page.goto('https://epprd.mcmaster.ca/psp/prepprd/?cmd=login');
    
        // username
        await page.waitForSelector("#userid");
        await page.type("#userid", username);

    } catch {
        console.log("ERROR - Something went wrong loading Chromium")
        return { errorMessage: "Something went wrong loading Chromium" }
    }

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

    // modal ok button
    // await page.waitForSelector("#okbutton input", {visible: true});
    // await page.click("#okbutton input");

    //wait for iFramed
    await page.waitForSelector("#ptifrmtarget")
    await page.waitForTimeout(1000)

    // get content iframe
    const target = await page.frames().find(f => f.name() === 'TargetContent')

    // change term
    // await target.waitForSelector("#ACE_width .PSPUSHBUTTON.Left")
    // await target.click("#ACE_width .PSPUSHBUTTON.Left");   

    // fall 2020
    await target.waitForSelector("#ACE_width > tbody > tr:nth-child(4) table table > tbody > tr:nth-child(3) input");
    await target.click("#ACE_width > tbody > tr:nth-child(4) table table > tbody > tr:nth-child(3) input");

    // submit button
    await target.waitForSelector("#ACE_width .PSPUSHBUTTON:not(.Left)");
    await target.click("#ACE_width .PSPUSHBUTTON:not(.Left)");

    //modal ok button
    await page.waitForSelector("#okbutton input", {
        visible: true
    });
    await page.click("#okbutton input");

    await page.waitForSelector("#ptifrmtarget")

    // get new content iframe
    const newTarget = await page.frames().find(f => f.name() === 'TargetContent');

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

    let emailMessage = gradeData.map(x => {
        if (x.length === 6) {
            return  x[0] + '\t' + x[4] + '\n'
        }
    }).join('')

    let newGrades = false

    for (let i = 0; i < gradeData.length; i++) {
        if ((gradeData[i].length === 6) !== posted[i]) {
            newGrades = true
        }
    }

    if (newGrades) {
        await sendText(textMessage)
        // sendEmail(emailMessage)
    } else {
        console.log('No new grades');
    }
    
    return { 
        new: newGrades,
        grades: result,
        text_message: textMessage
    };        
};

async function sendText(message) {
    console.log('Trying to send text.');
    client.messages 
    .create({ 
        body: message, 
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
}

function getPosted() {
    return fetch("https://raw.githubusercontent.com/gwoods22/aws-grade-scraper/master/posted.json?token=AGBTUH37VZR4QYU56RKJPT2756XNO")
    .then(x => x.text())
    .then(x => JSON.parse(x).posted )
}

async function sendEmail(message) {
    console.log('Trying to send email.');
    const data = {
        from: "Mailgun Sandbox <postmaster@sandbox648df37ad847468ba89cf8934a6003a4.mailgun.org>",
        to: "graemewoods202@gmail.com",
        subject: "🚨NEW GRADES!!🚨",
        text: message
    };
    mg.messages().send(data, function (error, body) {
        console.log("Email sent");
        console.log(body);
        if (error) {
            console.log("EMAIL ERROR");
            console.log(Error(error));
        }
    });
}