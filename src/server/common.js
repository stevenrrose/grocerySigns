/**
 * Umbrella module for common JS files.
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

include('../common/opentype.min.js');
exports.opentype = global.opentype;
