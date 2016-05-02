/*
 *
 * Etsy scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["Etsy"] = {
    name: "Etsy",
    
    /** Allowed URL pattern. */
    urlPattern: /^https:\/\/www\.etsy\.com\/(search\?q=\w+|listing\/[^/]+(\/stubs\/feedback)?)$/,

    /** Length of random string used to search for products. */
    randomSearchStringLength: 3,
    
    /**
     * Search Etsy products. Return item IDs = listing IDs for first result page.
     *
     *  @param what         Search string.
     *  @param callback     Function called with results.
     */
    search: function(what, callback) {
        console.log("search", what);
        var url = "https://www.etsy.com/search?q=" + what;
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    iterator: "[data-palette-listing-id]",
                    data: {
                        itemId: {attr: "data-palette-listing-id"}
                    }
                }
            },
            function(data) {
                callback(data[0]);
            }
        );
    },

    /**
     * Fetch & scrape given Etsy product.
     *
     *  @param itemId       Item ID of the product to scrape.
     *  @param callback     Function called with product info.
     */ 
    fetch: function(itemId, callback) {
        console.log("fetch", itemId);
        var url = "https://www.etsy.com/listing/" + itemId;
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}, {url: fetchUrl, data: {url: url+'/stubs/feedback'}}],
            {
                process: function(data, i, total) {
                    if (i == 0) {
                        // Main page.
                        data = artoo.helpers.jquerify(data);
                        return artoo.scrape(
                            data.find("#content"),
                            {
                                title: function() {return $(this).parent().find("meta[name='twitter:title']").attr("value");},
                                price: function() {return $(this).parent().find("meta[name='twitter:data1']").attr("value");},
                                vendor: {sel: "#seller .shop-name span[itemprop='title']", method: 'text'},
                                features: {sel: ".properties", scrape: {iterator: "li", data: 'text'}},
                                description: function() {
                                    return splitSentences(
                                        $.makeArray(
                                            $(this).find("#description-text").contents()
                                                .map(function() {
                                                    return $(this).text();
                                                })
                                        ).join(". ")
                                    ).filter(function(e) {
                                        return e.trim() != "";
                                    });
                                },
                                images: {sel: "#image-carousel", scrape: {iterator: "li", data: 'data-large-image-href'}},
                            },
                            {limit: 1}
                        );
                    } else {
                        // Feedback page.
                        data = artoo.helpers.jquerify(data.html);
                        return artoo.scrape(
                            data.find(".feedback-comment"),
                            function() {
                                return splitSentences(
                                    $.makeArray(
                                        $(this).contents()
                                            .map(function() {
                                                return $(this).text();
                                            })
                                    ).join(". ")
                                ).filter(function(e) {
                                    return e.trim() != "";
                                });
                            }
                        );
                    }
                }
            },
            function(data) {
                var info = data[0][0];
                var feedback = data[1];
                info.reviews = [];
                for (var i = 0; i < feedback.length; i++) {
                    for (var j = 0; j < feedback[i].length; j++) {
                        info.reviews.push(feedback[i][j]);
                    }
                }
                callback($.extend({success: info ? true : false, itemId: itemId, url: url}, info));
            }
        );
    },
};
