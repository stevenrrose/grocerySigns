/**
 * PhantomJS script that triggers random actions on the main Grocery Signs app page.
 */

/** Refresh interval (milliseconds). */
var refreshInterval = 1000;

var system = require('system');

// Main page URL is given as first argument to the script.
var url = system.args[1] || 'http://localhost:3000/';

// Load the main app page.
console.log("Loading main page", url);
var page = require('webpage').create();
page.open(url, function(status) {
    if (status !== 'success') {
        console.error('Error while loading main page', url);
        phantom.exit();
    }
    
    // Display web page console message here.
    page.onConsoleMessage = function(msg) {
        console.log('    | ' + msg);
    };

    // Inject global Ajax error handler.
    page.evaluate(function() {
        $(document).ajaxError(function(event, jqXHR, ajaxSetting, thrownError) {
            console.log("ajaxError", thrownError);
            document.inProgress = false;
        });
    });
    
    // Scrape a random page periodically.
    setInterval(function() {
        if (!scrapeRandom(page)) {
            console.warn("  >> Scraping in progress");
            return;
        }
        console.log("Scraping a random page");
    }, refreshInterval);
});

/**
 * Scrape a page from a random provider.
 * 
 * @param {webpage} page PhantomJS page
 * @returns {bool} true if scrape scheduled, false if skipped (i.e. scraping in progress)
 */
function scrapeRandom(page) {
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
                var seed = generateRandomSeed();

                // Bookmark result.
                var bookmarkInfo = {
                    provider: provider.name,
                    id: info.itemId,
                    seed: seed,
                    sentences: sentences,
                    images: info.images
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
