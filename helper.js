const MINT_SUFFIX_HEX = crypto.createHash('sha256').update('TOKENID').digest('hex');
const MINTER_SECRET = 'I_AM_UNIVERSAL_MINTER_FOR_';

function calculateGenesisStateHash(tokenId){
    const hasher = new SHA256Hasher();
    return hasher.hash(tokenId+MINT_SUFFIX_HASH);
}

async function calculateGenesisRequestId(tokenId){
    const hasher = new SHA256Hasher();
    const minterSigner = getMinterSigner(tokenId);
    const minterPubkey = await minterSigner.getPubKey();
    const genesisState = calculateGenesisStateHash(tokenId);
    return await UnicityProvider.calculateRequestId(minterPubkey, genesisState, hasher);
}

function calculateMintPayload(tokenId, tokenClass, tokenValue, destPointer, salt){
    const hasher = new SHA256Hasher();
    const value = `${BigNumber.from(tokenValue).toHexString().slice(2).padStart(64, "0")}`;
    return hasher.hash(tokenId+tokenClass+value+destPointer+salt);
}

function getMinterSigner(tokenId){
    return new SignerEC(crypto.createHash('sha256').update(MINTER_SECRET+tokenId).digest('hex'));
}

function getMinterProvider(transport, tokenId){
    const hasher = new SHA256Hasher();
    const signer = getMinterSigner(tokenId);
    return new UnicityProvider(transport, signer, hasher);
}
