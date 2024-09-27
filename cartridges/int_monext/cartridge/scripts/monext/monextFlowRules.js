'use strict';

// Intended to be overriddalbe or modfible file

/**
 * Determines if order should be failed
 * @param {obj} details The session details.
 * @param {obj} order The order.
 * @param {obj} amounts The amounts.
 * @returns {bool} The response.
 */
function shouldFailOrder(details, order, amounts) {
    // TODO: Add case specific rules here
    return details.error || details.result.title === 'ERROR' || details.result.title === 'CANCELLED' || details.result.title === 'REFUSED';
}

/**
 * Determines if order should be failed
 * @param {obj} details The session details.
 * @param {obj} order The order.
 * @param {obj} amounts The amounts.
 * @returns {bool} The response.
 */
function shouldPlaceOrder(details, order, amounts) {
    // TODO: Add case specific rules here
    return details.result.title === 'ACCEPTED';
}

/**
 * Determines if payment should be fully refunded
* @param {obj} details The session details.
 * @param {obj} order The order.
 * @param {obj} amounts The amounts.
 * @returns {bool} The response.
 */
function shouldRefundPayment(details, order, amounts) {
    // TODO: Add case specific rules here
    return amounts.refundable && amounts.refundable > 0;
}

/**
 * Determines if payment should be fully captured
 * @param {obj} details The session details.
 * @param {obj} order The order.
 * @param {obj} amounts The amounts.
 * @returns {bool} The response.
 */
function shouldCapturePayment(details, order, amounts) {
    // TODO: Add case specific rules here
    return amounts.capturable && amounts.capturable > 0;
}

/**
 * Determines if payment should be fully cancelled
 * @param {obj} details The session details.
 * @param {obj} order The order.
 * @param {obj} amounts The amounts.
 * @returns {bool} The response.
 */
function shouldCancelPayment(details, order, amounts) {
    // TODO: Add case specific rules here
    return amounts.cancellable && amounts.cancellable > 0;
}

/**
 * Determines if order should be cancelled
 * @param {obj} details The session details.
 * @param {obj} order The order.
 * @param {obj} amounts The amounts.
 * @returns {bool} The response.
 */
function shouldCancelOrder(details, order, amounts) {
    // TODO: Add case specific rules here
    return true;
}

/**
 * Determines if order should be set as paid
 * @param {obj} details The session details.
 * @param {obj} order The order.
 * @param {obj} amounts The amounts.
 * @returns {bool} The response.
 */
function shouldSetOrderAsPayed(details, order, amounts) {
    var Order = require('dw/order/Order');
    // TODO: Add case specific rules here
    var isTotalAmountCaptured = (order.status ===Order.ORDER_STATUS_NEW || order.status ===Order.ORDER_STATUS_OPEN) && amounts.capturable && amounts.capturable === 0;
    var isAutoCaptureandSuccess = details.result.title === 'ACCEPTED' && details.transactions[0].type === 'AUTHORIZATION_AND_CAPTURE';
    return isTotalAmountCaptured || isAutoCaptureandSuccess;
}

module.exports = {
    shouldFailOrder: shouldFailOrder,
    shouldPlaceOrder: shouldPlaceOrder,
    shouldRefundPayment: shouldRefundPayment,
    shouldCapturePayment: shouldCapturePayment,
    shouldCancelPayment: shouldCancelPayment,
    shouldCancelOrder: shouldCancelOrder,
    shouldSetOrderAsPayed: shouldSetOrderAsPayed
};
