/**
 * Widget we-cf-events-menu main file
 */
// var eventModule = require('../../../lib');

module.exports = function (projectPath, Widget) {
  var widget = new Widget('we-cf-events-menu', __dirname);

  widget.checkIfIsValidContext = function checkIfIsValidContext(context) {
    if (context) { return false; }
  };
  widget.isAvaibleForSelection = function isAvaibleForSelection(req) {
    if (req.res.locals.eventSearch) return true;
    if (req.res.locals.widgetContext) { return false; }
  };
  // widget.beforeSave = widgetUtils.beforeSave;
  widget.renderVisibilityField = function renderVisibilityField(widget, context, req, res) {
    var field = '';

    // visibility field
    field += '<div class="form-group"><div class="row">' +
      '<label class="col-sm-4 control-label">'+
      res.locals.__('widget.visibility') + '</label>'+
    '<div class="col-sm-8"><select name="visibility" class="form-control">';
      field +=
      '<option value="in-page" selected>'+
        res.locals.__('widget.in-page')+
      '</option>'+
    '</select></div></div>'+
    '</div><hr>';

    return field;
  };
  /**
   * View middleware, use for set widget variables
   *
   * @param  {Object}   widget  Widget record
   * @param  {Object}   req    express.js request
   * @param  {Object}   res    express.js response
   * @param  {Function} next   callback
   */
  widget.viewMiddleware = function viewMiddleware(widget, req, res, next) {

    widget.navigationMenu = new req.we.class.Menu({
      id: 'events-menu-navigation',
      name: 'events-menu-navigation',
      class: 'flat-menu',
      links: [{
        id: 'events-menu-navigation-next',
        text: '<span class="fa fa-calendar" aria-hidden="true"></span> '+req.__('event.find.next'),
        href: '/event',
        class: null,
        weight: 1,
        name: 'menu.events.next'
      }]
    });

    if (req.isAuthenticated()) {
      widget.navigationMenu.addLink({
        id: 'events-menu-navigation-my',
        text: '<i class="fa fa-list" aria-hidden="true"></i> '+req.__('event.find.my'),
        href: '/event?my=1',
        class: null,
        weight: 5,
        name: 'menu.events.my'
      });
    }

    var sql = 'SELECT DISTINCT text FROM terms '+
      'LEFT JOIN modelsterms AS mt ON mt.modelName="event" '+
        'AND mt.vocabularyName="Tags" '+
        'AND mt.termId=terms.id';
    req.we.db.defaultConnection.query(sql)
    .spread(function (terms) {
      widget.terms = terms.map(function(m){
        return m.text;
      });

      next();
    }).catch(next);
  }

  return widget;
};