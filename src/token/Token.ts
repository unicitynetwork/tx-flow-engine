import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { TokenId } from './TokenId.js';
import { TokenState } from './TokenState.js';
import { TokenType } from './TokenType.js';
import { Pointer } from '../address/Pointer.js';
import { MintTransaction } from '../transaction/MintTransaction.js';
import { Transaction } from '../transaction/Transaction.js';

export class Token {
  public constructor(
    public readonly id: TokenId,
    public readonly type: TokenType,
    public readonly _data: Uint8Array,
    public readonly inclusionProof: InclusionProof,
    public readonly recipient: Pointer,
    public readonly _salt: Uint8Array,
    public readonly state: TokenState,
    public readonly transactions: [MintTransaction, ...Transaction[]],
    public readonly nametagVerifier: string,
  ) {
    this._data = new Uint8Array(_data);
    this._salt = new Uint8Array(_salt);
  }

  public get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  public get salt(): Uint8Array {
    return new Uint8Array(this._salt);
  }

  public toString(): string {
    return dedent`
        MintTransition
          Id: ${this.id.toString()}
          Type: ${this.type.toString()}
          Data: ${HexConverter.encode(this._data)}
          InclusionProof: 
            ${this.inclusionProof.toString()}
          Recipient: ${this.recipient.toString()}
          Salt: ${HexConverter.encode(this._salt)}
          State: 
            ${this.state.toString()}
          Transactions: 
            ${this.transactions.map((transition) => transition.toString())}
      `;
  }
}
