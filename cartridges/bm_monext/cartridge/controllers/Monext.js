'use strict';

var server = require('server');

server.post('Refund', function(req, res, next) {
    var orderID = req.querystring.orderID;
    var amount = req.httpParameterMap.amount.value;

    var monextService = require('*/cartridge/scripts/monext/monextService');
    var message = monextService.refund(orderID, {
        amount: amount * 100
    });

    res.render('application/result', {
        message: message
    });
    next();
});

server.post('Cancel', function(req, res, next) {
    var orderID = req.querystring.orderID;
    var amount = req.httpParameterMap.amount.value;

    var monextService = require('*/cartridge/scripts/monext/monextService');
    var message = monextService.cancel(orderID, {
        amount: amount * 100
    });

    if (message.result.title === 'ACCEPTED') {
        var OrderMgr = require('dw/order/OrderMgr');
        var order = OrderMgr.getOrder(orderID);
        var Transaction = require('dw/system/Transaction');
        Transaction.wrap(function () {
            order.setPaymentStatus(require('dw/order/Order').PAYMENT_STATUS_NOTPAID);
        });
    }

    res.render('application/result', {
        message: message
    });
    next();
});

server.post('Capture', function(req, res, next) {
    var orderID = req.querystring.orderID;
    var amount = req.httpParameterMap.amount.value;

    var monextService = require('*/cartridge/scripts/monext/monextService');
    var message = monextService.capture(orderID, {
        amount: amount * 100
    });

    if (message.result.title === 'ACCEPTED') {
        var OrderMgr = require('dw/order/OrderMgr');
        var order = OrderMgr.getOrder(orderID);
        var Transaction = require('dw/system/Transaction');
        Transaction.wrap(function () {
            order.setPaymentStatus(require('dw/order/Order').PAYMENT_STATUS_PAID);
        });
    }

    res.render('application/result', {
        message: message
    });
    next();
});

module.exports = server.exports();
