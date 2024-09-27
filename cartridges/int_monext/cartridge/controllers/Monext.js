'use strict';

var server = require('server');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.get(
    'ReenterHPP',
    csrfProtection.generateToken,
    function (req, res, next) {
        var monextHelper = require('*/cartridge/scripts/monext/monextHelper');
        var orderHandleResult = monextHelper.handleOrder(req.querystring.paylinetoken, {
            shouldTryFailOrder: "true",
            shouldTryPlaceOrder: "true",
            shouldTryRefundPayment: "false",
            shouldTryCapturePayment: "false",
            shouldTryCancelPayment: "false",
            shouldTryCancelOrder: "false",
            shouldTrySetOrderAsPaid: "true"
        });

        if (orderHandleResult.error) {
            var URLUtils = require('dw/web/URLUtils');
            if (orderHandleResult.code === 'NO_ORDER') {
                res.redirect(URLUtils.url('Error-ErrorCode', 'err', 'notfound'));
            }
            if (orderHandleResult.code === 'NOT_PLACED') {
                res.redirect(URLUtils.url('Error-ErrorCode', 'err', 'notplaced'));
            }
            if (orderHandleResult.code === 'FAILED') {
                res.redirect(URLUtils.url('Cart-Show'));
            }
            return next();
        }

        // Reset usingMultiShip after successful Order placement
        req.session.privacyCache.set('usingMultiShipping', false);

        var config = {
            numberOfLineItems: '*'
        };

        var Locale = require('dw/util/Locale');
        var currentLocale = Locale.getLocale(req.locale.id);

        var OrderModel = require('*/cartridge/models/order');
        var orderModel = new OrderModel(
            orderHandleResult.order,
            { config: config, countryCode: currentLocale.country, containerView: 'order' }
        );

        var passwordForm;

        var reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
        var reportingURLs = reportingUrlsHelper.getOrderReportingURLs(orderHandleResult.order);

        if (!req.currentCustomer.profile) {
            passwordForm = server.forms.getForm('newPasswords');
            passwordForm.clear();
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: false,
                passwordForm: passwordForm,
                reportingURLs: reportingURLs,
                orderUUID: orderHandleResult.order.getUUID()
            });
        } else {
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: true,
                reportingURLs: reportingURLs,
                orderUUID: orderHandleResult.order.getUUID()
            });
        }

        return next();
    }
);

server.get(
    'Notification',
    function (req, res, next) {
        var monextHelper = require('*/cartridge/scripts/monext/monextHelper');
        monextHelper.handleOrder(req.httpParameterMap.token.value, {
            shouldTryFailOrder: "true",
            shouldTryPlaceOrder: "true",
            shouldTryRefundPayment: "false",
            shouldTryCapturePayment: "false",
            shouldTryCancelPayment: "false",
            shouldTryCancelOrder: "false",
            shouldTrySetOrderAsPaid: "true"
        });

        return next();
    }
);

module.exports = server.exports();
