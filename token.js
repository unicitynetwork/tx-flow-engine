"use strict";
const { OK } = require('./aggregators_net/constants.js');
const { GENESIS_MISMATCH, DEST_MISMATCH, PAYLOAD_MISMATCH } = require('./constants.js');
const { UnicityProvider } = require('./aggregators_net/provider/UnicityProvider.js');
const { State } = require('./state.js');
const { ChallengePubkey } = require('./pubkey_challenge.js');
const { Transition } = require('./transition.js');
const { calculateGenesisRequestId, calculateStateHash, calculateMintPayload } = require('./helper.js');

class Token {

    constructor({ token_id, token_class_id, token_value, mint_proofs, mint_request,
	    mint_salt, init_state, transitions }){
	this.tokenId = token_id;
	this.tokenClass = token_class_id;
	this.tokenValue = token_value;
	this.mintProofs = mint_proofs;
	this.mintRequest = mint_request;
	this.mintSalt = mint_salt;
	const {tokenClass, sign_alg, hash_alg, pubkey, nonce} = init_state.challenge;
	this.genesis = new State(new ChallengePubkey(tokenClass, sign_alg, hash_alg, pubkey, nonce));
	this.transitions = transitions;
    }

    async init(){
	const genesisStatus = await this.validateGenesis();
	if(genesisStatus != OK)
	    throw new Error(`Error in mint: ${genesisStatus}`);
	this.state = this.genesis;
	for(let i=0; i<this.transitions.length; i++){
	    const source = new State(new 
		ChallengePubkey(this.transitions[i].source.challenge.tokenClass, this.transitions[i].source.challenge.sign_alg, 
		this.transitions[i].source.challenge.hash_alg, this.transitions[i].source.challenge.pubkey, 
		this.transitions[i].source.challenge.nonce));
	    const destination = new State(new 
		ChallengePubkey(this.transitions[i].destination.challenge.tokenClass, this.transitions[i].destination.challenge.sign_alg, 
		this.transitions[i].destination.challenge.hash_alg, this.transitions[i].destination.challenge.pubkey, 
		this.transitions[i].destination.challenge.nonce));
	    this.transitions[i] = new Transition(this.transitions[i].tokenId, source, this.transitions[i].input, 
		destination);
	    await this.updateState(this.transitions[i]);
	}
    }

    async applyTx(tx, destination){
	if(tx.tokenId != this.tokenId)
	    throw new Error("Token ID in TX does not match this token ID");
	const tx_source = new State(
	    new ChallengePubkey(
		tx.source.challenge.tokenClass, tx.source.challenge.sign_alg, tx.source.challenge.hash_alg, tx.source.challenge.pubkey,
		tx.source.challenge.nonce
	    )
	);
	const transition = new Transition(tx.tokenId, tx_source, tx.input, destination);
/*	const status = transition.execute();
	if(status != OK)
	    throw new Error(`Transition execution error: ${status}`);*/
	await this.updateState(transition);
	this.transitions.push(transition);
    }

    async updateState(transition){
//	console.log("transition.source.challenge: "+JSON.stringify(transition.source.challenge, null, 4));
//	console.log("this.state.challenge: "+JSON.stringify(this.state.challenge, null, 4));
	if((await transition.source.challenge.getHexDigest()) != (await this.state.challenge.getHexDigest()))
	    throw new Error(`Error executing transition ${transition.input.path.requestId}: source state does not match the token\s current state`);
	const status = await transition.execute();
	if(status != OK)
	    throw new Error(`Error executing transition ${transition.input.path.requestId}: ${status}`);
	this.state = transition.destination;
    }

    async validateGenesis(){
	const status = UnicityProvider.verifyInclusionProofs(this.mintProofs.path);
	if(status != OK)return status;
	const genesisRequestId = await calculateGenesisRequestId(this.tokenId);
	const l = this.mintProofs.path.length-1;
//	if(this.mintProofs.path[l].requestId != genesisRequestId)return GENESIS_MISMATCH;
	const expectedDestPointer = await calculateStateHash({token_class_id: this.tokenClass,
	    sign_alg: this.genesis.challenge.sign_alg,
	    hash_alg: this.genesis.challenge.hash_alg,
	    pubkey: this.genesis.challenge.pubkey,
	    nonce: this.genesis.challenge.nonce
	});
	if(this.mintRequest.destPointer != expectedDestPointer)return DEST_MISMATCH;
	const expectedPayload = await calculateMintPayload(this.tokenId, this.tokenClass,
	    this.tokenValue, this.mintRequest.destPointer, this.mintSalt);
	if(this.mintProofs.path[l].payload != expectedPayload)return PAYLOAD_MISMATCH;
	return OK;
    }

}

module.exports = { Token }
