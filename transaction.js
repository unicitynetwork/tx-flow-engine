"use strict";

class Transaction {

    constructor(tokenId, source, input, dest_ref){
	this.tokenId = tokenId;
	this.source = source;
	this.input = input;
	this.dest_ref = dest_ref;
    }

}

module.exports = { Transaction }
