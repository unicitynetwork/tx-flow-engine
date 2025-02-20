"use strict";
const { objectHash } = require('@unicitylabs/shared/hasher/sha256hasher.js').SHA256Hasher;
const { OK, GENESIS_MISMATCH, DEST_MISMATCH, PAYLOAD_MISMATCH } = require('@unicitylabs/shared');
const { UnicityProvider, verifyInclusionProofs } = require('@unicitylabs/shared/provider/UnicityProvider.js');
const { State } = require('./state.js');
const { ChallengePubkey } = require('./pubkey_challenge.js');
const { Transition } = require('./transition.js');
const { calculateGenesisRequestId, calculateStateHash, calculateMintPayload, calculateExpectedPointer, resolveReference } = require('@unicitylabs/shared');

class Token {

    constructor({ token_id, token_class_id, token_value, immutable_data, data, sign_alg, hash_alg, mint_proofs, mint_request,
	    mint_salt, pubkey, nonce, transitions, nametagVerifier }){
	this.tokenId = token_id;
	this.tokenClass = token_class_id;
	this.tokenValue = token_value;
	this.tokenData = immutable_data;
	this.mintProofs = mint_proofs;
	this.mintRequest = mint_request;
	this.mintSalt = mint_salt;
	this.genesis = new State(new ChallengePubkey(this.tokenClass, this.tokenId, sign_alg, hash_alg, pubkey, nonce), 
	    undefined, data);
	this.transitions = transitions;
	this.nametagVerifier = nametagVerifier;
    }

    init(){
	const genesisStatus = this.validateGenesis();
	if(genesisStatus != OK)
	    throw new Error(`Error in mint: ${genesisStatus}`);
	this.state = this.genesis;
	for(let i=0; i<this.transitions.length; i++){
	    const source = new State(new 
		ChallengePubkey(this.transitions[i].source.challenge.tokenClass, this.transitions[i].source.challenge.tokenId,
		this.transitions[i].source.challenge.sign_alg, 
		this.transitions[i].source.challenge.hash_alg, this.transitions[i].source.challenge.pubkey, 
		this.transitions[i].source.challenge.nonce), this.transitions[i].source.aux, this.transitions[i].source.data);
	    const destination = new State(new 
		ChallengePubkey(this.transitions[i].destination.challenge.tokenClass, this.transitions[i].destination.challenge.tokenId,
		this.transitions[i].destination.challenge.sign_alg, 
		this.transitions[i].destination.challenge.hash_alg, this.transitions[i].destination.challenge.pubkey, 
		this.transitions[i].destination.challenge.nonce), this.transitions[i].destination.aux, 
		this.transitions[i].destination.data);
	    this.transitions[i] = new Transition(this.transitions[i].tokenId, source, this.transitions[i].input, 
		destination);
	    this.updateState(this.transitions[i]);
	}
    }

    applyTx(tx, destination){
	if(tx.tokenId != this.tokenId)
	    throw new Error("Token ID in TX does not match this token ID");
	const tx_source = new State(
	    new ChallengePubkey(
		tx.source.challenge.tokenClass, tx.source.challenge.tokenId, tx.source.challenge.sign_alg, 
		tx.source.challenge.hash_alg, tx.source.challenge.pubkey, tx.source.challenge.nonce
	    ),
	    tx.source.aux,
	    tx.source.data
	);
	const transition = new Transition(tx.tokenId, tx_source, tx.input, destination);
	this.updateState(transition);
	this.transitions.push(transition);
    }

    updateState(transition){
	if(transition.source.calculateStateHash() != this.state.calculateStateHash())
	    throw new Error(`Error executing transition ${transition.input.path.requestId}: source state does not match the token\s current state`);
	const status = transition.execute(this.nametagVerifier);
	if(status != OK)
	    throw new Error(`Error executing transition ${transition.input.path.requestId}: ${status}`);
	this.state = transition.destination;
    }

    validateGenesis(){
	const genesisRequestId = calculateGenesisRequestId(this.tokenId);
	const status = verifyInclusionProofs(this.mintProofs.path, genesisRequestId);
	if(status != OK)return status;
	const l = this.mintProofs.path.length-1;
	const expectedDestPointer = calculateExpectedPointer({token_class_id: this.tokenClass,
	    sign_alg: this.genesis.challenge.sign_alg,
	    hash_alg: this.genesis.challenge.hash_alg,
	    pubkey: this.genesis.challenge.pubkey,
	    nonce: this.genesis.challenge.nonce
	});
	const destPointer = resolveReference(this.mintRequest.dest_ref).pointer;
	if(destPointer != expectedDestPointer)return DEST_MISMATCH;
	const expectedPayload = calculateMintPayload(this.tokenId, this.tokenClass,
	    this.tokenValue, this.tokenData, this.genesis.data?objectHash(this.genesis.data):'', this.mintRequest.dest_ref, this.mintSalt);
	if(this.mintProofs.path[l].payload != expectedPayload)return PAYLOAD_MISMATCH;
	return OK;
    }

    getStats(){
	return { id: this.tokenId, classId: this.tokenClass, value: this.tokenValue, data: this.state.data }
    }

}

module.exports = { Token }
