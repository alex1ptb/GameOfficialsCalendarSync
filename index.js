//DEPENDENCIES
const puppeteer = require("puppeteer");
const path = require("path");
const csv = require("csv-parser");
const fs = require("fs");
const { google } = require("googleapis");
//not sure where this particular require came from, may delete
const { CANCELLED } = require("dns");
const { OAuth2 } = google.auth;
require("dotenv").config();

//VARIABLES
const arrayOfCancelledGames = [];
const linkForAllFutureGames =
  "https://www.gameofficials.net/Game/myGames.cfm?viewRange=allFuture&module=myGames";
const downloadPath = path.resolve(
  `../../../../../GoogleDrive/MyDrive/GameOfficials/OfficialsScheduleCalendarExport.csv`
);
const gameNumbers = [];
const gamesToBeUploaded = [];
const today = new Date();
const calendarId = process.env.CALENDAR_ID;
////

//GOOGLE CALENDAR AUTHENTICATION
const oAuth2Client = new OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET
);
oAuth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN,
});

const calender = google.calendar({
  version: "v3",
  auth: oAuth2Client,
});
////

//NAMES TO CHECK FOR
const checkForPeople = [
  "COLE CHAPPELL",
  "DAWSON BALL",
  "SKYLER BALL",
  "DAWN CHAPPELL",
];
////

//// * GET INFO FROM GAME OFFICIALS
//this includes {canceled game numbers, current and future games}

//LOGIN
async function login(page, name, pass) {
  console.log("Logging in");
  await page.goto("https://www.gameofficials.net/login.cfm");
  await page.waitForSelector("#login_username");
  await page.type("#login_username", name);
  await page.type("#login_password", pass);
  await page.click("#login_submit");
  await page.waitForNavigation();
}

//DOWNLOAD REPORT
async function downloadCalendarReportfromGameOfficials() {
  console.log("Getting Data from website");
  const browser = await puppeteer.launch({
    //headless: false,
  });
  var [page] = await browser.pages();
  await page.goto(
    "https://www.gameofficials.net/reports/reportInfo.cfm?reportMenuID=52"
  );
  await page._client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadPath,
  });
  await page.click("#GetNormal");
  console.log("Downloading File");
  await page.waitForTimeout(5000);
  console.log("closing Browser");
  await page.close();
}
////

//CHECK FOR CANCELLED GAMES
async function getEventsToDeleteFromCalendar(page) {
  //scrape the page for cancelled games as the report doesn't include this
  console.log("Getting Cancelled Games");
  await page.goto(linkForAllFutureGames);

  try {
    //find the cells with the word "Cancelled" in them and add them to the array
    const cells = await page.$$("td");
    for (let i = 0; i < cells.length; i++) {
      const text = await cells[i].evaluate((cell) => cell.textContent);
      if (text.includes("Cancelled")) {
        arrayOfCancelledGames.push(text);
      }
    }
    //remove the whitespace and non-number characters from the array
    for (let i = 0; i < arrayOfCancelledGames.length; i++) {
      arrayOfCancelledGames[i] = arrayOfCancelledGames[i].replace(/\s/g, "");
      arrayOfCancelledGames[i] = arrayOfCancelledGames[i].replace(
        /[^0-9]/g,
        ""
      );
    }
    return arrayOfCancelledGames;
  } catch (error) {
    console.log(error);
  }
}
////

//// ** END OF GET INFO FROM GAME OFFICIALS

