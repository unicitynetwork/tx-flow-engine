
class ChallengePubkey {

    constructor(sign_alg, hash_alg, pubkey) {
	this.sign_alg = sign_alg;
	this.hash_alg = hash_alg;
	this.pubkey = pubkey;
    }

    verify(nonce, input, destination){
	
	const status = UnicityProvider.verifyInclusionProofs(input.path);
	if(status != OK)return status;
	
    }

}