import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { TokenId } from './TokenId.js';
import { ITokenStateDto, TokenState } from './TokenState.js';
import { TokenType } from './TokenType.js';
import { IAddress } from '../address/IAddress.js';
import { MintTransactionData } from '../transaction/MintTransactionData.js';
import { ITransactionDto, Transaction } from '../transaction/Transaction.js';
import { TransactionData } from '../transaction/TransactionData.js';

export interface ITokenDto {
  readonly id: string;
  readonly type: string;
  readonly data: string;
  readonly recipient: string;
  readonly salt: string;
  readonly state: ITokenStateDto;
  readonly transactions: [ITransactionDto<MintTransactionData>, ...ITransactionDto<TransactionData>[]];
}

export class Token {
  public constructor(
    public readonly id: TokenId,
    public readonly type: TokenType,
    public readonly _data: Uint8Array,
    public readonly recipient: IAddress,
    public readonly _salt: Uint8Array,
    public readonly state: TokenState,
    public readonly transactions: [Transaction<MintTransactionData>, ...Transaction<TransactionData>[]],
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

  public toDto(): ITokenDto {
    return {
      data: HexConverter.encode(this._data),
      id: this.id.toDto(),
      recipient: this.recipient.toDto(),
      salt: HexConverter.encode(this._salt),
      state: this.state.toDto(),
      transactions: this.transactions.map((transaction) => transaction.toDto()) as [
        ITransactionDto<MintTransactionData>,
        ...ITransactionDto<TransactionData>[],
      ],
      type: this.type.toDto(),
    };
  }

  public toString(): string {
    return dedent`
        MintTransition
          Id: ${this.id.toString()}
          Type: ${this.type.toString()}
          Data: ${HexConverter.encode(this._data)}
          Recipient: ${this.recipient.toString()}
          Salt: ${HexConverter.encode(this._salt)}
          State: 
            ${this.state.toString()}
          Transactions: 
            ${this.transactions.map((transition) => transition.toString())}
      `;
  }
}
