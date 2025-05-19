import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

export class CoinId {
  public constructor(private readonly data: Uint8Array) {
    this.data = new Uint8Array(data);
  }

  public static fromDto(data: string): CoinId {
    return new CoinId(HexConverter.decode(data));
  }

  public toDto(): string {
    return HexConverter.encode(this.data);
  }
}
