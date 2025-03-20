import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { AddressScheme } from './IAddress.js';
import { TokenType } from '../token/TokenType.js';

const textEncoder = new TextEncoder();

export class OneTimeAddress {
  public constructor(
    public readonly hashAlgorithm: HashAlgorithm,
    private readonly _data: Uint8Array,
  ) {
    this._data = new Uint8Array(_data);
  }

  public get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  public get scheme(): AddressScheme {
    return AddressScheme.ONE_TIME_ADDRESS;
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
    const hash = await new DataHasher(hashAlgorithm)
      .update(tokenType.encode())
      .update(await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(algorithm)).digest())
      .update(await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(hashAlgorithm)).digest())
      .update(publicKey)
      .update(nonce)
      .digest();

    return new OneTimeAddress(hashAlgorithm, hash);
  }

  public encode(): Uint8Array {
    return textEncoder.encode(this.toDto());
  }

  public toDto(): string {
    return `${this.scheme}://${HexConverter.encode(this._data)}`;
  }

  public equals(recipient: OneTimeAddress): boolean {
    return HexConverter.encode(this._data) === HexConverter.encode(recipient.data);
  }

  public toString(): string {
    return `OneTimeAddress[${HexConverter.encode(this._data)}]`;
  }
}
