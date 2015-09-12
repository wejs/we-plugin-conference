var eventModule = require('../../../lib');

module.exports = function(projectPath, Widget) {
  var widget = new Widget('we-cf-news', __dirname);

  widget.viewMiddleware = function viewMiddleware(widget, req, res, next) {
    var eventId = eventModule.getEventIdFromWidget(widget, res);
    if (!eventId) return next();

    var where =  { eventId: res.locals.event.id };
    if (widget.configuration.nid)
      where.id = widget.configuration.nid;

    req.we.db.models.cfnews.findOne({
      where: where
    }).then(function (r) {
      if (!r) return next();
      widget.record = r;
      return next();
    }).catch(next);
  }

  widget.afterSave = function widgetAfterSave(req, res, next) {
    req.body.configuration = {
      nid: req.body.nid
    };
    return next();
  };

  return widget;
};