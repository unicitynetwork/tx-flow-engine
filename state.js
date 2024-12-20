"use strict";
const { hasher } = require("./aggregators_net/hasher/sha256hasher.js").SHA256Hasher;

class State {

    constructor(challenge, aux, meta) {
	this.challenge = challenge;
	this.aux = aux;
	this.meta = meta;
    }

    calculateStateHash(){
	if(!this.meta)
	    return this.challenge.getHexDigest();
	else
	    return hash(this.challenge.getHexDigest()+hash(JSON.stringify(this.meta)));
    }

}

module.exports = { State }