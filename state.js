"use strict";
const { hash, objectHash } = require("@unicitylabs/shared/hasher/sha256hasher.js").SHA256Hasher;

class State {

    constructor(challenge, aux, data) {
	this.challenge = challenge;
	this.aux = aux?(Object.keys(aux)===0?undefined:aux):undefined;
	this.data = data;
    }

    calculateStateHash(){
	if(!this.data)
	    return this.challenge.getHexDigest();
	else
	    return hash(this.challenge.getHexDigest()+objectHash(this.data));
    }

    verify(input){
	return this.challenge.verify(input, this.calculateStateHash());
    }

}

module.exports = { State }