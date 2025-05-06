import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { ITokenData } from './ITokenData.js';
import { NameTagTokenData } from './NameTagTokenData.js';
import { TokenId } from './TokenId.js';
import { ITokenStateDto, TokenState } from './TokenState.js';
import { TokenType } from './TokenType.js';
import { MintTransactionData } from '../transaction/MintTransactionData.js';
import { ITransactionDto, Transaction } from '../transaction/Transaction.js';
import { TransactionData } from '../transaction/TransactionData.js';

export interface ITokenDto {
  readonly id: string;
  readonly type: string;
  readonly data: string;
  readonly state: ITokenStateDto;
  readonly transactions: [ITransactionDto<MintTransactionData>, ...ITransactionDto<TransactionData>[]];
  readonly nametagTokens: ITokenDto[];
}

export class Token<T extends ITokenData> {
  public constructor(
    public readonly id: TokenId,
    public readonly type: TokenType,
    public readonly data: T,
    public readonly state: TokenState,
    private readonly _transactions: [Transaction<MintTransactionData>, ...Transaction<TransactionData>[]],
    private readonly _nametagTokens: Token<NameTagTokenData>[] = [],
  ) {
    this._nametagTokens = [..._nametagTokens];
    this._transactions = [..._transactions];
  }

  public get nametagTokens(): Token<NameTagTokenData>[] {
    return [...this._nametagTokens];
  }

  public get transactions(): [Transaction<MintTransactionData>, ...Transaction<TransactionData>[]] {
    return [...this._transactions];
  }

  public toDto(): ITokenDto {
    return {
      data: HexConverter.encode(this.data.encode()),
      id: this.id.toDto(),
      nametagTokens: this.nametagTokens.map((token) => token.toDto()),
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
        Token:
          Id: ${this.id.toString()}
          Type: ${this.type.toString()}
          Data: 
            ${this.data.toString()}
          State:
            ${this.state.toString()}
          Transactions: [
            ${this.transactions.map((transition) => transition.toString()).join('\n')}
          ]
          Nametag Tokens: [ 
            ${this.nametagTokens.map((token) => token.toString()).join('\n')}
          ]
      `;
  }
}
