import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { AddressScheme } from './AddressScheme.js';
import { IAddress } from './IAddress.js';
import { TokenType } from '../token/TokenType.js';

const textEncoder = new TextEncoder();

export class OneTimeAddress implements IAddress {
  public constructor(private readonly _data: DataHash) {}

  public get data(): Uint8Array {
    return new Uint8Array(this._data.data);
  }

  public get hashAlgorithm(): HashAlgorithm {
    return this._data.algorithm;
  }

  public get scheme(): AddressScheme {
    return AddressScheme.ONE_TIME;
  }

  public static async create(
    tokenType: TokenType,
    secret: Uint8Array,
    nonce: Uint8Array,
    hashAlgorithm: HashAlgorithm,
  ): Promise<OneTimeAddress> {
    // Replace signing service with factory to create proper signing service
    const signingService = await SigningService.createFromSecret(secret, nonce);
    return OneTimeAddress.createFromPublicKey(
      tokenType,
      signingService.algorithm,
      hashAlgorithm,
      signingService.publicKey,
      nonce,
    );
  }

  public static async createFromPublicKey(
    tokenType: TokenType,
    algorithm: string,
    hashAlgorithm: HashAlgorithm,
    publicKey: Uint8Array,
    nonce: Uint8Array,
  ): Promise<OneTimeAddress> {
    const algorithmHash = await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(algorithm)).digest();
    const hashAlgorithmHash = await new DataHasher(HashAlgorithm.SHA256)
      .update(new Uint8Array([hashAlgorithm & 0xff00, hashAlgorithm & 0xff]))
      .digest();

    return new OneTimeAddress(
      await new DataHasher(HashAlgorithm.SHA256)
        .update(tokenType.encode())
        .update(algorithmHash.data)
        .update(hashAlgorithmHash.data)
        .update(publicKey)
        .update(nonce)
        .digest(),
    );
  }

  // TODO: Should hash algorithm be derivable from the string?
  public toDto(): string {
    return `${this.scheme}://${this._data.toDto()}`;
  }

  public toString(): string {
    return `OneTimeAddress[${HexConverter.encode(this._data.imprint)}]`;
  }
}
