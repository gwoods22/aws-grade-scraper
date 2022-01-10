# AWS Grade Scraper w/ notifications
Lambda functions that scrapes McMaster's grade system and sends an SMS when there is a new grade posted

## Method
1. Load Chromium on AWS using `chrome-aws-lambda` package.
2. Log in to https://mosaic.mcmaster.ca/, navigate to grades page for Fall 2020
3. Take screenshot and upload to Amazon S3
4. Parse grades and compare with grades in DynamoDB
5. If there are new grades, update DynamoDB and send a text with the new grades and a screenshot!

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
S3_REGION=
```
The `S3_SCREENSHOT_BUCKET` just has to be a unique S3 Bucket name so you could use `aws-dev-serverlessdeploymentbucket-<your name>`

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
