/**
 * Puppeteer script that triggers random actions on the main Grocery Signs app page.
 */

(async() => {

process.chdir(__dirname);

/** Maximim number of scrapes. */
const maxNbScrapes = 50;

/** Refresh interval (milliseconds). */
const refreshInterval = 1000;

const puppeteer = require('puppeteer');

// Main page URL is given as first argument to the script.
console.log(process.argv);
const url = process.argv[2] || 'http://localhost:3000/';

/*
 *
 * Headless Chrome.
 * 
 */

const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
// Change the user agent to fix issue with fonts: headless loads TTF instead
// of woff2 and setst the wrong unicodeRange.
let agent = await browser.userAgent();
agent = agent.replace("HeadlessChrome", "Chrome");



// Load the main app page.
console.log("Loading main page", url);
const page = await browser.newPage();
await page.setUserAgent(agent);
try {
    const response = await page.goto(url, {waitUntil: 'networkidle0'});
    if (!response.ok()) throw response.error;
} catch (e) {
    console.error('Error while loading main page', url, e);
    process.exit();
}

// Display web page console message here.
page.on('console', (e) => {
    console.log('    | ' + e.text());
});

// Inject global Ajax error handler.
await page.evaluate(() => {
    $(document).ajaxError(function(event, jqXHR, ajaxSetting, thrownError) {
        console.log("ajaxError", thrownError);
        document.inProgress = false;
    });
});

// Scrape a random page periodically (up to the maxNbScrapes limit).
let nbScrapes = 0;
setInterval(async () => {
    const status = await scrapeRandom(page);
    if (!status) {
        console.warn("  >> Scraping in progress");
        return;
    }
    if (nbScrapes++ > maxNbScrapes) {
        console.log("Maximum number of scrapes reached, exiting");
        process.exit();
    }
    console.log(`Scraping random page #${nbScrapes}/${maxNbScrapes}`);
}, refreshInterval);

/**
 * Scrape a page from a random provider.
 * 
 * @param {webpage} page PhantomJS page
 * @returns {bool} true if scrape scheduled, false if skipped (i.e. scraping in progress)
 */
async function scrapeRandom(page) {
    return page.evaluate(function() {
        if (document.inProgress) {
            return false;
        }
        
        // Select random provider.
        var pp = Object.keys(providers);
        var provider = providers[pp[Math.floor(Math.random()*pp.length)]];
        
        // Generate random search string.
        var str = randomStr(provider.randomSearchStringLength);

        console.log("Searching for " + provider.name + " items matching '" + str + "'...");
        document.inProgress = true;
        provider.search(str, function(results) {
            if (!results || !results.length) {
                // No or invalid results.
                console.error("Scraping failed!", provider.name + " search string = " + str);
                document.inProgress = false;
                return;
            }

            // Pick & fetch a random item in the first result page.
            var index = Math.floor(Math.random()*results.length);
            var itemId = results[index].itemId;
            console.log("Fetching " + provider.name + " item " + itemId + "...");
            provider.fetch(itemId, function(info) {
                document.inProgress = false;
                
                if (!info.success) {
                    console.log("Scraping failed!", provider.name + " ID = " + info.itemId);
                    return;
                }
                
                var sentences = processSentences(info);
                var images = processImages(info);
                var seed = generateRandomSeed();
                
                // Bookmark result.
                var bookmarkInfo = {
                    provider: provider.name,
                    id: info.itemId,
                    seed: seed,
                    sentences: sentences,
                    images: images
                };
                $.ajax({
                    method: "POST",
                    headers: {"X-Scrape-App": "Pi"},
                    url: 'scraper/bookmark',
                    processData: false,
                    data: JSON.stringify(bookmarkInfo),
                    contentType: 'application/json',
                    success: function(data, textStatus, jqXHR) {
                        console.log("Result bookmarked");
                        
                        // Preload images.
                        loadImages(bookmarkInfo);

                        // Bookmark seed.
                        var bookmarkSeedInfo = {
                            provider: provider.name,
                            id: info.itemId,
                            seed: seed
                        };
                        $.ajax({
                            method: "POST",
                            headers: {"X-Scrape-App": "Pi"},
                            url: 'scraper/bookmarkSeed',
                            processData: false,
                            data: JSON.stringify(bookmarkSeedInfo),
                            contentType: 'application/json',
                            success: function(data, textStatus, jqXHR) {
                                console.log("Seed bookmarked");
                            },
                            error: function(jqXHR, textStatus, errorThrown) {
                                console.error("Error while bookmarking seed!", textStatus, errorThrown);
                            }
                        });
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error("Error while bookmarking result!", textStatus, errorThrown);
                    }
                });
            });
        });
        
        return true;
    });
}

})();
