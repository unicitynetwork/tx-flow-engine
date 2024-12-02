"use strict";

class State {

    constructor(challenge) {
	this.challenge = challenge;
    }

    calculateStateHash(){
	return this.challenge.getHexDigest();
    }

}

module.exports = { State }