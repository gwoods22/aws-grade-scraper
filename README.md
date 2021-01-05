# AWS Grade Scraper w/ notifications
Lambda functions that scrapes McMaster's grade system and sends an SMS when there is a new grade posted

## Method
1. Load Chromium on AWS using `chrome-aws-lambda` package.
2. Log in to https://mosaic.mcmaster.ca/, navigate to grades page for Fall 2020
3. Take screenshot and upload to Amazon S3
4. Parse grades and fetch the `posted.json` file in this repo to check which grades are new*
5. If there are new grades, send a text with the new grades and a screenshot!

###### *Obviously this isn't the ideal storage method but it allows you to update which grades have been received easily by editing the file on Github from the browser, even on your phone. Since this script could be set to run every 10 min it was important for me to be able to edit that `posted.json` file from my phone so I don't get berrated with texts every 10 minutes. Feel free to improve upon this!

## Note on running locally
Due to the nature of the puppeteer setup in AWS Lambda, `grade-scraper.js` cannot be run locally in it's current state. If you want to edit or change how the scraping is performed, copy `grade-scraper.js` to a separate js file and simply require puppeteer the usual way:
```const puppeteer = require('puppeteer');
const browser = await puppeteer.launch()
```

## Setup
#### Install packages and set up Serverless by connecting your AWS account
`yarn`, then `sls`

#### Sign up for Twilio, purchase a phone #, get your Auth Token, and add your environment variables
Check out the [Student Developer Pack](https://education.github.com/pack) to get a $50 Twilio credit to cover the cost of your phone # and texts!
Create a `.env` file and fill in the following information:
```MOSAIC_USERNAME=
MOSAIC_PASSWORD=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
S3_SCREENSHOT_BUCKET=
```
The `S3_SCREENSHOT_BUCKET` just has to be a unique S3 Bucket name so you could use `aws-dev-serverlessdeploymentbucket-<your name>`

### Fill in `posted.json` with current grades and placeholder strings, in the order they appear on Mosaic
Example: 
```
{
    "posted": ["A-", "", "", "B"]
}
```

#### Deploy!
Run `sls deploy`

#### Setup on AWS
If everything went smoothly you should be able to see your function on AWS. Now setup a CloudWatch Event trigger for your function so that it runs on a certain interval (i.e. every hour).

## Useful References
#### Puppeteer Tutorial
~~https://codissimo.sinumo.tech/2019/12/27/serverless-puppeteer-with-aws-lambda-layers-and-node-js/~~
^ Site went down so check out the cached version in the repo: `Lambda_puppeteer_tutorial.mht`

#### Serverless cli reference
https://www.serverless.com/framework/docs/providers/aws/cli-reference/invoke/

#### Twilio Docs
https://www.twilio.com/docs/sms/api/message-resource
