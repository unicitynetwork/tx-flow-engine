"use strict";

class Transaction {

    constructor(tokenId, source, input, destPointer){
	this.tokenId = tokenId;
	this.source = source;
	this.input = input;
	this.destPointer = destPointer;
    }

}

module.exports = { Transaction }