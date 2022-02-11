const puppeteer = require('puppeteer');
const fs  = require('fs');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');
const SendmailTransport = require('nodemailer/lib/sendmail-transport');
require('dotenv').config();

async function loadPageContent() {
  const url = 'https://www.tesla.com/de_DE/modely/design?redirect=no';

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log("Opening " + url);

  await page.goto(url);

  console.log("Wait for content to be available");

  await page.on('domcontentloaded');

  await page.waitForTimeout(4000);

  const extractedText = await page.$eval('*', (el) => el.innerText);
  
  console.log("Creating screenshot");

  await page.screenshot({ path: 'screenshot.png', fullPage: true });

  await browser.close();

  return extractedText;
}

function sendMail(diff, hasContentChanged, hasScreenshotChanged) {
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
  attachments: [
    {
        filename: 'diff.txt',
        content: diff,
    },
  ],
  };
  
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

function checkGitModifications() {
  exec("git status", (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    } else if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }

    console.log(`stdout: ${stdout}`);

    if (stdout.includes('working tree clean')) {
      return;
    }

    const compareText = stdout.replace(/ /g,''); // strip whitespaces
    let hasContentChanged = false;
    let hasScreenshotChanged = false;

    if (compareText.includes('modified:content.txt')) {
      hasContentChanged = true;
    }

    if (compareText.includes('modified:screenshot.png')) {
      hasScreenshotChanged = true;
    }

    // find out git diff
    exec("git diff", (error, stdout, stderr) => {
      if (error) {
          console.log(`error: ${error.message}`);
          return;
      } else if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
      }

      sendMail(stdout, hasContentChanged, hasScreenshotChanged);
    });
  });
}

(async () => {
  console.log("Loading page content");

  const text = await loadPageContent();

  console.log("Creating text file");

  fs.writeFileSync('content.txt', text);

  console.log("Checking for git modifications");

  checkGitModifications();
})();
