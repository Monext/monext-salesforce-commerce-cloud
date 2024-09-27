'use strict';

var base = module.superModule;

base.handlePayments = function(order, orderNumber) {
    var result = {};
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');

    if (order.totalNetPrice !== 0.00) {
        var paymentInstruments = order.paymentInstruments;

        if (paymentInstruments.length === 0) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            result.error = true;
        }

        if (!result.error) {
            for (var i = 0; i < paymentInstruments.length; i++) {
                var paymentInstrument = paymentInstruments[i];
                var PaymentMgr = require('dw/order/PaymentMgr');
                var paymentProcessor = PaymentMgr
                    .getPaymentMethod(paymentInstrument.paymentMethod)
                    .paymentProcessor;
                var authorizationResult;
                if (paymentProcessor === null) {
                    Transaction.begin();
                    paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
                    Transaction.commit();
                } else {
                    var HookMgr = require('dw/system/HookMgr');
                    if (HookMgr.hasHook('app.payment.processor.'
                            + paymentProcessor.ID.toLowerCase())) {
                        authorizationResult = HookMgr.callHook(
                            'app.payment.processor.' + paymentProcessor.ID.toLowerCase(),
                            'Authorize',
                            orderNumber,
                            paymentInstrument,
                            paymentProcessor
                        );
                    } else {
                        authorizationResult = HookMgr.callHook(
                            'app.payment.processor.default',
                            'Authorize'
                        );
                    }

                    if (authorizationResult.error) {
                        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
                        result.error = true;
                        break;
                    }

                    if (authorizationResult.redirectURL) {
                        result.redirectURL = authorizationResult.redirectURL;
                        result.sessionID = authorizationResult.sessionID;
                    }
                }
            }
        }
    }

    return result;
}

module.exports = base;
