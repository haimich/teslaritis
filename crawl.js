const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const util = require('util');
const process = require('process');
const exec = util.promisify(require('child_process').exec);
const fs  = require('fs');
const SendmailTransport = require('nodemailer/lib/sendmail-transport');
require('dotenv').config();

const FILE_SCREENSHOT = 'screenshot.png';
const FILE_SCREENSHOT_NEW = 'screenshot-new.png';

const FILE_CONTENT = 'content.txt';
const FILE_CONTENT_NEW = 'content-new.txt';

async function loadPageContent() {
  const url = 'https://www.tesla.com/de_DE/modely/design?redirect=no';

  const browser = await puppeteer.launch({
    'args': [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]});

  const page = await browser.newPage();

  console.log("Opening " + url);

  await page.goto(url);

  console.log("Wait for content to be available");

  await page.waitForTimeout(4000);

  const extractedText = await page.$eval('*', (el) => el.innerText);
  
  console.log("Creating screenshot");

  await page.screenshot({ path: FILE_SCREENSHOT_NEW, fullPage: true });

  await browser.close();

  return extractedText;
}

function sendMail(modifications) {
  const sender = process.env.SENDER;
  const receiver = process.env.RECEIVER;
  const pw = process.env.PW;

  let transporter = nodemailer.createTransport({
    host: "smtp.web.de",
    port: 587,
    secure: false, // upgrade later with STARTTLS
    auth: {
      user: sender,
      pass: pw,
    },
  });

  let attachments = [];

  if (modifications.hasContentChanged) {
    attachments.push({
        filename: FILE_CONTENT,
        content: fs.createReadStream(FILE_CONTENT_NEW),
        contentType: 'text/plain',
    });
  }

  if (modifications.hasScreenshotChanged) {
    attachments.push({
      filename: FILE_SCREENSHOT,
      content: fs.createReadStream(FILE_SCREENSHOT_NEW),
      contentType: 'image/png',
    });
  }

  let mailOptions = {
    from: sender,
    to: receiver,
    subject: `Teslaritis update`,
    text: `Howdy!

There was an update on the Tesla site:

* Text is ${modifications.hasContentChanged ? 'different' : 'same'}
* Screenshot is ${modifications.hasScreenshotChanged ? 'different' : 'same'}

Visit https://www.tesla.com/de_DE/modely/design?redirect=no now :)
`,
  attachments,
  };
  
  return transporter.sendMail(mailOptions);
}

function checkModifications() {
  return exec("ls -l | awk '{print $9, $5}'")
    .then(result => {
      if (result.stderr) {
        console.log(`stderr: ${result.stderr}`);
        process.exit(1);
      }

      let files = result.stdout.split("\n");
      
      let hasContentChanged = false;
      let hasScreenshotChanged = false;

      let contentSizeBefore, contentSizeAfter;
      let screenshotSizeBefore, screenshotSizeAfter;

      for (let file of files) {
        let stats = file.split(' ');
        let fileName = stats[0];
        let fileSize = stats[1];

        switch (fileName) {
          case FILE_SCREENSHOT: screenshotSizeBefore = fileSize; break;
          case FILE_SCREENSHOT_NEW: screenshotSizeAfter = fileSize; break;
          case FILE_CONTENT: contentSizeBefore = fileSize; break;
          case FILE_CONTENT_NEW: contentSizeAfter = fileSize; break;
        }
      }

      if (contentSizeBefore != contentSizeAfter) {
        console.log('has content changed x');
        hasContentChanged = true;
      }

      if (screenshotSizeBefore != screenshotSizeAfter) {
        console.log('has screenshot changed x');
        hasScreenshotChanged = true;
      }

      return {
        hasContentChanged, hasScreenshotChanged
      };
    });
}

function generateDiff() {
  return exec(`diff -u ${FILE_CONTENT} ${FILE_CONTENT_NEW}`);
}

function storeFile(filename, content) {
  fs.writeFileSync(filename, content);
}

function cleanupFiles() {
  return exec(`cp ${FILE_SCREENSHOT_NEW} ${FILE_SCREENSHOT} && cp ${FILE_CONTENT_NEW} ${FILE_CONTENT}`);
}

async function run() {
  try {
    console.log("Loading page content");
  
    const text = await loadPageContent();
  
    console.log("Creating content-new file");
  
    storeFile(FILE_CONTENT_NEW, text);
  
    console.log("Checking for modifications");
  
    const modifications = await checkModifications();

    if (! modifications.hasContentChanged) {
      console.log('Content has not changed');
      process.exit(0);
    }
  
    console.log('Sending mail');
  
    await sendMail(modifications);
  
    console.log('Cleaning up files');
  
    await cleanupFiles();
  } catch (err) {
    console.error(err);
  }
}

run();