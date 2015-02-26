/*
 *
 * eBay scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["eBay"] = {
	name: "eBay",
	
	/** Length of random string used to search for products. */
	randomSearchStringLength: 4,
	
	/**
	 * Search eBay products. Return item ID = listing IDs for first result page.
	 *
	 *	@param what			Search string.
	 *	@param callback		Function called with results.
	 */
	search: function(what, callback) {
		console.log("search", what);
		var url = "http://www.ebay.com/sch/i.html?_nkw=" + what;
		artoo.ajaxSpider(
			[{url: fetchUrl, data: {url: url}}],
			{
				scrape: {
					iterator: ".sresult",
					data: {
						itemId: {attr: "listingid"}
					}
				}
			},
			function(data) {
				callback(data[0]);
			}
		);
	},

	/**
	 * Fetch & scrape given eBay product.
	 *
	 *	@param itemId		Item ID of the product to scrape.
	 *	@param callback		Function called with product info.
	 */ 
	fetch: function(itemId, callback) {
		console.log("fetch", itemId);
		var url = "http://www.ebay.com/itm/" + itemId;
		artoo.ajaxSpider(
			[{url: fetchUrl, data: {url: url}}],
			{
				scrape: {
					params: {limit: 1},
					iterator: "#Body",
					data: {
						title: function() {return $(this).parent().find("meta[property='og:title']").attr("content");},
						price: function() {
							var e;
							if ((e = $(this).parent().find("meta[name='twitter:data1']")).length) return e.attr("content");
							if ((e = $(this).parent().find("meta[name='twitter:text:price']")).length) return e.attr("content");
							if ((e = $(this).find("span[itemprop='price']")).length) return e.text();
							return undefined;
						},
						vendor: {sel: "#storeSeller a", attr: "title"},
						features: {sel: ".itemAttr", scrape: {iterator: "td.attrLabels", data: function() {return $(this).text() + " " + $(this).find("+td").text();}}},
						description: {sel: "#desc_div", scrape: {iterator: "td:not(:has(table)) :not(style,script,noscript)", data: 'text'}}, 
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
