"use strict";
const { objectHash } = require('@unicitylabs/shared/hasher/sha256hasher.js').SHA256Hasher;
const { calculateStateHash, calculateExpectedPointer, calculateExpectedPointerFromPubAddr, 
    calculatePayload, resolveReference, destRefFromNametag } = require('@unicitylabs/shared');
const { OK, DEST_MISMATCH, DATA_MISMATCH, PAYLOAD_MISMATCHED } = require('@unicitylabs/shared');

class Transition {

    constructor(tokenId, source, input, destination){
	this.tokenId = tokenId;
	this.source = source;
	this.input = input;
	this.destination = destination;
    }

    execute(nametagVerifier){
	const status = this.source.verify(this.input); // unlock
	if(status != OK)return status;
	const dataStatus = this.validateData();
	if(dataStatus != OK)return dataStatus;
	const { nametag } = resolveReference(this.input.dest_ref);
	const dest_ref = nametag?destRefFromNametag(nametag,
	    Object.fromEntries(Object.entries(this.destination.aux.nametags).map(([key, value]) => [key, nametagVerifier(value)]))
    	    ):this.input.dest_ref;
	const { pointer, pubkey } = resolveReference(dest_ref);
	if(pubkey)
	    if(pubkey !== this.destination.challenge.pubkey)
		return DEST_MISMATCH;
	const expectedDestPointer = calculateExpectedPointer({token_class_id: this.destination.challenge.tokenClass, 
	    sign_alg: this.destination.challenge.sign_alg, 
	    hash_alg: this.destination.challenge.hash_alg, 
	    pubkey: this.destination.challenge.pubkey, 
	    nonce: this.destination.challenge.nonce});
	const destPointer = pubkey?calculateExpectedPointerFromPubAddr({
	    token_class_id: this.destination.challenge.tokenClass, 
	    sign_alg: this.destination.challenge.sign_alg, 
	    hash_alg: this.destination.challenge.hash_alg, 
	    pubkey: this.destination.challenge.pubkey, 
	    salt: this.input.salt, 
	    signature: this.destination.aux.salt_sig, 
	    nonce: this.destination.challenge.nonce, 
	    sourceState: this.source.calculateStateHash()
	}):pointer;
	if(destPointer != expectedDestPointer)return DEST_MISMATCH;
	const expectedPayload = calculatePayload(this.source,
	    this.input.dest_ref, this.input.salt, this.input.dataHash, this.input.msg?objectHash(this.input.msg):undefined);
	if(this.input.path[this.input.path.length-1].payload != expectedPayload)return PAYLOAD_MISMATCHED;
	return OK;
    }

    validateData(){
	if(!this.destination.data)
	    if(!this.input.dataHash)
		return OK;
	    else
		return DATA_MISMATCH;
	if(this.input.dataHash != objectHash(this.destination.data))return DATA_MISMATCH;
	return OK;
    }

}

module.exports = { Transition }
