import { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';

import { AggregatorClient } from './api/AggregatorClient.js';
import { UnicityProvider } from './api/UnicityProvider.js';
import { PublicKeyPredicate } from './predicate/PublicKeyPredicate.js';
import { Token } from './token/Token.js';
import { TokenId } from './token/TokenId.js';
import { TokenState } from './token/TokenState.js';
import { MintTransition } from './transition/MintTransition.js';
import { TokenType } from './token/TokenType.js';
import { Pointer } from './address/Pointer.js';

// const MINT_SUFFIX = await new DataHasher(HashAlgorithm.SHA256).update(new TextEncoder().encode('TOKENID')).digest();
const MINT_SUFFIX = HexConverter.decode('AAAAAA');

export class StateTransitionClient {
  public constructor() {}

  public async mint(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array,
    stateData: Uint8Array,
    secret: Uint8Array,
    nonce: Uint8Array,
    salt: Uint8Array,
  ): Promise<Token> {
    const signingService = await SigningService.createFromSecret(secret, nonce);
    const recipient = await Pointer.create(tokenType, secret, nonce);
    const provider = new UnicityProvider(signingService, new AggregatorClient('https://gateway-test1.unicity.network:443'));
    const requestId = await RequestId.create(tokenId.encode(), MINT_SUFFIX);
    const transition = await MintTransition.create(tokenId, tokenType, tokenData, recipient, salt, stateData);

    const response = await provider.submitStateTransition(requestId, transition);
    const inclusionProof = await provider.getInclusionProof(response.requestId);

    const status = await inclusionProof.verify(requestId.toBigInt());
    if (status != InclusionProofVerificationStatus.OK) {
      throw new Error('Inclusion proof verification failed.');
    }

    const state = await TokenState.create(
      await PublicKeyPredicate.create(tokenId, tokenType, signingService, nonce),
      null,
      stateData,
    );
    const expectedRecipient = await Pointer.createFromPublicKey(
      tokenType,
      signingService.algorithm,
      signingService.hashAlgorithm,
      signingService.publicKey,
      nonce,
    );

    if (!expectedRecipient.equals(recipient)) {
      throw new Error('Recipient mismatch');
    }

    if (HexConverter.encode(inclusionProof.payload) !== HexConverter.encode(transition.hash)) {
      throw new Error('Payload hash mismatch');
    }

    return new Token(tokenId, tokenType, tokenData, inclusionProof, recipient, salt, state, [transition], '');
  }

  public async importToken(
    data: unknown
  ): Promise<Token | void> {


    
  }

  public async createTransaction(): Promise<unknown> {
    return Promise.resolve();
  }

  public async createTransition(token: Token, transaction: Transaction): Promise<unknown> {

    return 'token';
  }

  
}

 class Transaction {

 }
