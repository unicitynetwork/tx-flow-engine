"use strict"
const { getPubKey } = require('./helper.js');

class TokenPool {

    constructor(){
	this.tokens = {};
	this.pointers = {};
    }

    addPointer(pointer, nonce){
	return this.pointers['_'+pointer] = nonce;
    }

    getNonce(pointer){
	return this.pointers['_'+pointer];
    }

    addToken(pubkey, txfJson){
//	const pubkey = getPubKey(secret);
	if(!this.tokens['_'+pubkey])this.tokens['_'+pubkey] = {};
	const txf = JSON.parse(txfJson);
	return this.tokens['_'+pubkey]['_'+txf.token.tokenId] = txfJson;
    }

    deleteToken(secret, tokenId){
	const pubkey = getPubKey(secret);
	delete this.tokens['_'+pubkey]['_'+tokenId];
    }

    getToken(secret, tokenId){
	const pubkey = getPubKey(secret);
	return this.tokens['_'+pubkey]['_'+tokenId];
    }

    getTokens(secret){
	const pubkey = getPubKey(secret);
	return this.tokens['_'+pubkey];
    }

}

module.exports = { TokenPool }
