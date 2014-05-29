var require = patchRequire(require);
var vkParser = require('vkParser');

module.exports = new Class({
  Extends: vkParser,

  run: function() {
    this.auth(function() {
      this.openAndScrollTillBottom('https://vk.com/groups', function() {
        var groups = this.casper.evaluate(function() {
          var items = __utils__.findAll('.group_list_row');
          var links = __utils__.findAll('.group_list_row .group_row_labeled a');
          var images = __utils__.findAll('.group_list_row .group_row_labeled img');
          var r = [];
          for (var i = 0; i < items.length; i++) {
            var name = links[i].getAttribute('href').replace(new RegExp('/([^/]+)'), '$1');
            var title = links[i].innerHTML.replace(/<\/?[^>]+>/gi, '');
            var id = items[i].getAttribute('id').replace('gl_groups', '').replace('gl_admin', '');
            r.push({
              name: name,
              title: title,
              img: '',
              id: id,
              closed: 1,
              joined: 1,
              requested: 1,
              userId: this.userId
            });
          }
          return r;
        });
        var groupIds = [];
        for (var i = 0; i < groups.length; i++) groupIds.push(groups[i].id);
        this.db().select(function(existing) {
          for (var i = 0; i < existing.length; i++) existing[i].userId = this.userId;
          var existingIds = [];
          for (var i = 0; i < existing.length; i++) existingIds.push(existing[i].id);
          /*
          require('utils').dump({
            groupIds: groupIds,
            existingIds: existingIds,
            nonExistingGroups: nonExistingGroups
          });
          */
          var nonExistingGroups = [];
          for (var i = 0; i < groupIds.length; i++) {
            if (existingIds.indexOf(groupIds[i]) === -1) {
              nonExistingGroups.push(groups[i]);
            }
          }
          if (!nonExistingGroups.length) {
            this.log('there are no non existing groups', 1);
            return;
          }
          this.db().insert(function() {
            this.log('inserted non existing groups: ' + nonExistingGroups.length, 1);
          }.bind(this), 'vkGroups', 'groups', nonExistingGroups);
        }.bind(this), 'vkGroups', ['id'], {
          addF: {
            id: groupIds,
            userId: this.userId
          }
        });
        this.db().joinSync(function() {
          this.log('sync done', 1);
        }.bind(this), groupIds, this.userId);
      }.bind(this));
    }.bind(this));
  }

});