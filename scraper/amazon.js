/*
 *
 * Amazon scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["Amazon"] = {
	name: "Amazon",
	
	/**
	 * Search Amazon products. Return item IDs = ASINs for first result page.
	 *
	 *	@param what			Search string.
	 *	@param callback		Function called with results.
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
						itemId: {attr:"data-asin"}
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
	 *	@param itemId		Item ID of the product to scrape.
	 *	@param callback		Function called with product info.
	 */ 
	fetch: function(itemId, callback) {
		console.log("fetch", itemId);
		var url = "http://www.amazon.com/dp/" + itemId;
		artoo.ajaxSpider(
			[{url: fetchUrl, data: {url: url}}],
			{
				scrape: {
					params: {limit: 1},
					iterator: "#handleBuy",
					data: {
						title: {sel:"#btAsinTitle"},
						price: {sel:"#actualPriceValue,span.pa_price,span.priceLarge"},
						vendor: {sel:"#brand,.brandLink > a,span:starts-with('by') a:first", method:'text'},
						features: {sel:"#feature-bullets-atf", scrape: {iterator: "li", data:'text'}},
						description: function() {return $(this).parent().find("#productDescription > .content").text().split(/[.!;]/);},
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
