/*
 *
 * Reddit scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["Reddit"] = {
    name: "Reddit",
    
    /** Allowed URL pattern. */
    urlPattern: /^https:\/\/www\.reddit\.com\/.+$/,

    /** We don't need random strings as Reddit already provides us with randomized pages. */
    randomSearchStringLength: 0,
    
    /**
     * Search Reddit subs.
     *
     *  @param what         Search string. Unused.
     *  @param callback     Function called with results.
     */
    search: function(what, callback) {
        // Reddit kindly provides us with random pages.
        // TODO: subreddit whitelist?
        callback([{itemId: "random"}]);
    },

    /**
     * Fetch & scrape given Reddit page.
     *
     *  @param itemId       Item ID of the product to scrape.
     *  @param callback     Function called with product info.
     */ 
    fetch: function(itemId, callback) {
        console.log("fetch", itemId);
        var url = "https://www.reddit.com/" + itemId;
        console.log(url);
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    iterator: "div.content",
                    data: {
                        url: function() {
                            return $(this).parent().find("link[rel='canonical']").attr('href');
                        },
                        title: {sel: "p.title a.title", method: 'text'},
                        price: function() {
                            return $(this).parent().find(".score .number").text();
                        },
                        vendor: {sel: ".title ~ .tagline .author", method: 'text'},
                        description: function() {
                            return splitSentences(
                                $.makeArray(
                                    $(this).find(".usertext").contents()
                                        .map(function() {
                                            return $(this).text();
                                        })
                                ).join(". ")
                            ).filter(function(e) {
                                return e.trim() != "";
                            });
                        },
                        images: {scrape: {iterator: "img", data: 'src'}},
                    }
                }
            },
            function(data) {
                var info = data[0][0];
                // Generate item ID from URL path with /'s replaced by |'s.
                info.itemId = new URL(info.url).pathname.replace(/\//g, '|');
                // Fix URL protocol in images.
                if (info.images) {
                    for (var i = 0; i < info.images.length; i++) {
                        if (info.images[i].match(/^\/\//)) {
                            info.images[i] = "https:" + info.images[i];
                        }
                    }
                }
                callback($.extend({success: info ? true : false}, info));
            }
        );
    },
};
