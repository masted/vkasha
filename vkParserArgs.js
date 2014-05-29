var require = patchRequire(require);
var args = require('system').args;
if (args[4] === undefined) throw new Error('param #2 (userId) is required');

module.exports = {
  root: args[3].replace(new RegExp('(.*)/[^/]+/[^/]+'), '$1'),
  userId: args[4]
};