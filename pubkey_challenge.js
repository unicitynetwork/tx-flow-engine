"use strict";
const { UnicityProvider, verifyInclusionProofs, calculateRequestId } = require('@unicitylabs/shared/provider/UnicityProvider.js');
const { calculateStateHash } = require("@unicitylabs/shared");
const { hash } = require("@unicitylabs/shared/hasher/sha256hasher.js").SHA256Hasher;
const { OK, INP_MISMATCH } = require('@unicitylabs/shared');

class ChallengePubkey {

    constructor(tokenClass, tokenId, sign_alg, hash_alg, pubkey, nonce) {
	this.tokenClass = tokenClass;
	this.tokenId = tokenId;
	this.sign_alg = sign_alg;
	this.hash_alg = hash_alg;
	this.pubkey = pubkey;
	this.nonce = nonce;
    }

    verify(input, stateHash){
	const requestId = calculateRequestId(hash, this.pubkey, stateHash);
	const status = verifyInclusionProofs(input.path, requestId);
	if(status != OK)return status;
	const l = input.path.length-1;
	if((input.path[l].authenticator.pubkey != this.pubkey)||
	    (input.path[l].authenticator.state != stateHash))return INP_MISMATCH;
	return OK;
    }

    getHexDigest(){
	return calculateStateHash({token_class_id: this.tokenClass, token_id: this.tokenId, sign_alg: this.sign_alg, 
	    hash_alg: this.hash_alg, pubkey: this.pubkey, nonce: this.nonce});
    }

}

module.exports = { ChallengePubkey }