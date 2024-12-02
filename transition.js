"use strict";
const { calculateStateHash, calculateExpectedPointer, calculatePayload } = require('./helper.js');
const { OK } = require('./aggregators_net/constants.js');
const { DEST_MISMATCH, PAYLOAD_MISMATCHED } = require('./constants.js');

class Transition {

    constructor(tokenId, source, input, destination){
	this.tokenId = tokenId;
	this.source = source;
	this.input = input;
	this.destination = destination;
    }

    async execute(){
	const status = await this.source.challenge.verify(this.input); // unlock
	if(status != OK)return status;
	const expectedDestPointer = await calculateExpectedPointer({token_class_id: this.destination.challenge.tokenClass, 
	    sign_alg: this.destination.challenge.sign_alg, 
	    hash_alg: this.destination.challenge.hash_alg, 
	    pubkey: this.destination.challenge.pubkey, 
	    nonce: this.destination.challenge.nonce});
	if(this.input.destPointer != expectedDestPointer)return DEST_MISMATCH;
	const expectedPayload = await calculatePayload(this.source,
	    this.input.destPointer, this.input.salt);
	if(this.input.path[this.input.path.length-1].payload != expectedPayload)return PAYLOAD_MISMATCHED;
	return OK;
    }

}

module.exports = { Transition }