"use strict";
const { calculateStateHash,  calculateGenesisStateHash, calculateTokenStatePointer,
     calculateMintPayload, getMinterProvider, calculatePayload } = require('./helper.js');
const { State } = require('./state.js');
const { ChallengePubkey } = require('./pubkey_challenge.js');
const { Token } = require('./token.js');
const { Transaction } = require('./transaction.js');
const { TxInput } = require('./tx_input.js');

async function mint({
    token_id,
    token_class_id,
    token_value,
    pubkey,
    nonce,
    mint_salt,
    sign_alg,
    hash_alg,
    transport
    }){
    const stateHash = await calculateGenesisStateHash(token_id);
    const destPointer = await calculateStateHash({token_class_id, sign_alg,
	hash_alg, pubkey, nonce});
    const payload = await calculateMintPayload(token_id, token_class_id, token_value, destPointer,
	mint_salt);
    const mintProvider = getMinterProvider(transport, token_id);
    const { requestId, result } = await mintProvider.submitStateTransition(stateHash, payload);
    const { status, path } = await mintProvider.extractProofs(requestId);

    const init_state = new State(new ChallengePubkey(token_class_id, sign_alg, hash_alg, pubkey, nonce));
    const token = new Token({token_id, token_class_id, token_value, mint_proofs: { path },
	mint_request: { destPointer }, mint_salt, init_state, transitions: [] });
    await token.init();
    return token;
}

async function createTx(token, provider, destPointer, salt){
    const stateHash = await token.state.challenge.getHexDigest();
    const payload = await calculatePayload(token.state, destPointer, salt);
    const { requestId, result } = await provider.submitStateTransition(stateHash, payload);
    const { status, path } = await provider.extractProofs(requestId);
    const input = new TxInput(path, destPointer, salt);
    return new Transaction(token.tokenId, token.state, input, destPointer);
}

function importTx(token, tx, destination){
    token.applyTx(tx, destination);
}

function exportFlow(token, transaction, pretify){
    const flow = {token, transaction}
    return pretify?JSON.stringify(flow, null, 4):JSON.stringify(flow);
}

async function importFlow(tokenTransitionFlow, destination){
    const flow = JSON.parse(tokenTransitionFlow);
    const token = new Token({token_id: flow.token.tokenId, token_class_id: flow.token.tokenClass, 
	token_value: flow.token.tokenValue, mint_proofs: flow.token.mintProofs,
	mint_request: flow.token.mintRequest, mint_salt: flow.token.mintSalt, init_state: flow.token.genesis,
	transitions: flow.token.transitions});
    await token.init();
    if(flow.transaction){
	if(!destination)
	    throw new Error("Cannot import flow with transaction: destination state for the transaction is missing");
	await token.applyTx(flow.transaction, destination);
    }
    return token;
}

async function createDestination({token_class_id, sign_alg, hash_alg, pubkey, nonce}){
    return{
	destination: new State(new ChallengePubkey(token_class_id, sign_alg, 
	    hash_alg, pubkey, nonce)),
	destPointer: await calculateStateHash({
	    token_class_id, sign_alg, hash_alg, pubkey, nonce
	    })
    }
}

module.exports = {
    mint,
    createTx,
    importTx,
    exportFlow,
    importFlow,
    createDestination
}
