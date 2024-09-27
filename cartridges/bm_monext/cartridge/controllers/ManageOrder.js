'use strict';

var server = require('server');

server.get('Start', function(req, res, next) {
    var orderID = req.querystring.orderID;

    var monextHelper = require('*/cartridge/scripts/monext/monextHelper');
    var amounts = monextHelper.getOrderAmounts(orderID);

    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(orderID);

    var Money = require('dw/value/Money');
    Object.keys(amounts).forEach(function (key) {
        if (key !== 'isOnlyAuthorized') {
            amounts[key + 'Money'] = new Money(amounts[key], order.currencyCode)
        }
    });

    res.render('application/manageOrderLanding', {
        orderID: orderID,
        amounts: amounts
    });
    next();
});

module.exports = server.exports();
