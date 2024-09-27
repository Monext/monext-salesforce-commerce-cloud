'use strict';

var collections = require('*/cartridge/scripts/util/collections');

var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');

/**
 * Verifies that entered credit card information is a valid card. If the information is valid a
 * credit card payment instrument is created
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @param {string} paymentMethodID - paymentmethodID
 * @param {Object} req the request object
 * @return {Object} returns an error object
 */
function Handle(basket) {
    var currentBasket = basket;
    var cardErrors = {};
    var serverErrors = [];

    Transaction.wrap(function () {
        var paymentInstruments = currentBasket.getPaymentInstruments('MONEXT');

        collections.forEach(paymentInstruments, function (item) {
            currentBasket.removePaymentInstrument(item);
        });

        var paymentInstrument = currentBasket.createPaymentInstrument('MONEXT', currentBasket.totalGrossPrice);

        paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
    });

    return { fieldErrors: cardErrors, serverErrors: serverErrors, error: false };
}

/**
 * Authorizes a payment using a credit card. Customizations may use other processors and custom
 *      logic to authorize credit card payment.
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var serverErrors = [];
    var fieldErrors = {};
    var error = false;

    var monextService = require('*/cartridge/scripts/monext/monextService');
    var message = monextService.createSession(orderNumber, paymentInstrument);

    if (message.error) {
        error = true;
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );

        return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: error};
    }

    try {
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
        });
    } catch (e) {
        error = true;
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
    }

    var redirectURL = message.redirectURL;
    var sessionID = message.sessionId;
    return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: error, redirectURL: redirectURL, sessionID: sessionID};
}

exports.Handle = Handle;
exports.Authorize = Authorize;
