"use strict";
const { DEFAULT_LOCAL_GATEWAY, DEFAULT_TEST_GATEWAY } = require('./constants.js');
const { calculateStateHash, calculatePointer, calculateExpectedPointer, calculateGenesisStateHash, 
     calculateMintPayload, resolveReference, getMinterProvider, calculatePayload, calculatePubPointer, calculatePubAddr, calculatePubkey, 
    getTxSigner, isUnspent, confirmOwnership, validateOrConvert, generateRandom256BitHex } = require('./helper.js');
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
    const destPointerAddr = calculatePubPointer(await calculateExpectedPointer({token_class_id, sign_alg,
	hash_alg, pubkey, nonce}));
    const payload = await calculateMintPayload(token_id, token_class_id, token_value, destPointerAddr,
	mint_salt);
    const mintProvider = getMinterProvider(transport, token_id);
    const { requestId, result } = await mintProvider.submitStateTransition(stateHash, payload);
    const { status, path } = await mintProvider.extractProofs(requestId);

    const init_state = new State(new ChallengePubkey(token_class_id, token_id, sign_alg, hash_alg, pubkey, nonce));
    const token = new Token({token_id, token_class_id, token_value, mint_proofs: { path },
	mint_request: { dest_ref: destPointerAddr }, mint_salt, init_state, transitions: [] });
    await token.init();
    return token;
}

function generateRecipientPointerAddr(token_class_id, sign_alg, hash_alg, secret, nonce){
    return calculatePubPointer(calculatePointer({token_class_id, sign_alg, hash_alg, secret, nonce}));
}

function generateRecipientPubkeyrAddr(secret){
    return calculatePubAddr(calculatePubkey(secret));
}

async function createTx(token, dest_ref, salt, secret, transport){
    const stateHash = await token.state.calculateStateHash();
    const payload = await calculatePayload(token.state, dest_ref, salt);
    const signer = getTxSigner(secret, token.state.aux?undefined:token.state.challenge.nonce);
    const provider = new UnicityProvider(transport, signer);
    const { requestId, result } = await provider.submitStateTransition(stateHash, payload);
    const { status, path } = await provider.extractProofs(requestId);
    const input = new TxInput(path, dest_ref, salt);
    return new Transaction(token.tokenId, token.state, input, dest_ref);
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
	const { pubkey } = resolveReference(flow.transaction.input.dest_ref);
	if(!nonce && !pubkey)
	    throw new Error("Cannot import flow with transaction: nonce of the state for the transaction is missing");
	const signer = getTxSigner(secret, nonce);
	const sigPubkey = signer.getPubKey();
	if(pubkey)
	    if(pubkey !== sigPubkey)
		throw new Error("Pubkeys do not match");
	const salt_sig = pubkey?signer.sign(flow.transaction.input.salt):undefined;
	const source = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', flow.transaction.source.challenge.pubkey, flow.transaction.source.challenge.nonce), flow.transaction.source.aux);
	const destination = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', sigPubkey, salt_sig?hash(source.calculateStateHash()+salt_sig):nonce), salt_sig?{salt_sig}:undefined);
	await token.applyTx(flow.transaction, destination);
    }
    return token;
}

async function getTokenStatus(token, secret, transport){
    const stateHash = await token.state.calculateStateHash();
    const signer = getTxSigner(secret, token.state.challenge.nonce);
    const provider = new UnicityProvider(transport, signer);
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
    return DEFAULT_TEST_GATEWAY;
}

module.exports = {
    mint,
    generateRecipientPointerAddr,
    generateRecipientPubkeyrAddr,
    createTx,
    importTx,
    exportFlow,
    importFlow,
    getTokenStatus,
    collectTokens,
    getHTTPTransport,
    validateOrConvert, 
    generateRandom256BitHex,
    defaultGateway,
    calculatePointer
}
