/**
 * Umbrella module for client-side scraping JS files.
 */

// Modules for JS file loading.
var vm = require('vm');
var fs = require('fs');

/**
 * include
 * 
 * Execute the given JS file in the current context.
 * 
 * @param {string} path file to include
 */
function include(path) {
    var code = fs.readFileSync(path, 'utf-8');
    vm.runInThisContext(code, path);
}

/**
 * global.providers
 * 
 * Browser code defines the *providers* variable in a global script element.
 * In Node.js the *global* object maps to the global context in each included 
 * file, so define the variable as a property of this object.
 */
global.providers = {};
include('../scraper/amazon.js');
include('../scraper/ebay.js');
include('../scraper/etsy.js');
include('../scraper/okcupid.js');

// Exports the above *providers* variable.
exports.providers = providers;
