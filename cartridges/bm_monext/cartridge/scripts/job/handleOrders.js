/* eslint-disable require-jsdoc */

'use strict';

var orders;
var actions;

function beforeStep(parameters) {
    var OrderMgr = require('dw/order/OrderMgr');
    orders = OrderMgr.searchOrders(parameters.orderQuery, 'creationDate desc');
    actions = JSON.parse(parameters.actions);
}

function getTotalCount() {
    return orders.count;
}

function read() {
    if(orders.hasNext()) { return orders.next(); }
    return null;
}

function process(order) {
    var monextHelper = require('*/cartridge/scripts/monext/monextHelper');
    monextHelper.handleOrder(order.custom.monextSessionID, actions);
}

function write(lines, parameters, stepExecution) {};

module.exports = {
    beforeStep: beforeStep,
    getTotalCount: getTotalCount,
    read: read,
    process: process,
    write: write
};

