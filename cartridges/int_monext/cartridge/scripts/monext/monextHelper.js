'use strict';

/**
 * Handles the order for a given session
 * @param {obj} orderID The order number.
 * @returns {obj} The response message or error.
 */
function getOrderAmounts(orderID) {
    var monextService = require('*/cartridge/scripts/monext/monextService');
    var transactionDetails = monextService.getTransactionDetails(orderID);

    var cancelled;
    var refunded;
    var captured;
    var authorized;
    var isOnlyAuthorized;

    var associatedTransactions = transactionDetails.associatedTransactions;

    if (!associatedTransactions) return {};

    associatedTransactions.forEach(function(trans, i) {
        if (i === 0) {
            if (trans.type === 'AUTHORIZATION_AND_CAPTURE' && trans.status === 'OK') {
                authorized = trans.amount;
                captured = trans.amount;
                cancelled = 0;
                refunded = 0;
                isOnlyAuthorized = false;
            } else if (trans.type === 'AUTHORIZATION' && trans.status === 'OK') {
                authorized = trans.amount;
                captured = 0;
                cancelled = 0;
                refunded = 0;
                isOnlyAuthorized = true;
            }
        } else {
            if (trans.type === 'CAPTURE' && trans.status === 'OK') {
                captured += trans.amount;
                isOnlyAuthorized = false;
            }
            if (trans.type === 'CANCEL' || trans.type === 'RESET' && trans.status === 'OK') {
                cancelled += trans.amount;
                isOnlyAuthorized = false;
            }
            if (trans.type === 'REFUND' && trans.status === 'OK') {
                refunded += trans.amount;
                isOnlyAuthorized = false;
            }
        }
    })

    return {
        cancelled: cancelled / 100,
        refunded: refunded / 100,
        captured: captured / 100,
        capturable: (authorized - captured - cancelled) / 100,
        cancellable: (authorized - captured - cancelled) / 100,
        refundable: (captured - refunded) / 100,
        isOnlyAuthorized: isOnlyAuthorized
    }
}

/**
 * Handles the order for a given session
 * @param {obj} sessionID The order number.
 * @param {obj} allowedActions The order number.
 * @returns {obj} The response message or error.
 */
function handleOrder(sessionID, allowedActions) {
    var Transaction = require('dw/system/Transaction');

    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.searchOrder('custom.monextSessionID={0}', sessionID);
    if (empty(order)) {
        return {
            error: true,
            code: 'NO_ORDER'
        }
    }

    var monextService = require('*/cartridge/scripts/monext/monextService');
    var details = monextService.getSessionDetails(sessionID);

    var monextFlowRules = require('*/cartridge/scripts/monext/monextFlowRules');

    var amounts = getOrderAmounts(order.orderNo);

    if (monextFlowRules.shouldFailOrder(details, order, amounts) && allowedActions && allowedActions.shouldTryFailOrder === 'true') {

        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        return {
            error: true,
            code: 'FAILED'
        }
    }

    if (monextFlowRules.shouldRefundPayment(details, order, amounts) && allowedActions && allowedActions.shouldTryRefundPayment === 'true') {
        monextService.refund(order.orderNo, {
            amount: amounts.refundable * 100,
        });
        Transaction.wrap(function () {
            order.setPaymentStatus(require('dw/order/Order').PAYMENT_STATUS_NOTPAID);
        });
    }

    if (monextFlowRules.shouldCapturePayment(details, order, amounts) && allowedActions && allowedActions.shouldTryCapturePayment === 'true') {
        monextService.capture(order.orderNo, {
            amount: amounts.capturable * 100,
        });
        Transaction.wrap(function () {
            order.setPaymentStatus(require('dw/order/Order').PAYMENT_STATUS_PAID);
        });
    }

    if (monextFlowRules.shouldCancelPayment(details, order, amounts) && allowedActions && allowedActions.shouldTryCancelPayment === 'true') {
        monextService.cancel(order.orderNo, {
            amount: amounts.cancellable * 100,
        });
        Transaction.wrap(function () {
            order.setPaymentStatus(require('dw/order/Order').PAYMENT_STATUS_NOTPAID);
        });

        if (amounts.isOnlyAuthorized) {
            Transaction.wrap(function () {
                order.custom.monextIsAuthorizedOnlyTransactionCancelled = true;
            });
        }
    }

    if (monextFlowRules.shouldCancelOrder(details, order, amounts) && allowedActions && allowedActions.shouldTryCancelOrder === 'true') {
        Transaction.wrap(function () {
            OrderMgr.cancelOrder(order);
        });
    }

    if (monextFlowRules.shouldPlaceOrder(details, order, amounts) && allowedActions && allowedActions.shouldTryPlaceOrder === 'true') {
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var placeOrderResult = COHelpers.placeOrder(order, {});
        if (placeOrderResult.error) {
            return {
                error: true,
                code: 'NOT_PLACED'
            }
        }

        if (order.getCustomerEmail()) {
            COHelpers.sendConfirmationEmail(order, request.locale);
        }

        if (request.session.customer.addressBook) {
            // save all used shipping addresses to address book of the logged in customer
            var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
            var allAddresses = addressHelpers.gatherShippingAddresses(order);
            allAddresses.forEach(function (address) {
                if (!addressHelpers.checkIfAddressStored(address, session.customer.addressBook.addresses)) {
                    addressHelpers.saveAddress(address, {raw: session.customer}, addressHelpers.generateAddressName(address));
                }
            });
        }
    }

    if (monextFlowRules.shouldSetOrderAsPayed(details, order, amounts) && allowedActions && allowedActions.shouldTrySetOrderAsPaid === 'true') {
        Transaction.wrap(function () {
            order.setPaymentStatus(require('dw/order/Order').PAYMENT_STATUS_PAID)
        });
    }

    return {order: order}
}

module.exports = {
    handleOrder: handleOrder,
    getOrderAmounts: getOrderAmounts
};
