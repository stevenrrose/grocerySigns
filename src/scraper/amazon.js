/*
 *
 * Amazon scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["Amazon"] = {
    name: "Amazon",
    
    /** Allowed URL pattern. */
    urlPattern: /^http:\/\/www\.amazon\.com\/(s\/ref=nb_sb_noss_2\?field-keywords=.+|dp\/[^/]+)$/,

    /** Length of random string used to search for products. */
    randomSearchStringLength: -4, /* Negative for alpha only */
    
    /**
     * Search Amazon products. Return item IDs = ASINs for first result page.
     *
     *  @param what         Search string.
     *  @param callback     Function called with results.
     */
    search: function(what, callback) {
        console.log("search", what);
        var url = "http://www.amazon.com/s/ref=nb_sb_noss_2?field-keywords=" + what;
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    iterator: ".s-result-item",
                    data: {
                        itemId: {attr: "data-asin"}
                    }
                }
            },
            function(data) {
                callback(data[0]);
            }
        );
    },

    /**
     * Fetch & scrape given Amazon product.
     *
     *  @param itemId       Item ID of the product to scrape.
     *  @param callback     Function called with product info.
     */ 
    fetch: function(itemId, callback) {
        console.log("fetch", itemId);
        var url = "http://www.amazon.com/dp/" + itemId;
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    params: {limit: 1},
                    iterator: "#handleBuy,#centerCol",
                    data: {
                        title: {sel: "#btAsinTitle,#productTitle"},
                        price: {sel: "#actualPriceValue,span.pa_price,span.priceLarge,#priceblock_ourprice"},
                        vendor: {sel: "#brand,.brandLink > a,span:starts-with('by') a:first", method: 'text'},
                        features: {sel: "#feature-bullets-atf,#feature-bullets", scrape: {iterator: "li", data: 'text'}},
                        description: function() {
                            return splitSentences(
                                $(this).parent().find("#productDescription > .content").text()
                            ).filter(function(e) {
                                return e.trim() != "";
                            });
                        },
                        image: function() {
                            return $(this).closest("#a-page").find("#main-image,#landingImage").attr("src");
                        },
                        reviews: function() {
                            return splitSentences(
                                $.makeArray(
                                    $(this).parent().find("[id^='rev-dpReview']").find(".a-icon-row .a-text-bold, .a-section")
                                        .map(function() {
                                            return $(this).text();
                                        })
                                ).join(". ")
                            ).filter(function(e) {
                                return e.trim() != "";
                            });
                        },
                    }
                }
            },
            function(data) {
                var info = data[0][0];
                if (info && info.image) info.images = [info.image];
                callback($.extend({success: info ? true : false, itemId: itemId, url: url}, info));
            }
        );
    },
};

if (typeof $ !== 'undefined') {
    // running in browser.
    
    /**
     * Add missing CSS selectors :starts-with / :ends-with to jQuery.
     */
    $.extend($.expr[":"], {
        "starts-with": function(elem, i, data, set) {
            var text = $.trim($(elem).text()),
                term = data[3];

            // first index is 0
            return text.indexOf(term) === 0;
        },

        "ends-with": function(elem, i, data, set) {
            var text = $.trim($(elem).text()),
                term = data[3];

            // last index is last possible
            return text.lastIndexOf(term) === text.length - term.length;
        }
    });

    /**
     *  Dummy function used in Amazon onload handlers, keeps JS happy.
     */
    function viewCompleteImageLoaded() {}
    function setCSMReq() {}
}