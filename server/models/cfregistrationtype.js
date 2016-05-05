/**
 * Resgistration type
 *
 * @module      :: Model
 * @description :: Conference system registration type model
 *
 */

module.exports = function Model(we) {
  var model = {
    definition: {
      name: {
        type: we.db.Sequelize.STRING,
        allowNull: false
      },
      price: {
        type: we.db.Sequelize.DECIMAL(10, 2),
        formFieldType: 'event-price',
        defaultValue: 0
      },
      description: {
        type: we.db.Sequelize.TEXT,
        formFieldType: 'html',
        formFieldHeight: 300
      },

      startDate: { type: we.db.Sequelize.DATE },
      endDate: { type: we.db.Sequelize.DATE }
    },
    associations: {
      event: {
        type: 'belongsTo',
        model: 'event'
      }
    },
    options: {
      titleField: 'name',
      classMethods: {
        /**
         * Context loader, preload current request record and related data
         *
         * @param  {Object}   req  express.js request
         * @param  {Object}   res  express.js response
         * @param  {Function} done callback
         */
        contextLoader: function contextLoader(req, res, done) {
          if (!res.locals.id || !res.locals.loadCurrentRecord) return done();

          return this.find({
            where: { id: res.locals.id },
            include: [{ all: true }]
          }).then(function (record) {
            res.locals.data = record;

            // in other event
            if (record && req.params.eventId) {
              if (req.params.eventId != record.eventId) {
                return res.notFound();
              }
            }

            if (record && record.dataValues.creatorId && req.isAuthenticated()) {
              // ser role owner
              if (record.isOwner(req.user.id)) {
                if(req.userRoleNames.indexOf('owner') == -1 ) req.userRoleNames.push('owner');
              }
            }

            return done();
          });
        }
      },
      instanceMethods: {
        getUrlPath: function getUrlPath() {
          return we.router.urlTo(
            'cfregistrationtype.findOne', [this.eventId, this.id]
          );
        }
      },
      // TODO check if user is already registered in event
      hooks: {}
    }
  }

  return model;
}