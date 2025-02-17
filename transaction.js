"use strict";

class Transaction {

    constructor(tokenId, source, input, dest_ref, msg){
	this.tokenId = tokenId;
	this.source = source;
	this.input = input;
	this.dest_ref = dest_ref;
	this.msg = msg;
    }

}

module.exports = { Transaction }
