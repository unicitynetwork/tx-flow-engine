"use strict"
const { getPubKey } = require('./helper.js');

class TokenPool {

    constructor(){
	this.tokens = {};
	this.pointers = {};
    }

    addPointer(pointer, nonce){
	return this.pointers[pointer] = nonce;
    }

    getNonce(pointer){
	return this.pointers[pointer];
    }

    addToken(secret, txfJson){
	const pubkey = getPubKey(secret);
	if(!this.tokens[pubkey])this.tokens[pubkey] = {};
	const txf = JSON.parse(txfJson);
	return this.tokens[pubkey][txf.token.tokenId] = txfJson;
    }

    deleteToken(secret, tokenId){
	const pubkey = getPubKey(secret);
	delete this.tokens[pubkey][tokenId];
    }

    getToken(secret, tokenId){
	const pubkey = getPubKey(secret);
	return this.tokens[pubkey][tokenId];
    }

    getTokens(secret){
	const pubkey = getPubKey(secret);
	return this.tokens[pubkey];
    }

}

module.exports = { TokenPool }
