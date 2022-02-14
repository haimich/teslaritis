const puppeteer = require('puppeteer');
const fs  = require('fs');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');
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

  await page.on('domcontentloaded');

  await page.waitForTimeout(4000);

  const extractedText = await page.$eval('*', (el) => el.innerText);
  
  console.log("Creating screenshot");

  await page.screenshot({ path: FILE_SCREENSHOT_NEW, fullPage: true });

  await browser.close();

  return extractedText;
}

function sendMail(hasContentChanged, hasScreenshotChanged) {
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

  if (hasContentChanged) {
    attachments.push({
        filename: FILE_CONTENT,
        content: FILE_CONTENT_NEW,
        contentType: 'text/plain',
    });
  }

  if (hasScreenshotChanged) {
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

* Text is ${hasContentChanged ? 'different' : 'same'}
* Screenshot is ${hasScreenshotChanged ? 'different' : 'same'}

Visit https://www.tesla.com/de_DE/modely/design?redirect=no now :)
`,
  attachments,
  };

  console.log('Sending mail');
  
  return transporter.sendMail(mailOptions);
}

function checkModificationsAndSendMail() {
  exec("ls -l | awk '{print $9, $5}'", (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    } else if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }

    let files = stdout.split("\n");
    
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

    if (! hasContentChanged) {
      console.log('Nothing has changed');
      return;
    }

    return sendMail(hasContentChanged, hasScreenshotChanged)
      .then(() => {
        console.log('Clean up files');

        exec(`cp ${FILE_SCREENSHOT_NEW} ${FILE_SCREENSHOT} && cp ${FILE_CONTENT_NEW} ${FILE_CONTENT}`, (error, stdout, stderr) => {
          if (error) {
              console.log(`error: ${error.message}`);
              return;
          } else if (stderr) {
              console.log(`stderr: ${stderr}`);
              return;
          }

          console.log('Cleaned up files');
        });
      })
      .catch(err => {
        console.error(err);
      });
  });
}

(async () => {
  console.log("Loading page content");

  const text = await loadPageContent();

  console.log("Creating text file");

  fs.writeFileSync(FILE_CONTENT_NEW, text);

  console.log("Checking for modifications");

  checkModificationsAndSendMail();
})();

