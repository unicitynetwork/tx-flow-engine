import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { AddressScheme } from './AddressScheme.js';
import { IAddress } from './IAddress.js';

export class DirectAddress implements IAddress {
  private constructor(
    private readonly data: Uint8Array,
    private readonly checksum: Uint8Array,
  ) {
    this.data = new Uint8Array(data);
    this.checksum = new Uint8Array(checksum.slice(0, 4));
  }

  public get scheme(): AddressScheme {
    return AddressScheme.DIRECT;
  }

  public static async create(predicateReference: Uint8Array): Promise<DirectAddress> {
    const checksum = await new DataHasher(HashAlgorithm.SHA256).update(predicateReference).digest();
    return new DirectAddress(predicateReference, checksum.data.slice(0, 4));
  }

  // TODO: Should hash algorithm be derivable from the string?
  public toDto(): string {
    return `${this.scheme}://${HexConverter.encode(this.data)}${HexConverter.encode(this.checksum)}`;
  }

  public toString(): string {
    return `DirectAddress[${HexConverter.encode(this.data)}${HexConverter.encode(this.checksum)}]`;
  }
}
