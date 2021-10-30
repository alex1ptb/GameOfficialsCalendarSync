const puppeteer = require("puppeteer");
const path = require("path");
require("dotenv").config();

let name = process.env.USER_NAME.split(",")[0];
let pass = process.env.USER_PASS.split(",")[0];

async function getEventsToDeleteFromCalendar() {
const linkForAllFutureGames =
  "https://www.gameofficials.net/Game/myGames.cfm?viewRange=allFuture&module=myGames";
  await page.goto(linkForAllFutureGames);

  try {
    var arrayOfCancelledGames = [];
    //find the cells with the word "Cancelled" in them and add them to the array
    const cells = await page.$$("td");
    for (let i = 0; i < cells.length; i++) {
      const text = await cells[i].evaluate(cell => cell.textContent);
      if (text.includes("Cancelled")) {
        arrayOfCancelledGames.push(text);
      }
    }
    //remove the whitespace and non-number characters from the array
    for (let i = 0; i < arrayOfCancelledGames.length; i++) {
      arrayOfCancelledGames[i] = arrayOfCancelledGames[i].replace(/\s/g, "");
      arrayOfCancelledGames[i] = arrayOfCancelledGames[i].replace(/[^0-9]/g, "");
    }
    console.log(arrayOfCancelledGames);
  } catch (error) {
    console.log(error);
  }
  return arrayOfCancelledGames;
}

getEventsToDeleteFromCalendar();