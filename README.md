# AWS Grade Scraper w/ notifications
Lambda functions to scrape McMaster's grade system and send an SMS when there is an update

## Commands
#### `sls deploy`
Deploys to AWS

#### `sls invoke -f __function_name__ -p __path_to_input_data__`
Runs the specified function on AWS with input from file

#### `sls invoke local -f __function_name__`
Runs the specified function locally

### Puppeteer Tutorial
https://codissimo.sinumo.tech/2019/12/27/serverless-puppeteer-with-aws-lambda-layers-and-node-js/

### Serverless cli reference
https://www.serverless.com/framework/docs/providers/aws/cli-reference/invoke/

### Twilio Docs
https://www.twilio.com/docs/sms/api/message-resource