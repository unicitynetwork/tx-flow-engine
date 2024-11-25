"use strict";
const { calculateStateHash,  calculateGenesisStateHash, calculateTokenStatePointer,
     calculateMintPayload, getMinterProvider } = require('./helper.js');
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

async function createTx(token, provider, destPointer, salt, pritify){
    const stateHash = token.state.challenge.getHexDigest();
    const payload = calculatePayload(token.state, destPointer, salt);
    const { requestId, result } = await provider.submitStateTransition(stateHash, payload);
    const { status, path } = await provider.extractProofs(requestId);
    const input = new TxInput(path, destPointer, salt);
    const tx = new Transaction(token.tokenId, token.state, input, destPointer);
    return pritify?JSON.stringify(tx, null, 4):JSON.stringify(tx);
}

function importTx(token, tx, destination){
    token.applyTx(tx, destination);
}

function exportFlow(token, pritify){
    return pritify?JSON.stringify(token, null, 4):JSON.stringify(token);
}

async function importFlow(tokenTransitionFlow){
    const flow = JSON.parse(tokenTransitionFlow);
    const token = new Token({token_id: flow.tokenId, token_class_id: flow.tokenClass, 
	token_value: flow.tokenValue, mint_proofs: flow.mintProofs,
	mint_request: flow.mintRequest, mint_salt: flow.mintSalt, init_state: flow.genesis,
	transitions: flow.transitions});
    await token.init();
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
