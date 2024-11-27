"use strict";
const { UnicityProvider } = require('./aggregators_net/provider/UnicityProvider.js');
const { calculateStateHash } = require("./helper.js");
const { OK } = require('./aggregators_net/constants.js');
const { INP_MISMATCH } = require('./constants.js');

class ChallengePubkey {

    constructor(tokenClass, sign_alg, hash_alg, pubkey, nonce) {
	this.tokenClass = tokenClass;
	this.sign_alg = sign_alg;
	this.hash_alg = hash_alg;
	this.pubkey = pubkey;
	this.nonce = nonce;
    }

    async verify(input){
	const status = UnicityProvider.verifyInclusionProofs(input.path);
	if(status != OK)return status;
	const l = input.path.length-1;
	if((input.path[l].authenticator.pubkey != this.pubkey)||
	    (input.path[l].authenticator.state != (await this.getHexDigest())))return INP_MISMATCH;
	return OK;
    }

    getHexDigest(){
	return calculateStateHash({token_class_id: this.tokenClass, sign_alg: this.sign_alg, 
	    hash_alg: this.hash_alg, pubkey: this.pubkey, nonce: this.nonce});
    }

}

module.exports = { ChallengePubkey }