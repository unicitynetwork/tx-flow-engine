import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { AddressScheme } from './AddressScheme.js';
import { IAddress } from './IAddress.js';
import { TokenState } from '../token/TokenState.js';
import { TokenType } from '../token/TokenType.js';

const textEncoder = new TextEncoder();

export class PublicKeyAddress implements IAddress {
  public constructor(private readonly _data: Uint8Array) {
    this._data = new Uint8Array(_data);
  }

  public get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  public get scheme(): AddressScheme {
    return AddressScheme.PUBLIC_KEY;
  }

  public static async create(
    tokenType: TokenType,
    algorithm: string,
    hashAlgorithm: HashAlgorithm,
    publicKey: Uint8Array,
    signature: Uint8Array,
    sourceState: TokenState,
  ): Promise<PublicKeyAddress> {
    const algorithmHash = await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(algorithm)).digest();
    const hashAlgorithmHash = await new DataHasher(HashAlgorithm.SHA256)
      .update(new Uint8Array([hashAlgorithm & 0xff00, hashAlgorithm & 0xff]))
      .digest();

    const nonce = await new DataHasher(HashAlgorithm.SHA256)
      .update(sourceState.hash.imprint)
      .update(signature)
      .digest();

    const result = await new DataHasher(HashAlgorithm.SHA256)
      .update(tokenType.encode())
      .update(algorithmHash.data)
      .update(hashAlgorithmHash.data)
      .update(publicKey)
      .update(nonce.data)
      .digest();

    return new PublicKeyAddress(result.data);
  }

  public toDto(): string {
    return `${this.scheme}://${HexConverter.encode(this._data)}`;
  }

  public toString(): string {
    return `PublicKeyAddress[${HexConverter.encode(this._data)}]`;
  }
}
