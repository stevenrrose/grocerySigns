var express = require('express');
var app = express();

app.get('/', function (req, res) {
  res.sendFile('/client/grocery-signs.html', {root: __dirname + '/..'});
});

app.use(express.static(__dirname + '/../client'));
app.use(express.static(__dirname + '/../templates'));
app.use('/scraper', express.static(__dirname + '/../scraper'));


var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
