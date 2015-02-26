/*
 *
 * Etsy scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["Etsy"] = {
	name: "Etsy",
	
	/** Length of random string used to search for products. */
	randomSearchStringLength: 3,
	
	/**
	 * Search Etsy products. Return item ID = listing IDs for first result page.
	 *
	 *	@param what			Search string.
	 *	@param callback		Function called with results.
	 */
	search: function(what, callback) {
		console.log("search", what);
		var url = "http://www.etsy.com/search?q=" + what;
		artoo.ajaxSpider(
			[{url: fetchUrl, data: {url: url}}],
			{
				scrape: {
					iterator: ".listing",
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
	 *	@param itemId		Item ID of the product to scrape.
	 *	@param callback		Function called with product info.
	 */ 
	fetch: function(itemId, callback) {
		console.log("fetch", itemId);
		var url = "http://www.etsy.com/listing/" + itemId;
		artoo.ajaxSpider(
			[{url: fetchUrl, data: {url: url}}],
			{
				scrape: {
					params: {limit: 1},
					iterator: "#content",
					data: {
						title: function() {return $(this).parent().find("meta[name='twitter:title']").attr("value");},
						price: function() {return $(this).parent().find("meta[name='twitter:data1']").attr("value");},
						vendor: {sel: "#seller .shop-name span[itemprop='title']", method: 'text'},
						features: {sel: ".properties", scrape: {iterator: "li", data: 'text'}},
						description: function() {return $.makeArray($(this).find("#description-text").contents().map(function(){return $(this).text();}));},
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
