import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { CborEncoder } from '@unicitylabs/commons/lib/cbor/CborEncoder.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { FungibleTokenId } from './FungibleTokenId.js';
import { ISerializable } from '../../ISerializable.js';

export class FungibleTokenData implements ISerializable {
  private readonly _coins: Map<string, bigint>;

  public constructor(coins: [FungibleTokenId, bigint][]) {
    this._coins = new Map(coins.map(([key, value]) => [key.toDto(), value]));
  }

  public get coins(): [FungibleTokenId, bigint][] {
    return Array.from(this._coins.entries()).map(([key, value]) => [FungibleTokenId.fromDto(key), value]);
  }

  public static decode(data: Uint8Array): FungibleTokenData {
    const coins: [FungibleTokenId, bigint][] = [];
    const entries = CborDecoder.readArray(data);
    for (const item of entries) {
      const [key, value] = CborDecoder.readArray(item);
      coins.push([FungibleTokenId.fromDto(CborDecoder.readTextString(key)), CborDecoder.readUnsignedInteger(value)]);
    }

    return new FungibleTokenData(coins);
  }

  public encode(): Uint8Array {
    return CborEncoder.encodeArray(
      Array.from(this._coins.entries()).map(([key, value]) =>
        CborEncoder.encodeArray([CborEncoder.encodeTextString(key), CborEncoder.encodeUnsignedInteger(value)]),
      ),
    );
  }

  public toString(): string {
    return dedent`
      FungibleTokenData
        ${Array.from(this._coins.entries())
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')}`;
  }
}
