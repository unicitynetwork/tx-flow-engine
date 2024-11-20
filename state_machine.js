"use strict";

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
    const stateHash = calculateGenesisStateHash(token_id);
    const destPointer = calculateTokenStatePointer(token_class_id, sign_alg,
	hash_alg, pubkey, nonce);
    const payload = calculateMintPayload(token_id, token_class_id, token_value, destPointer,
	salte);
    const mintProvider = getMintProvider(transport, token_id);
    const { requestId, result } = await mintProvider.submitStateTransition(stateHash, payload);
    const { status, path } = await mintProvider.extractProofs(requestId);

    const init_state = new State(new ChallengePubkey(token_id, sign_alg, hash_alg, pubkey, nonce));
    const token = new Token({token_id, token_class_id, token_value, mint_proofs: { path },
	mint_request: { destPointer }, mint_salt, init_state, transitions: [] });
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

function importFlow(tokenTransitionFlow){
    const flow = JSON.parse(tokenTransitionFlow);
    return new Token({token_id: flow.tokenId, token_class_id: flow.tokenClass, 
	token_value: flow.tokenValue, mint_proofs: flow.mintProofs,
	mint_request: flow.mintRequest, mint_salt: flow.mintSalt, init_state: flow.genesis,
	transitions: flow.transitions});
}

function createDestination(token_class_id, sign_alg, hash_alg, pubkey, nonce){
    return{
	destination: new State(new ChallengePubkey(token_class_id, sign_alg, 
	    hash_alg, pubkey, nonce)),
	destPointer: calculateTokenStatePointer(
	    token_class_id, sign_alg, hash_alg, pubkey, nonce
	    )
    }
}
