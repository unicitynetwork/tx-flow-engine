"use strict";

class State {

    constructor(challenge, aux) {
	this.challenge = challenge;
	this.aux = aux;
    }

    calculateStateHash(){
	return this.challenge.getHexDigest();
    }

}

module.exports = { State }