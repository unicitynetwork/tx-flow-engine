"use strict";
const { calculateStateHash, calculatePointer, calculateExpectedPointer, calculateGenesisStateHash, 
     calculateMintPayload, getMinterProvider, calculatePayload, getTxSigner } = require('./helper.js');
const { State } = require('./state.js');
const { ChallengePubkey } = require('./pubkey_challenge.js');
const { Token } = require('./token.js');
const { Transaction } = require('./transaction.js');
const { TxInput } = require('./tx_input.js');
const { SHA256Hasher } = require('./aggregators_net/hasher/sha256hasher.js');
const { UnicityProvider } = require('./aggregators_net/provider/UnicityProvider.js');

async function mint({
    token_id,
    token_class_id,
    token_value,
    secret,
    nonce,
    mint_salt,
    sign_alg,
    hash_alg,
    transport
    }){
    const signer = getTxSigner(secret, nonce);
    const pubkey = signer.getPubKey();
    const stateHash = await calculateGenesisStateHash(token_id);
    const destPointer = await calculateExpectedPointer({token_class_id, sign_alg,
	hash_alg, pubkey, nonce});
    const payload = await calculateMintPayload(token_id, token_class_id, token_value, destPointer,
	mint_salt);
    const mintProvider = getMinterProvider(transport, token_id);
    const { requestId, result } = await mintProvider.submitStateTransition(stateHash, payload);
    const { status, path } = await mintProvider.extractProofs(requestId);

    const init_state = new State(new ChallengePubkey(token_class_id, token_id, sign_alg, hash_alg, pubkey, nonce));
    const token = new Token({token_id, token_class_id, token_value, mint_proofs: { path },
	mint_request: { destPointer }, mint_salt, init_state, transitions: [] });
    await token.init();
    return token;
}

async function createTx(token, destPointer, salt, secret, transport){
    const stateHash = await token.state.calculateStateHash();
    const payload = await calculatePayload(token.state, destPointer, salt);
    const signer = getTxSigner(secret, token.state.challenge.nonce);
    const hasher = new SHA256Hasher();
    const provider = new UnicityProvider(transport, signer, hasher);
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

async function importFlow(tokenTransitionFlow, secret, nonce){
    const flow = JSON.parse(tokenTransitionFlow);
    const token = new Token({token_id: flow.token.tokenId, token_class_id: flow.token.tokenClass, 
	token_value: flow.token.tokenValue, mint_proofs: flow.token.mintProofs,
	mint_request: flow.token.mintRequest, mint_salt: flow.token.mintSalt, init_state: flow.token.genesis,
	transitions: flow.token.transitions});
    await token.init();
    if(flow.transaction){
	if(!nonce)
	    throw new Error("Cannot import flow with transaction: nonce of the state for the transaction is missing");
	const signer = getTxSigner(secret, nonce);
	const pubkey = signer.getPubKey();
	const destination = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', pubkey, nonce));
	await token.applyTx(flow.transaction, destination);
    }
    return token;
}

/*async function createDestination({token_class_id, token_id, sign_alg, hash_alg, pubkey, nonce}){
    return{
	destination: new State(new ChallengePubkey(token_class_id, token_id, sign_alg, 
	    hash_alg, pubkey, nonce)),
	destPointer: await calculatePointer({
	    token_class_id, sign_alg, hash_alg, pubkey, nonce
	    })
    }
}*/

module.exports = {
    mint,
    createTx,
    importTx,
    exportFlow,
    importFlow
}
