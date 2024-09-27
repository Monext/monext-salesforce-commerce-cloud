'use strict';

/**
 * Prepares the service for calls.
 * @param {string} path The path of the service.
 * @returns {obj} The service.
 */
function getService(path) {
    var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
    var Site = require('dw/system/Site');
    return LocalServiceRegistry.createService('monext', {
        createRequest: function(service, args) {
            service.addHeader('Authorization', Site.current.getCustomPreferenceValue('monext_ApiKey'));
            service.addHeader('Content-Type', 'application/json');
            service.setURL(Site.current.getCustomPreferenceValue('monext_environment').value + path);
            return (args) ? JSON.stringify(args) : null;
        },
        parseResponse: function(service, client) {
            return client;
        },
        getRequestLogMessage: function(request) {
            return JSON.stringify(request);
        },
        getResponseLogMessage: function(response) {
            return response.text;
        },
        filterLogMessage: function(msg) {
            return msg;
        }
    });
}

/**
 * Does getSessionDetails call.
 * @param {string} sessionID The session ID.
 * @returns {obj} The response message or error.
 */
function getSessionDetails(sessionID) {
    var Logger = require('dw/system/Logger');

    var sessionService = getService('/checkout/payments/sessions/' + sessionID);
    sessionService.setRequestMethod('GET');
    var result = sessionService.call();

    var message;
    if (result.ok) {
        try {
            message = JSON.parse(result.object.text);
        } catch (e) {
            Logger.error('Unable to parse response: {0}', result.object.text);
            return {error: true}
        }
    } else {
        try {
            message = JSON.parse(result.errorMessage);
        } catch (e) {
            Logger.error('Unable to parse errorMessage: {0}', result.errorMessage);
            return {error: true}
        }
        message.error = true;
    }

    return message;
}

/**
 * Does createSession call.
 * @param {string} orderNumber The order number.
 * @returns {obj} The response message or error.
 */
function createSession(orderNumber) {
    var sessionService = getService('/checkout/payments/sessions');
    sessionService.setRequestMethod('POST');


    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(orderNumber);

    var Logger = require('dw/system/Logger');
    if (!order) {
        Logger.error('No order found with ID: {0}', orderNumber);
        return {error: true}
    }

    var config = {
        numberOfLineItems: '*'
    };

    var Locale = require('dw/util/Locale');
    var currentLocale = Locale.getLocale(request.locale);

    var OrderModel = require('*/cartridge/models/order');
    var orderModel = new OrderModel(
        order,
        { config: config, countryCode: currentLocale.country, containerView: 'order' }
    );

    var Site = require('dw/system/Site');
    var URLUtils = require('dw/web/URLUtils');

    var productHelpers = require('*/cartridge/scripts/helpers/productHelpers');
    var payload = {
        pointOfSaleReference: Site.current.getCustomPreferenceValue('monext_pointOfSaleReference'),
        order: {
            reference: orderNumber,
            amount: order.totalGrossPrice.value * 100,
            currency: order.currencyCode,
            taxes: order.totalTax.value * 100,
            discount: (orderModel.totals.orderLevelDiscountTotal.value + orderModel.totals.shippingLevelDiscountTotal.value) * 100,
            date: new Date().toISOString(),
            origin: 'E_COM',
            country: orderModel.billing.billingAddress.address.countryCode.value,
            items: order.allProductLineItems.toArray().map(function(item)  {
                var breadcrumbs = productHelpers.getAllBreadcrumbs(null, item.productID, []).reverse();
                return {
                    reference: item.productID,
                    price: item.priceValue * 100,
                    quantity: item.quantity.value,
                    comment: '',
                    brand: item.manufacturerName,
                    category: breadcrumbs[0].htmlValue,
                    subCategory1: breadcrumbs[1].htmlValue,
                    subCategory2: breadcrumbs[2].htmlValue,
                    taxRate: item.taxRate * 100,
                    sellerType: 'PROFESSIONAL'
                }
            })
        },
        returnURL:URLUtils.abs('Monext-ReenterHPP').toString(),
        notificationURL: URLUtils.abs('Monext-Notification').toString(),
        languageCode: currentLocale.language,
        payment: {
            paymentType: 'ONE_OFF',
            capture: Site.current.getCustomPreferenceValue('monext_capture').value,
        },
        buyer: {
            legalStatus: 'PRIVATE',
            id:orderModel.orderEmail,
            firstName: orderModel.billing.billingAddress.address.firstName,
            lastName: orderModel.billing.billingAddress.address.lastName,
            mobile: orderModel.billing.billingAddress.address.phone,
            email: orderModel.orderEmail,
            billingAddress: {
                firstName: orderModel.billing.billingAddress.address.firstName,
                lastName: orderModel.billing.billingAddress.address.lastName,
                mobile: orderModel.billing.billingAddress.address.phone,
                label: orderModel.billing.billingAddress.address.title,
                street: orderModel.billing.billingAddress.address.address1,
                complement: orderModel.billing.billingAddress.address.address2,
                city: orderModel.billing.billingAddress.address.city,
                zip: orderModel.billing.billingAddress.address.postalCode,
                country: orderModel.billing.billingAddress.address.countryCode.value,
                addressCreateDate: order.billingAddress.creationDate.toISOString(),
            }
        },
        delivery: {
            charge: order.shippingTotalGrossPrice.value * 100,
            provider: order.defaultShipment.shippingMethod.ID,
            address: {
                firstName: order.defaultShipment.shippingAddress.firstName,
                lastName: order.defaultShipment.shippingAddress.lastName,
                mobile: order.defaultShipment.shippingAddress.phone,
                label: order.defaultShipment.shippingAddress.title,
                street: order.defaultShipment.shippingAddress.address1,
                complement: order.defaultShipment.shippingAddress.address2,
                city: order.defaultShipment.shippingAddress.city,
                zip: order.defaultShipment.shippingAddress.postalCode,
                country: order.defaultShipment.shippingAddress.countryCode.value,
                addressCreateDate: order.defaultShipment.shippingAddress.creationDate.toISOString(),

            }
        },
        threeDS: {
            merchantName: Site.current.ID,
        }
    }

    var result = sessionService.call(payload);

    if (!result.ok) {
        Logger.error('Error: {0} ; message: {1}', result.error, result.errorMessage);
        return {error: true}
    }

    var message;
    try {
        message = JSON.parse(result.object.text);
    } catch (e) {
        Logger.error('Unable to parse response: {0}', result.object.text);
        return {error: true}
    }

    return message;

}

