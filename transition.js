"use strict";

class Transition {

    constructor(tokenId, source, input, destination){
	this.tokenId = tokenId;
	this.source = source;
	this.input = input;
	this.destination = destination;
    }

    execute(){
	const status = this.source.challenge.verify(input); // unlock
	if(status != OK)return status;
	const expectedDestPointer = calculateTokenStatePointer(this.tokenClass, 
	    destination.challenge.sign_alg, 
	    destination.challenge.hash_alg, 
	    destination.challenge.pubkey, 
	    destination.challenge.nonce);
	if(input.destPointer != expectedDestPointer)return DEST_MISMATCH;
	const expectedPayload = calculatePayload(this.source,
	    this.input.destPointer, this.input.salt);
	if(this.input.path[path.length-1].payload != expectedPayload)return PAYLOAD_MISMATCHED;
	return OK;
    }

}

module.exports = { Transition }