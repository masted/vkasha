var require = patchRequire(require);
var vkParser = require('vkParser');

module.exports = new Class({
  Extends: vkParser,

  requesting: [],
  links: [],
  i: 0,

  run: function() {
    this.auth(function() {
      this.request();
    }.bind(this));
  },

  request: function() {
    this.initRequesting(function() {
      this.requestUrl();
    }.bind(this));
  },

  requestUrl: function() {
    this.thenOpen(this.requesting[this.i].url, function(page) {
      this.casper.wait(100, function() {
        var status = this.casper.evaluate(function() {
          var joinBlock = __utils__.findAll('#group_like_module');
          if (!joinBlock.length) {
            closedPageBlock = __utils__.findAll('.closed_page');
            if (closedPageBlock && closedPageBlock[0].innerText.match('Вы добавлены в чёрный список')) {
              return 3;
            }
            return 4;
          }
          var text = joinBlock[0].innerText;
          if (text.match('Вы состоите в группе')) {
            return 2;
          } else if (text.match('Вы подали')) {
            return 1;
          } else if (text.match('Подать заявку')) {
            return 0;
          }
          throw new Error('Unknown join block text');
        });
        var titles = [
          'не в группе', 'уже подана заявка', 'уже в группе', 'в черном списке', 'неизвестная хуйня'
        ];
        console.log(page.url + '. ' + titles[status] + ' :: ' + this.requesting[this.i].title.substring(0, 20));
        if (status == 0) {
          this.casper.click('#group_like_module button');
          this.db().update(function() {
            this.requestNextUrl();
          }.bind(this), 'vkGroups', this.requesting[this.i].id, 'requested', 1);
        } else if (status == 1) {
            this.db().update(function() {
              this.requestNextUrl();
            }.bind(this), 'vkGroups', this.requesting[this.i].id, 'requested', 1);
        } else {
          this.requestNextUrl();
        }
      }.bind(this));
    }.bind(this));
  },

  requestNextUrl: function() {
    if (this.requesting[this.i + 1] === undefined) {
      console.log('done');
      return;
    }
    this.i++;
    this.requestUrl();
  },

  initRequesting: function(callback) {
    this.db().select(function(requesting) {
      for (var i = 0; i < requesting.length; i++) {
        requesting[i].url = this.baseUrl + '/' + requesting[i].name;
      }
      this.requesting = requesting;
      console.log('requesting count: ' + requesting.length);
      callback();
    }.bind(this), 'vkGroups', ['name', 'id', 'title'], {
      addF: {
        requested: 0,
        closed: 1,
        joined: 0,
        userId: this.userId
      }
    });
  }

});
