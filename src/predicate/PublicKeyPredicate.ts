import { InclusionProof, InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher, HashAlgorithm } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { IPredicate } from './IPredicate.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

const textEncoder = new TextEncoder();

export class PublicKeyPredicate implements IPredicate {
  private constructor(
    private readonly publicKey: Uint8Array,
    private readonly _hash: Uint8Array,
  ) {
    this.publicKey = new Uint8Array(publicKey);
    this._hash = new Uint8Array(_hash);
  }

  public get hash(): Uint8Array {
    return new Uint8Array(this._hash);
  }

  public static async create(
    tokenId: TokenId,
    tokenType: TokenType,
    signingService: ISigningService,
    nonce: Uint8Array,
  ): Promise<PublicKeyPredicate> {
    const hash = await new DataHasher(HashAlgorithm.SHA256)
      .update(tokenType.encode())
      .update(await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(signingService.algorithm)).digest())
      .update(tokenId.encode())
      .update(
        await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(signingService.hashAlgorithm)).digest(),
      )
      .update(signingService.publicKey)
      .update(nonce)
      .digest();

    return new PublicKeyPredicate(signingService.publicKey, hash);
  }

  public async verify(inclusionProof: InclusionProof, stateHash: Uint8Array): Promise<string> {
    const requestId = await RequestId.create(this.publicKey, stateHash);
    const status = await inclusionProof.verify(requestId.toBigInt());
    if (status !== InclusionProofVerificationStatus.OK) {
      return status;
    }

    if (
      HexConverter.encode(inclusionProof.authenticator.publicKey) !== HexConverter.encode(this.publicKey) ||
      HexConverter.encode(inclusionProof.authenticator.state) !== HexConverter.encode(stateHash)
    ) {
      return 'input mismatch';
    }

    return InclusionProofVerificationStatus.OK;
  }
}
