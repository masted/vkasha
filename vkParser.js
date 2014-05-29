var require = patchRequire(require);
require('mootools');
var rumax = require('rumax');
var loglevel = require('loglevel');

module.exports = new Class({
  Implements: [rumax, loglevel],

  authorized: false,
  baseUrl: 'http://vk.com',
  _db: null,
  userId: null,
  logLevel: 3,

  initialize: function(casper) {
    Object.merge(this, require('vkParserArgs'));
    casper.options.stepTimeout = 15000;
    this.casper = casper;
    this.log('start', 2);
    this.casper.start();
  },

  db: function() {
    if (this._db !== null) return this._db;
    this._db = new (require('db'))(this.casper, this.root);
    return this._db;
  },

  auth: function(onAuth) {
    var dir = require('system').args[3].replace(new RegExp('(.*)/[^/]+'), '$1');
    var users = eval(require('fs').read(dir + '/users.json'));
    users = users.filter(function(user) {
      return user.id == this.userId;
    }, this);
    if (!users.length) throw new Error('User with id=' + this.userId + ' not found');
    this._auth(users[0], onAuth);
  },

  _auth: function(opts, onAuth) {
    if (this.authorized) {
      onAuth();
      return;
    }
    this.log('auth login: ' + opts.email + ' (' + opts.title + ')', 1);
    var casper = this.casper;
    casper.on('page.error', function(msg, trace) {
      var text = msg + "\n====\n" + trace.length;
      for (var i = 0; i < trace.length; i++) {
        text += trace[i]['file'] + //
          (trace[i]['function'] ? ' - ' + trace[i]['function'] : '') + ':' + //
          trace[i]['line'] + "\n";
      }
      this.log(text, 1);
    });
    casper.start(this.baseUrl + '/login?act=mobile&hash=' + opts.hash);
    casper.then(function() {
      casper.evaluate(function(email, pass) {
        document.getElementById('quick_email').value = email;
        document.getElementById('quick_pass').value = pass;
      }, opts.email, opts.pass);
    });
    casper.then(function() {
      casper.click('#quick_login_button');
      this.waitForSelector('body', function() {
        this.log('1st page loaded: ' + casper.page.url, 2);
        var code = casper.evaluate(function() {
          return document.getElementById('code');
        });
        if (!code && casper.page.url.test('security_check&')) throw new Error("security_check. code field not exists");
        if (code) {
          casper.evaluate(function(code) {
            document.getElementById('code').value = code;
          }, opts.code);
          casper.then(function() {
            casper.click('#validate_btn');
          });
          casper.wait(1000, function() {
            if (this.getCurrentUrl().test('security_check&')) {
              this.capture();
              throw new Error('code not good. capture at /home/user/ngn-env/projects/sboards/res.png');
            }
            this.log('clicked ok, new location is ' + this.getCurrentUrl(), 2);
          }.bind(this));
          casper.waitForSelector('#myprofile_wrap', function() {
            this.onAuth(onAuth);
          }.bind(this));
        } else {
          this.log('authorized ok without code', 1);
          this.log('wait for selector #myprofile_wrap', 3);
          casper.waitForSelector('#myprofile_wrap', function() {
            this.log('run onAuth', 2);
            this.onAuth(onAuth);
          }.bind(this));
        }
      }.bind(this));
    }.bind(this));
    casper.run();
  },
  onAuth: function(onAuth) {
    this.authorized = true;
    onAuth();
  },
  openAndScrollTillBottom: function(url, onComplete, limit) {
    this.thenOpen(url, function() {
      this.casper.wait(1, function() {
        this.scrollTillBottom(onComplete, limit);
      }.bind(this));
    }.bind(this));
  },
  scrollTillBottom: function(onComplete, limit) {
    var ths = this;
    var _scroll = function(onScroll) {
      var heightBeforeScroll = ths.casper.evaluate(function() {
        return document.body.scrollHeight;
      });
      ths.casper.evaluate(function() {
        window.document.body.scrollTop = document.body.scrollHeight; // скролим
      });
      ths.casper.wait(1500, function() {                            // ждём
        var heightAfter2sec = ths.casper.evaluate(function() {
          return document.body.scrollHeight;                         // смотрим
        });
        ths.capture();
        ths.log('heightBeforeScroll: ' + heightBeforeScroll + ', heightAfter2sec: ' + heightAfter2sec, 2);
        bottom = heightBeforeScroll == heightAfter2sec;
        if (onScroll) onScroll(bottom);
      });
    };

    /**
     * @param onComplete clallback function(isLimit)
     * @param limit
     * @param n
     */
    var scrollR = function(onComplete, limit, n) {
      _scroll(function(bottom) {
        if (bottom) {
          ths.log('page bottom', 2);
          onComplete(false);
          return;
        }
        ths.log('scroll iteration ' + (n + 1) + ', limit=' + limit + ', n=' + n, 2);
        if (limit && n + 1 == limit) {
          ths.log('limit ' + limit + ' excess', 1);
          onComplete(true);
          return;
        }
        scrollR(onComplete, limit, n + 1);
      });
    };
    var scroll = function(onComplete) {
      scrollR(onComplete, limit, 0);
    };
    scroll(onComplete);
  }

});
