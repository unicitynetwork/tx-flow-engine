
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
    
    const token = new Token({token_id, token_class_id, token_value, mint_proofs: { path },
	mint_request: { destPointer }, mint_salt, transitions: [] });
    return token;
}
