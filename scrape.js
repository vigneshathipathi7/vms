const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrape() {
  const data = {};

  try {
    // 1. Scrape Municipal Corporations
    const cropUrl = 'https://en.wikipedia.org/wiki/List_of_municipal_corporations_in_Tamil_Nadu';
    const res1 = await axios.get(cropUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    
    let $ = cheerio.load(res1.data);
    let table = $('table.wikitable').first();

    table.find('tr').each((i, row) => {
      if (i === 0) return; // skip header
      const cols = $(row).find('td, th');
      if (cols.length >= 6) {
        let corpName = $(cols[1]).text().trim().replace(/\[.*?\]/, '');
        let district = $(cols[4]).text().trim().replace(/\[.*?\]/, '');
        let wardsText = $(cols[5]).text().trim().split(' ')[0];
        let wards = parseInt(wardsText, 10);
        if (isNaN(wards)) wards = 100;

        if (!data[district]) data[district] = {};
        data[district][`${corpName} Corporation`] = wards;
      }
    });

    // 2. Scrape Municipalities
    const muniUrl = 'https://en.wikipedia.org/wiki/List_of_municipalities_in_Tamil_Nadu';
    const res2 = await axios.get(muniUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    
    $ = cheerio.load(res2.data);
    table = $('table.wikitable').first();

    table.find('tr').each((i, row) => {
      if (i === 0) return; // skip header
      const cols = $(row).find('td');
      if (cols.length >= 3) {
        let mName = $(cols[1]).text().trim().replace(/\[.*?\]/, '');
        let district = $(cols[2]).text().trim().replace(/\[.*?\]/, '');
        let wards = 30; // placeholder default since standard table doesn't have wards

        // Let's see if there's a wards col
        if (cols.length >= 4) {
             let potentialWards = parseInt($(cols[3]).text().trim(), 10);
             if (!isNaN(potentialWards) && potentialWards > 0) {
                 wards = potentialWards;
             }
        }

        if (!data[district]) data[district] = {};
        data[district][`${mName} Municipality`] = wards;
      }
    });

    // Write output to file
    fs.writeFileSync('apps/web/src/data/district-wards.json', JSON.stringify(data, null, 2));
    console.log("Successfully rebuilt apps/web/src/data/district-wards.json");

  } catch (err) {
    console.error("Error scraping:", err.message);
  }
}

scrape();
