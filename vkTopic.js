var vkParser = require('./vkParser');

module.exports = new Class({
  Extends: vkParser,
  parseGroupTopics: function(name, onTopic) {
    this.thenOpen('http://vk.com/' + name, function() {
      console.log('http://vk.com/' + name);
      this.casper.wait(1, function() {
        this.scrollTillBottom(function() {
          var links = this.casper.evaluate(function() {
            var elements = __utils__.findAll('a.blst_title'); // find topic links
            var r = [];
            for (var i = 0; i < elements.length; i++) {
              r.push(elements[i].getAttribute('href'));
            }
            return r;
          });
          console.log('found ' + links.length + ' topics');
          for (var i = 0; i < links.length; i++) {
            this.parseTopic(links[i], onTopic);
          }
        }.bind(this));
      }.bind(this));
    }.bind(this));
  },
  parseTopic: function(path, onComplete) {
    var ids = path.match(new RegExp('/topic-(\\d+)_(\\d+)'));
    this.thenOpen('http://vk.com' + path, function() {
      this.casper.wait(1, function() {
        this.scrollTillBottom(function() {
          var r = this.casper.evaluate(function() {
            var authors = __utils__.findAll('.bp_post .bp_author'); // find topic links
            var comments = __utils__.findAll('.bp_post .bp_text'); // find topic links
            var r = {
              title: 'dummy',
              comments: [],
              authors: []
            };
            for (var i = 0; i < authors.length; i++) {
              r.comments.push(comments[i].innerHTML);
              r.authors.push([
                authors[i].getAttribute('href'),
                authors[i].innerHTML
              ]);
            }
            return r;
          });
          r.id1 = ids[1];
          r.id2 = ids[2];
          onComplete(r);
        }.bind(this));
      }.bind(this));
    }.bind(this));
  }
});
