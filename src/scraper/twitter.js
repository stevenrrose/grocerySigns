/*
 *
 * Twitter trending topics scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["Twitter"] = {
    name: "Twitter",
    
    /** Allowed URL pattern. */
    urlPattern: /^https?:\/\/(trends24\.in(\/.*)?|twitter\.com\/search\?q=.+)$/,

    /** We don't need random strings as Trends24 already provides us with organized lists. */
    randomSearchStringLength: 0,
    
    /**
     * Search Twitter trending topics.
     *
     *  @param what         Search string. Unused.
     *  @param callback     Function called with results.
     */
    search: function(what, callback) {
        // Get list of locations.
        console.log("search", what);
        var url = "https://trends24.in";
        console.log(url);
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    iterator: "#location-list a",
                    data: {
                        path: {attr: 'href'},
                    }
                }
            },
            function(data) {
                // Pick a random location.
                var total = data[0].length;
                var i = Math.floor(Math.random()*total);
                var url = "https://trends24.in" + data[0][i].path;
                console.log(url);
                artoo.ajaxSpider(
                    [{url: fetchUrl, data: {url: url}}],
                    {
                        scrape: {
                            iterator: "#trend-list a",
                            data: {
                                itemId: function() {
                                    var re = /search\?q=(.+)/.exec($(this).attr('href'));
                                    if (!re) return undefined;
                                    return re[1];
                                }
                            }
                        }
                    },
                    function(data) {
                        callback(data[0]);
                    }
                );
            }
        );
    },

    /**
     * Fetch & scrape given Twitter search result.
     *
     *  @param itemId       Item ID of the search page to scrape.
     *  @param callback     Function called with page info.
     */ 
    fetch: function(itemId, callback) {
        console.log("fetch", itemId);
        var url = "https://twitter.com/search?q=" + itemId;
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    iterator: ".tweet",
                    data: {
                        url: {sel: ".time a", attr: 'href'},
                        title: function() {return decodeURIComponent(itemId);},
                        price: {sel: ".ProfileTweet-action--retweet .ProfileTweet-actionButton .ProfileTweet-actionCountForPresentation", method: 'text'},
                        vendor: {sel: ".fullname", method: 'text'},
                        description: function() {
                            return splitSentences(
                                $.makeArray(
                                    $(this).find(".tweet-text").contents()
                                        .map(function() {
                                            return $(this).text();
                                        })
                                ).join(". ")
                            ).filter(function(e) {
                                return e.trim() != "";
                            });
                        },
                        images: {sel: ".content", scrape: {params: {limit: 5}, iterator: "img", data: 'src'}},
                    }
                }
            },
            function(data) {
                // Pick a random tweet.
                var total = data[0].length;
                var i = Math.floor(Math.random()*total);
                var info = data[0][i];
                info.url = "https://twitter.com" + info.url;
                // Generate item ID from URL path with /'s replaced by |'s.
                info.itemId = new URL(info.url).pathname.replace(/\//g, '|');
                callback($.extend({success: info ? true : false}, info));
            }
        );
    },
};
