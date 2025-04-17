'use strict';

/**
 * @namespace Cart
 */

var server = require('server');
server.extend(module.superModule);

server.append(
    'Show',
    function (req, res, next) {
        var canceledMonext = req.querystring.canceledMonext;

        if (canceledMonext) {
            var Resource = require('dw/web/Resource');
            var viewData = res.getViewData();
            viewData.valid = {
                error: true,
                monextError: true,
                message: Resource.msg('message.order.cancelled', 'error', null)
            }
            res.setViewData(viewData);
        }

        return next();
    }
);

module.exports = server.exports();
