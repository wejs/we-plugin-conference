module.exports = {
  /**
   * Event location page, by default will show one map with event location to user
   */
  location: function location(req, res, next) {
    if (!res.locals.event) return res.notFound();

    res.locals.data = res.locals.event;
    req.we.controllers.event.findOne(req, res, next);
  },

  find: function findAll(req, res, next) {
    if (req.query.my) {
      if (!req.isAuthenticated()) return res.forbidden();
      res.locals.query.include.push({
        model: req.we.db.models.user, as: 'managers',
        where: { id: req.user.id }
      });
    } else if (req.query.manager) {
      res.locals.query.include.push({
        model: req.we.db.models.user, as: 'managers',
        where: { id: req.query.manager }
      });
    } else {
      res.locals.query.where.published = true;
    }

    return res.locals.Model.findAndCountAll(res.locals.query)
    .then(function afterLoad(record) {
      if (!record) return next();

      res.locals.metadata.count = record.count;
      res.locals.data = record.rows;

      if (!req.isAuthenticated()) return res.ok();
      // if user is authenticated load its registration status
      req.we.utils.async.each(res.locals.data, function (r, next) {
        // load current user registration register
        req.we.db.models.cfregistration.findOne({
          where: { eventId: r.id, userId: req.user.id }
        }).then(function (cfr) {
          if (!cfr) return next();
          r.userCfregistration = cfr;
          next();
        }).catch(next);
      }, function (err){
        if (err) return res.serverError();
        return res.ok();
      });
    });
  },

  create: function create(req, res) {
    if (!res.locals.template) res.locals.template = res.locals.model + '/' + 'create';

    if (!res.locals.data) res.locals.data = {};

     req.we .utils._.merge(res.locals.data, req.query);

    if (req.method === 'POST') {
      if (req.isAuthenticated()) req.body.creatorId = req.user.id;

      // set temp record for use in validation errors
      res.locals.data = req.query;
      req.we .utils._.merge(res.locals.data, req.body);

      return res.locals.Model.create(req.body)
      .then(function (record) {
        res.locals.data = record;

        res.locals.redirectTo = '/event/'+record.id+'/edit';
        res.created();
      }).catch(res.queryError);
    } else {
      res.locals.data = req.query;
      res.ok();
    }
  },

  edit: function edit(req, res) {
    var record = res.locals.data;

    if (req.method === 'POST') {
      if (!record) return res.notFound();

      record.updateAttributes(req.body)
      .then(function() {
        res.locals.data = record;

        if (req.body.save_next) {
          var ns = 2;
          if (req.query.step) ns = Number(req.query.step)+1;

          res.locals.redirectTo = req.path + '?step='+ns;
        } else {
          res.locals.redirectTo = req.url;
        }


        return res.updated();
      }).catch(res.queryError);
    } else {
      res.ok();
    }
  },

  adminIndex: function adminIndex(req, res) {
    req.we.utils.async.parallel([
      function (done) {
        return req.we.db.models.cfsession.findAll({
          where: {
            eventId: res.locals.event.id,
            requireRegistration: 1
          },
          include: [
            { model: req.we.db.models.cfroom, as: 'room' },
            { model: req.we.db.models.cfregistration, as: 'subscribers' }
          ]
        }).then(function (cfsessions) {
          res.locals.sessionsToRegister = cfsessions;

          done();
        }).catch(done)
      }
    ], function (err) {
      if (err) return res.queryError(err);

      res.ok();
    });
  },

  adminMenu: function adminMenu(req, res) {
    res.locals.title = req.__('Menus');
    res.ok();
  },

  resetConferenceMenu: function resetConferenceMenu(req, res) {
    var we = req.getWe();

    we.db.models.cfmenu.destroy({
      where: { eventId: res.locals.event.id }
    }).then(function (result) {
      we.log.info('event resetConferenceMenu result: ', result);
      res.locals.event.generateDefaultMenus(function(err) {
        if (err) return res.serverError(err);

        res.redirect('/event/' + res.locals.event.id + '/admin/menu');
      });
    }).catch(res.serverError);
  },

  /**
   * Create or update one event widget
   */
  saveWidget: function saveWidget(req, res, next) {
    var we = req.getWe();

    if (!res.locals.event || !res.locals.widgetContext)
      return res.forbidden();

    req.body.context = res.locals.widgetContext;

    we.utils.async.series([
      function checkContextAndPermissions(done) {
        // modelName is required
        if (!req.body.modelName) {
          req.body.modelId = null;
          return done();
        } else if (req.body.modelName) {
          // not is a event model
          if (we.config.event.models.indexOf(req.body.modelName) === -1)
            return done('modelName not is a valid event model');
          if (req.body.modelName === 'event') {
            // current event
            req.body.modelId = res.locals.event.id;
            return done();
          }
          // session widget
          if (!req.body.modelId) return done();
          // model widget
          // ćheck if this model exists
          return we.db.models[req.body.modelName]
          .findById(req.body.modelId).then(function (r) {
            if (!r) {
              req.body.modelId = null;
              return done();
            }
            // only allow add widgets in models how are inside current event
            if (r.eventId != res.locals.event.id) {
              req.body.modelName = null;
              req.body.modelId = null;
            }

            done();
          }).catch(done);
        }

        done();
      }
    ], function (err) {
      if (err) return res.serverError();

      if (req.params.widgetId) {
        we.controllers.widget.edit(req, res, next);
      } else {
        we.controllers.widget.create(req, res, next);
      }
    });
  },

  deleteWidget: function deleteWidget(req, res, next) {
    var we = req.getWe();

    if (!res.locals.event || !res.locals.widgetContext)
      return res.forbidden();

    we.db.models.widget.findById(res.locals.id)
    .then(function(widget) {
      if(!widget) return res.notFound();
      if (widget.context !== res.locals.widgetContext) return res.forbidden();

      res.locals.data = widget;

      we.controllers.widget.delete(req, res, next);
    }).catch(res.queryError);
  },
  /**
   * Sort multiple widgets
   */
  sortWidgets: function sortWidgets(req, res, next) {
    var we = req.getWe();

    we.controllers.widget.sortWidgets(req, res, next);
  },

  setManagers: function setManagers(req, res, next) {
    var we = req.getWe();

    if (req.method == 'POST') {
      if (req.body.idToAdd)
        return we.controllers.event.addManager(req, res, next);

      if (req.body.idToRemove)
        return we.controllers.event.removerManager(req, res, next);

      res.ok();
    } else {
      res.ok();
    }
  },

  addManager: function addManager(req, res) {
    var we = req.getWe();

    if (!Number(req.body.idToAdd)) return res.badRequest();

    we.db.models.user.findById(req.body.idToAdd)
    .then(function (mu) {
      if (!mu) {
        res.addMessage('error', 'user.not.found');
        return res.ok();
      }
      var event = res.locals.event;
      event.addManager(mu).then(function() {
        // TODO addManager dont are updating event.managers list then we need to get it
        event.getManagers().then(function(managers) {
          res.locals.event.managers = managers;
          res.addMessage('success', 'event.manager.add.success');
          res.ok();
        }).catch(res.queryError);
      }).catch(res.queryError);
    }).catch(res.queryError);
  },

  removerManager: function removerManager(req, res) {
   var we = req.getWe();

    if (!Number(req.body.idToRemove)) return res.badRequest();

    we.db.models.user.findById(req.body.idToRemove)
    .then(function (mu) {
      if (!mu) {
        res.addMessage('error', 'user.not.found');
        return res.ok();
      }

      var event = res.locals.event;

      event.removeManager(mu).then(function() {
        // TODO removeManager dont are updating event.managers list then we need to get it
        event.getManagers().then(function(managers) {
          res.locals.event.managers = managers;

          res.addMessage('success', 'event.manager.remove.success');
          res.ok();
        }).catch(res.queryError);
      }).catch(res.queryError);
    }).catch(res.queryError);
  },

  /**
   * Authenticated user area inside the event
   */
  my: function my(req, res) {
    if (!req.isAuthenticated()) return res.forbidden();
    res.ok();
  }
};