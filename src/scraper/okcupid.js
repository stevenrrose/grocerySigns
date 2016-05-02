/*
 *
 * OkCupid scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["OkCupid"] = {
    name: "OkCupid",
    
    /** Allowed URL pattern. */
    urlPattern: /^http:\/\/(www\.google\.com\/search\?q=site:www\.okcupid\.com\/profile\+\w+|www\.okcupid\.com\/profile\/[^/]+)$/,

    /** Length of random string used to search for profiles. */
    randomSearchStringLength: 2,
    
    /**
     * Search OkCupid products. Return item ID = profile IDs for first result page.
     *
     *  @param what         Search string.
     *  @param callback     Function called with results.
     */
    search: function(what, callback) {
        console.log("search", what);
        var url = "http://www.google.com/search?q=site:www.okcupid.com/profile+" + what;
        console.log(url);
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    iterator: "#ires div.s div.kv cite",
                    data: {
                        itemId: function() {
                            var re = /\/profile\/([^/?]+)/.exec($(this).text());
                            if (!re) return undefined;
                            return re[1];
                        },
                    }
                }
            },
            function(data) {
                callback(data[0]);
            }
        );
    },

    /**
     * Fetch & scrape given OkCupid profile.
     *
     *  @param itemId       Item ID of the product to scrape.
     *  @param callback     Function called with product info.
     */ 
    fetch: function(itemId, callback) {
        console.log("fetch", itemId);
        var url = "http://www.okcupid.com/profile/" + itemId;
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    params: {limit: 1},
                    iterator: "#main_content",
                    data: {
                        title: {sel: ".userinfo2015-basics-username"},
                        price: {sel: ".userinfo2015-basics-asl-age"},
                        vendor: {sel: ".userinfo2015-basics-asl-location"},
                        features: {sel: ".details2015", scrape: {iterator: ".details2015-section", data: function() {
                            return $(this).text().trim();
                        }}},
                        description: function() {
                            return splitSentences(
                                $.makeArray(
                                    $(this).find(".essays2015-essay-content").contents()
                                        .map(function() {
                                            return $(this).text();
                                        })
                                ).join(". ")
                            ).filter(function(e) {
                                return e.trim() != "";
                            });
                        },
                        images: {sel: ".userinfo2015-thumb", scrape: {iterator: "img", data: 'src'}},
                    }
                }
            },
            function(data) {
                var info = data[0][0];
                callback($.extend({success: info ? true : false, itemId: itemId, url: url}, info));
            }
        );
    },
};
