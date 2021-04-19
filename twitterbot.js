const chromeLambda = require("chrome-aws-lambda");
const Twitter = require('twitter')

const consumer_key = process.env.T_CONSUMER_KEY;
const consumer_secret = process.env.T_CONSUMER_SECRET;
const access_token_key = process.env.T_ACCESS_TOKEN_KEY;
const access_token_secret = process.env.T_ACCESS_TOKEN_SECRET;

const client = new Twitter({
    consumer_key,
    consumer_secret,
    access_token_key,
    access_token_secret
  });

// aws-sdk is always preinstalled in AWS Lambda in all Node.js runtimes
const S3Client = require("aws-sdk/clients/s3");

// create an S3 client
// const s3 = new S3Client({ region: process.env.S3_REGION });

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

        await page.goto('https://open.spotify.com/artist/1McMsnEElThX1knmY4oliG');

        await page.waitForSelector('div[aria-rowindex="1"] > div:first-child > div:nth-child(3)');

        // get raw grade data
        const streams = await page.$eval(
            'div[aria-rowindex="1"] > div:first-child > div:nth-child(3)',
            x => x.innerText
        )

        await browser.close()

        client.post('statuses/update', {
                status: `drivers license now has ${streams} streams on @Spotify` 
            },  function(error, tweet, response) {
            if(error) throw error;
            if (response.statusCode === 200) console.log('Tweet sent');
            else console.log(response.statusMessage);
          });
        
        return { 
            streams: streams
        };  
    } catch (e) {
        console.log(e.name);
        console.log(e.message);

        await browser.close()

        return {
            error: e.name,
            message: e.message
        }
    }
};