/**
 * Does refund transaction call.
 * @param {string} orderNumber The order number.
 * @param {int} payload The amount.
 * @param {int} action The action.
 * @param {int} method The method.
 * @returns {obj} The response message or error.
 */
function polifunctionalTransaction(orderNumber, payload, action, method) {
    var Logger = require('dw/system/Logger');

    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(orderNumber);

    if (!order) {
        Logger.error('No order found with ID: {0}', orderNumber);
        return {error: true}
    }

    var details = getSessionDetails(order.custom.monextSessionID);
    if (details.error) {
        Logger.error('No session details found for order with ID: {0}', orderNumber);
        return {error: true}
    }

    var transaction = details.transactions[0].id;
    var sessionService = getService('/checkout/transactions/' + transaction + action);
    sessionService.setRequestMethod(method || 'POST');
    var result = sessionService.call(payload);

    if (!result.ok) {
        Logger.error('Error: {0} ; message: {1}', result.error, result.errorMessage);
        return {error: true}
    }

    var message;
    try {
        message = JSON.parse(result.object.text);
    } catch (e) {
        Logger.error('Unable to parse response: {0}', result.object.text);
        return {error: true}
    }

    return message;
}

/**
 * Does refund transaction call.
 * @param {string} orderNumber The order number.
 * @param {int} payload The amount.
 * @returns {obj} The response message or error.
 */
function refund(orderNumber, payload) {
    return polifunctionalTransaction(orderNumber, payload, '/refunds');
}

/**
 * Does cancel transaction call.
 * @param {string} orderNumber The order number.
 * @param {int} payload The amount.
 * @returns {obj} The response message or error.
 */
function cancel(orderNumber, payload) {
    return polifunctionalTransaction(orderNumber, payload, '/cancels');
}

/**
 * Does capture transaction call.
 * @param {string} orderNumber The order number.
 * @param {int} payload The amount.
 * @returns {obj} The response message or error.
 */
function capture(orderNumber, payload) {
    return polifunctionalTransaction(orderNumber, payload, '/captures');
}

/**
 * Gets transaction details.
 * @param {string} orderNumber The order number.
 * @param {int} payload The amount.
 * @returns {obj} The response message or error.
 */
function getTransactionDetails(orderNumber, payload) {
    return polifunctionalTransaction(orderNumber, payload, '', 'GET');
}

/**
 * Gets transaction details by transactigon ID
 * @param {int} ID The transaction ID.
 * @returns {obj} The response message.
 */
function getTransactionDetailsByID(ID) {
    var sessionService = getService('/checkout/transactions/' + ID);
    sessionService.setRequestMethod('GET');
    return JSON.parse(sessionService.call());
}

module.exports = {
    createSession: createSession,
    getSessionDetails: getSessionDetails,
    refund: refund,
    cancel: cancel,
    capture: capture,
    getTransactionDetails: getTransactionDetails,
    getTransactionDetailsByID: getTransactionDetailsByID
};
