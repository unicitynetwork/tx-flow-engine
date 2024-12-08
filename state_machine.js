"use strict";
const { DEFAULT_LOCAL_GATEWAY } = require('./constants.js');
const { calculateStateHash, calculatePointer, calculateExpectedPointer, calculateGenesisStateHash, 
     calculateMintPayload, getMinterProvider, calculatePayload, getTxSigner, isUnspent, confirmOwnership,
    validateOrConvert, generateRandom256BitHex } = require('./helper.js');
const { State } = require('./state.js');
const { ChallengePubkey } = require('./pubkey_challenge.js');
const { Token } = require('./token.js');
const { Transaction } = require('./transaction.js');
const { TxInput } = require('./tx_input.js');
const { hash } = require('./aggregators_net/hasher/sha256hasher.js').SHA256Hasher;
const { UnicityProvider } = require('./aggregators_net/provider/UnicityProvider.js');
const { JSONRPCTransport } = require('./aggregators_net/client/http_client.js');

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

function generateRecipientPointer(token_class_id, sign_alg, hash_alg, secret, nonce){
    return calculatePointer({token_class_id, sign_alg, hash_alg, secret, nonce});
}

async function createTx(token, destPointer, salt, secret, transport){
    const stateHash = await token.state.calculateStateHash();
    const payload = await calculatePayload(token.state, destPointer, salt);
    const signer = getTxSigner(secret, token.state.challenge.nonce);
    const provider = new UnicityProvider(transport, signer);
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
    if(flow.transaction && secret){
	if(!nonce)
	    throw new Error("Cannot import flow with transaction: nonce of the state for the transaction is missing");
	const signer = getTxSigner(secret, nonce);
	const pubkey = signer.getPubKey();
	const destination = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', pubkey, nonce));
	await token.applyTx(flow.transaction, destination);
    }
    return token;
}

async function getTokenStatus(token, secret, transport){
    const stateHash = await token.state.calculateStateHash();
    const signer = getTxSigner(secret, token.state.challenge.nonce);
    const provider = new UnicityProvider(transport, signer, hasher);
    const isLatestState = await isUnspent(provider, stateHash);
    const isOwner = await confirmOwnership(token, signer);
    const { id, classId, value } = token.getStats();
    return { id, classId, value, unspent: isLatestState, owned: isOwner }
}

async function collectTokens(tokens, tokenClass, targetValue, secret, transport){
    let filteredTokens = [];
    let filteredTokenStats = [];
    let totalValue = BigInt(0);
    for(const name in tokens){
	const status = await getTokenStatus(tokens[name], secret, transport);
	const { id, classId, value, unspent, owned } = status;
	if((classId == tokenClass) && unspent && owned){
	    filteredTokens[name] = tokens[name];
	    filteredTokenStats[name] = status;
	    totalValue+=BigInt(value);
	    if(targetValue!=0)
		if(targetValue<=totalValue)break;
	}
    }
    return { totalValue, tokens: filteredTokens, stats: filteredTokenStats }
}

function getHTTPTransport(url){
    return new JSONRPCTransport(url);
}

function defaultGateway(){
    return DEFAULT_LOCAL_GATEWAY;
}

module.exports = {
    mint,
    generateRecipientPointer,
    createTx,
    importTx,
    exportFlow,
    importFlow,
    collectTokens,
    getHTTPTransport,
    validateOrConvert, 
    generateRandom256BitHex,
    defaultGateway
}