//READ CSV FILE AND SHOW ON CONSOLE
function editFileForUpload(name) {
  const results = [];
  console.log("Starting the editing process");
  fs.createReadStream(downloadPath)
    .pipe(csv())
    .on("data", (row) => {
      const regex = /(?<=\Game:\s)(\w+)/g;
      //if the game numbers match from previous download file then ignore and go to next
      let gameNumber = row.Description.match(regex);
      let checkDate = new Date(row["Start Date"]);
      if (!gameNumbers.includes(Number(gameNumber[0])) && checkDate >= today) {
        gameNumbers.push(Number(gameNumber[0]));
        results.push(row);
      }
    })
    .on("end", () => {
      //Find names and fix summary {the title of the calendar event} to have names pre-pended
      for (var i = 0; i < results.length; i++) {
        const peopleFound = [];
        checkForPeople.forEach((person) => {
          let isInDescription = results[i].Description.includes(person);
          if (isInDescription) {
            peopleFound.push(person.substring(person, person.lastIndexOf(" ")));
          }
        });
        //change subject line to have persons name
        results[i].Subject = `${peopleFound.join(" | ")} ${results[
          i
        ].Location.split("-").pop()}`;
        const theStartDate = results[i]["Start Date"]
          .split("/")
          .reverse()
          .join(",");
        var theStartTime = results[i]["Start Time"].concat(":00");
        theStartTime = theStartTime.split(":").join(",");
        var verify = theStartDate + "," + theStartTime;
        var dateAndTime = verify.split(",");
        initialStartDate = new Date(
          dateAndTime[0],
          dateAndTime[2] - 1,
          dateAndTime[1],
          dateAndTime[3],
          dateAndTime[4],
          dateAndTime[5]
        );
        var theEndDate = results[i]["End Date"].split("/").reverse().join(",");
        var theEndTime = results[i]["End Time"].concat(":00");
        theEndTime = theEndTime.split(":").join(",");
        var verify = theEndDate + "," + theEndTime;
        var dateAndTime = verify.split(",");
        initialEndDate = new Date(
          dateAndTime[0],
          dateAndTime[2] - 1,
          dateAndTime[1],
          dateAndTime[3],
          dateAndTime[4],
          dateAndTime[5]
        );
        const address = results[i].Description.match(
          /(?<=\Directions:\s)[\s\S]*?(?=-)/g
        );
        //need to push this new info into an array, that way it can be checked against current events within the calendar before uploading, so no duplicates are made and cancelled games arent added to the calendar as well

        //calendar event as object
        let calendarEvent = {};
        calendarEvent.summary = results[i]["Subject"];
        calendarEvent.start = { dateTime: initialStartDate };
        calendarEvent.end = { dateTime: initialEndDate };
        calendarEvent.description = results[i]["Description"];
        calendarEvent.location = address;
        gamesToBeUploaded.push(calendarEvent);
      }
      console.log(`CSV file successfully processed for ${name}`);
      console.log(gamesToBeUploaded);
    });
}

//DELETE FILE FOR NEW BATCH RUN
async function deleteDownloadedFile() {
  fs.unlink(downloadPath, (err) => {
    if (err) {
      console.error(err);
    }
  });
  console.log("Download deleted");
}

//check the dates within the games to upload array
//download calendar events for the days that match
//

const eventsFromCalendar = calender.events.list({
  calendarId: calendarId,
  timeMin: today.toISOString(),
});
const regex = /(?<=\Game:\s)(\w+)/g;
eventsFromCalendar
  .then((value) => console.log(value.data.items[0].description.regex))
  .catch((err) => {
    console.log(err);
  });
//need to redo this one to work as a function
//CALENDAR INSERT SECTION
async function insertEventsIntoCalendar() {
  calender.events.insert(
    {
      calendarId: process.env.CALENDAR_ID,
      resource: {
        summary: results[i]["Subject"],
        start: { dateTime: initialStartDate },
        end: { dateTime: initialEndDate },
        description: results[i]["Description"],
        location: address,
      },
    },
    (err) => {
      if (err) return console.error("Calendar Event Creation Failed:", err);
    }
  );
  console.log(
    `Event Created: ${results[i]["Subject"]} which is ${i} of ${results.length}`
  );
}

//
//Loop through each user that is saved
async function runProgram() {
  for (j = 0; j < process.env.USER_NAME.split(",").length; j++) {
    console.log("Running Process");
    let name = process.env.USER_NAME.split(",")[j];
    let pass = process.env.USER_PASS.split(",")[j];
    await login(name, pass, page);
    await downloadCalendarReportfromGameOfficials();
    await editFileForUpload(name);
    await downloadFileFromGameOfficials(name, pass);
  }
}

//runProgram();
