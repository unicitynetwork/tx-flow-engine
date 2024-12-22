"use strict";
const { hasher } = require("./aggregators_net/hasher/sha256hasher.js").SHA256Hasher;

class State {

    constructor(challenge, aux, data) {
	this.challenge = challenge;
	this.aux = aux;
	this.data = data;
    }

    calculateStateHash(){
	if(!this.data)
	    return this.challenge.getHexDigest();
	else
	    return hash(this.challenge.getHexDigest()+hash(JSON.stringify(this.data)));
    }

}

module.exports = { State }