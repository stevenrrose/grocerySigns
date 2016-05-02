/*
 *
 * UpWork scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["UpWork"] = {
    name: "UpWork",
    
    /** Allowed URL pattern. */
    urlPattern: /^https:\/\/www\.upwork\.com\/o\/profiles\/(browse\/\?page=\d+|users\/[^/]+\/)$/,

    /** We don't need random strings as UpWork already provides us with result lists. */
    randomSearchStringLength: 0,
    
    /**
     * Search UpWork profiles.
     *
     *  @param what         Search string. Unused.
     *  @param callback     Function called with results.
     */
    search: function(what, callback) {
        // Select a random page.
        var page = Math.floor(Math.random()*500);
        console.log("search", page);
        var url = "https://www.upwork.com/o/profiles/browse/?page=" + page;
        console.log(url);
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    iterator: "[data-cipher-text]",
                    data: {
                        itemId: {attr: "data-cipher-text"}
                    }
                }
            },
            function(data) {
                callback(data[0]);
            }
        );
    },

    /**
     * Fetch & scrape given UpWork ad.
     *
     *  @param itemId       Item ID of the product to scrape.
     *  @param callback     Function called with product info.
     */ 
    fetch: function(itemId, callback) {
        console.log("fetch", itemId);
        var url = "https://www.upwork.com/o/profiles/users/_" + itemId + "/";
        console.log(url);
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    iterator: "script",
                }
            },
            function(data) {
                // We get all the data in a JSON array named phpVars.
                var info;
                for (var i = 0; i < data[0].length; i++) {
                    try {
                        var match = data[0][i].match(/var phpVars = ({.*?});/);
                        var phpVars = JSON.parse(match[1]);
                        console.log("found");
                        info = {};
                        try { info.title = phpVars.profile.profile.title; } catch (e) {};
                        try { info.price = phpVars.profile.stats.hourlyRate.amount.toString(); } catch (e) {};
                        try { info.vendor = phpVars.profile.profile.name; } catch (e) {};
                        try {
                            var skills = phpVars.profile.profile.skills;
                            info.features = [];
                            for (var j = 0; j < skills.length; j++) {
                                info.features.push(skills[j].prettyName);
                            }
                        } catch (e) {}
                        try { info.description = splitSentences(phpVars.profile.profile.description); } catch (e) {}
                        try {
                            // Get portrait image by order of preference.
                            var portraits = phpVars.profile.profile.portrait;
                            info.images = [portraits.originalPortrait||portraits.bigPortrait||portraits.portrait]; 
                        } catch (e) {}
                        try {
                            var assignments = phpVars.profile.assignments;
                            info.reviews = [];
                            for (var j = 0; j < assignments.length; j++) {
                                if (!assignments[j].feedback || !assignments[j].feedback.comment) continue;
                                info.reviews.push.apply(info.reviews, splitSentences(assignments[j].feedback.comment));
                            }
                        } catch (e) {}
                        break;
                    } catch (e) {}
                }
                callback($.extend({success: info ? true : false, itemId: itemId, url: url}, info));
            }
        );
    },
};
