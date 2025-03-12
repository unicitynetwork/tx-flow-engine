import { DataHasher, HashAlgorithm } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { AddressScheme } from '../IAddress.js';
import { TokenType } from '../token/TokenType.js';

const textEncoder = new TextEncoder();

export class Pointer {
  public constructor(private readonly _data: Uint8Array) {
    this._data = new Uint8Array(_data);
  }

  public get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  public static async create(tokenType: TokenType, secret: Uint8Array, nonce: Uint8Array): Promise<Pointer> {
    // Replace signing service with factory to create proper signing service
    const signingService = await SigningService.createFromSecret(secret, nonce);
    return Pointer.createFromPublicKey(
      tokenType,
      signingService.algorithm,
      signingService.hashAlgorithm,
      signingService.publicKey,
      nonce,
    );
  }

  public static async createFromPublicKey(
    tokenType: TokenType,
    algorithm: string,
    hashAlgorithm: string,
    publicKey: Uint8Array,
    nonce: Uint8Array,
  ): Promise<Pointer> {
    const hash = await new DataHasher(HashAlgorithm.SHA256)
      .update(tokenType.encode())
      .update(await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(algorithm)).digest())
      .update(await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(hashAlgorithm)).digest())
      .update(publicKey)
      .update(nonce)
      .digest();

    return new Pointer(hash);
  }

  public encode(): Uint8Array {
    return textEncoder.encode(`${AddressScheme.POINTER}://${HexConverter.encode(this._data)}`);
  }

  public equals(recipient: Pointer): boolean {
    return HexConverter.encode(this._data) === HexConverter.encode(recipient.data);
  }

  public toString(): string {
    return `Pointer[${HexConverter.encode(this._data)}]`;
  }
}
