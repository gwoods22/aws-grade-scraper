# AWS Grade Scraper w/ notifications
Lambda functions that scrapes McMaster's grade system and sends an SMS when there is a new grade posted

## Note on running locally
Due to the nature of the puppeteer setup in AWS Lambda, `grade-scraper.js` cannot be run locally in it's current state. If you want to edit or change how the scraping is performed, copy `grade-scraper.js` to a separate js file and simply require puppeteer the usual way:
```const puppeteer = require('puppeteer');
const browser = await puppeteer.launch()
```

## Setup
#### Install packages and set up Serverless by connecting your AWS account
`yarn`, then `sls`

#### Sign up for Twilio and add your environment variables
Create a `.env` file and fill in the following information:
```MOSAIC_USERNAME=
MOSAIC_PASSWORD=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

#### Deploy!
Run `sls deploy`

#### Setup on AWS
If everything went smoothly you should be able to see your function on AWS. Now setup a CloudWatch Event trigger for your function so that it runs at a certain time (i.e. every hour).

## Serverless Commands
#### `sls deploy`
Deploys to AWS

#### `sls invoke -f __function_name__ -p __path_to_input_data__`
Runs the specified function on AWS with input from file

#### `sls invoke local -f __function_name__`
Runs the specified function locally

## References
#### Puppeteer Tutorial
https://codissimo.sinumo.tech/2019/12/27/serverless-puppeteer-with-aws-lambda-layers-and-node-js/

#### Serverless cli reference
https://www.serverless.com/framework/docs/providers/aws/cli-reference/invoke/

#### Twilio Docs
https://www.twilio.com/docs/sms/api/message-resource
