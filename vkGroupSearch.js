var require = patchRequire(require);
var vkParser = require('vkParser');

module.exports = new Class({
  Extends: vkParser,

  keywords: [],
  keyword: null,
  i: 0,
  keywordsSelectCount: 10,

  selectKeywords: function(callback) {
    this.db().selectNotPassedKeywords(function(keywords) {
      this.keywords = keywords;
      this.log('keywords selected', 2);
      this.startParse();
    }.bind(this), 'vkKeywords', ['id', 'keyword'], {
      setLimit: 25,
      setOrder: 'id',
      addF: {
        userId: [0, this.userId],
        passed: 0
      },
    }, this.userId);
  },

  /**
   * находить группы в которых
   * - > 1000 подписчиков
   * - они закрытые
   * - наблюдать за статусом
   */
  run: function() {
    this.selectKeywords();
  },
  startParse: function() {
    var limit = 0;
    this.auth(function() {
      if (this.keywords[this.i] === undefined) throw new Error('No keyword by index ' + this.i);
      this.keyword = this.keywords[this.i].keyword;
      var url = 'https://vk.com/search?c%5Bq%5D=' + this.keyword + '&c%5Bsection%5D=communities&c%5Btype%5D=1';
      this.thenOpen(url, function() {
        this.casper.wait(1, function() {
          this.scrollTillBottom(function() {
            this.saveLinks();
          }.bind(this), limit);
        }.bind(this));
      }.bind(this));
    }.bind(this));
  },
  saveLinks: function() {
    var r = this.casper.evaluate(function() {
      var r = [];
      var links = __utils__.findAll('.results .groups_row .title a:first-child');
      var images = __utils__.findAll('.results .groups_row .img img');
      var infos = __utils__.findAll('.results .groups_row .info');
      if (images.length != links.length) throw new Error(images.length + ' != ' + links.length);
      if (infos.length != links.length) throw new Error(infos.length + ' != ' + links.length);
      for (var i = 0; i < links.length; i++) {
        var img = images[i].getAttribute('src');
        if (!img) throw new Error(i + ' bad: ' + links[i].innerHTML);
        var id;
        var pattern = '.*.vk\\.me/g(\\d+)/.*';
        var closed = infos[i].getElementsByTagName('div')[1].innerText == 'Закрытая группа';
        var link = links[i].getAttribute('href');
        var name = link.replace(new RegExp('/([^/]+)'), '$1');
        if (img.match(new RegExp(pattern))) {
          id = parseInt(img.replace(new RegExp(pattern), '$1'));
        } else if (name.match(new RegExp('club(\\d+)'))) {
          id = parseInt(name.replace(new RegExp('club(\\d+)'), '$1'));
        } else {
          id = false;
        }
        r.push({
          name: name,
          title: links[i].innerHTML.replace(/<\/?[^>]+>/gi, ''),
          img: img,
          id: id,
          closed: closed
        });
      }
      return r;
    });
    this.processLinks(r);
  },

  processLinks: function(r) {
    // add some extra data to each item
    r = r.filter(function(v) {
      return v.closed;
    });
    if (!r.length) {
      this.db().update(function() {
        this.log('keyword "' + this.keyword + '" is empty', 1);
        this.next();
      }.bind(this), 'vkKeywords', this.keywords[this.i].id, 'passed', 1);
      return;
    }
    for (var i = 0; i < r.length; i++) {
      r[i].url = this.baseUrl + '/' + r[i].name;
      r[i].userId = this.userId;
    }
    new (require('linksQueue'))(this.casper, r, function(item) {
      var m = this.casper.page.content.match(new RegExp('Groups\\.init\\(\\{"group_id":(\\d+)'));
      if (!m) throw new Error('group id not found on page');
      item.id = m[1];
    }.bind(this), function(item) {
      return item.id === false;
    }, function(items) {
      for (var i = 0; i < items.length; i++) items[i].keyword = this.keyword;
      this.log('groups to add: ' + items.length, 1);
      this.db().insert(function() {
        this.db().update(function() {
          this.log('keyword "' + this.keyword + '" passed', 1);
          this.next();
        }.bind(this), 'vkKeywords', this.keywords[this.i].id, 'passed', 1);
      }.bind(this), 'vkGroups', 'groups', items);
    }.bind(this));
  },

  next: function() {
    if (this.keywords[this.i + 1] !== undefined) {
      this.i++;
      this.run();
      return;
    }
    this.log('finish', 1);
  }

});
