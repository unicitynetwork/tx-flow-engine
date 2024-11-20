"use strict";

class Transaction {

    constructor(tokenId, source, input, destPointer){
	this.tokenId = tokenId;
	if(tokenId != source.tokenId)
	    throw new Error("Malformed transaction: token ids in transaction and source state records do not match");
	this.source = source;
	this.input = input;
	this.destPointer = destPointer;
    }

}
