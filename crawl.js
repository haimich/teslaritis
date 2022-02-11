const puppeteer = require('puppeteer');
const fs  = require('fs');
const { exec } = require('child_process');

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
  });
}

(async () => {
  console.log("Loading page content");

  // const text = await loadPageContent();

  // console.log("Creating text file");

  // fs.writeFileSync('content.txt', text);

  // console.log("Checking for git modifications");

  checkGitModifications();
})();
