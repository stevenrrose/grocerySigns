/*
 *
 * Craig's List scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["Craigslist"] = {
    name: "Craigslist",
    
    /** Allowed URL pattern. */
    urlPattern: /^https:\/\/\w+\.craigslist\.org\/(search\/\w+(\?s=\d+)?|.+\.html)$/,

    /** We don't need random strings as CL already provides us with result lists. */
    randomSearchStringLength: 0,
    
    /**
     * Search CL personal ads.
     *
     *  @param what         Search string. Unused.
     *  @param callback     Function called with results.
     */
    search: function(what, callback) {
        // Select a random subcategory.
        // var subcats = ["stp", "w4w", "w4m", "m4w", "m4m", "msr", "cas", "mis", "rnr"];
        var subcats = ["mis", "rnr"];
        var what = subcats[Math.floor(Math.random()*subcats.length)];
        console.log("search", what);
        var url = "https://newyork.craigslist.org/search/" + what;
        console.log(url);
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    params: {limit: 1},
                    iterator: ".pagenum",
                    data: {
                        total: {sel: ".totalcount"},
                        range: {sel: ".range"},
                    }
                }
            },
            function(data) {
                try {
                    // Pick a random page.
                    var total = data[0][0].total;
                    var i = Math.floor(Math.random()*total);
                    var url = "https://newyork.craigslist.org/search/" + what + "?s=" + i;
                    console.log(url);
                    artoo.ajaxSpider(
                        [{url: fetchUrl, data: {url: url}}],
                        {
                            scrape: {
                                iterator: ".hdrlnk",
                                data: {
                                    itemId: function() {
                                        var path = new URL($(this).attr('href')).pathname;
                                        return path.match(/\/(.*)\..*?/)[1].replace(/\//g,'_');
                                    }
                                }
                            }
                        },
                        function(data) {
                            callback(data[0]);
                        }
                    );
                } catch (error) {
                    callback(null, error);
                }
            }
        );
    },

    /**
     * Fetch & scrape given CL ad.
     *
     *  @param itemId       Item ID of the product to scrape.
     *  @param callback     Function called with product info.
     */ 
    fetch: function(itemId, callback) {
        console.log("fetch", itemId);
        var url = "https://newyork.craigslist.org/" + itemId.replace(/_/g, '/') + ".html";
        console.log(url);
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    params: {limit: 1},
                    iterator: ".page-container",
                    data: {
                        title: {sel: "#titletextonly"},
                        price: {sel: ".attrgroup :contains('age') b"},
                        vendor: {sel: ".category a"},
                        features: {sel: ".attrgroup", scrape: {iterator: ".personals_attrbubble ", data: 'text'}},
                        description: function() {
                            return splitSentences(
                                $.makeArray(
                                    $(this).find("#postingbody").contents()
                                        .map(function() {
                                            return $(this).text();
                                        })
                                ).join(". ")
                            ).filter(function(e) {
                                return e.trim() != "";
                            });
                        },
                        images: {scrape: {iterator: "[data-imgid] img", data: 'src'}},
                    }
                }
            },
            function(data) {
                try {
                    var info = data[0][0];
                    callback($.extend({success: info ? true : false, itemId: itemId, url: url}, info));
                } catch (error) {
                    callback({success: false, error: error});
                }
            }
        );
    },
};
