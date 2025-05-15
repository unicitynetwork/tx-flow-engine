import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { TokenId } from './TokenId.js';
import { ITokenStateDto, TokenState } from './TokenState.js';
import { TokenType } from './TokenType.js';
import { ISerializable } from '../ISerializable.js';
import { NameTagToken } from './NameTagToken.js';
import { IMintTransactionDataDto, MintTransactionData } from '../transaction/MintTransactionData.js';
import { ITransactionDto, Transaction } from '../transaction/Transaction.js';
import { ITransactionDataDto, TransactionData } from '../transaction/TransactionData.js';
import { FungibleTokenData } from './fungible/FungibleTokenData.js';

export const TOKEN_VERSION = '2.0';

export interface ITokenDto {
  readonly version: string;
  readonly id: string;
  readonly type: string;
  readonly data: string;
  readonly coins: string | null;
  readonly state: ITokenStateDto;
  readonly transactions: [ITransactionDto<IMintTransactionDataDto>, ...ITransactionDto<ITransactionDataDto>[]];
  readonly nametagTokens: ITokenDto[];
}

export class Token<TD extends ISerializable, MTD extends MintTransactionData<ISerializable | null>> {
  public constructor(
    public readonly id: TokenId,
    public readonly type: TokenType,
    public readonly data: TD,
    public readonly coins: FungibleTokenData | null,
    public readonly state: TokenState,
    private readonly _transactions: [Transaction<MTD>, ...Transaction<TransactionData>[]],
    private readonly _nametagTokens: NameTagToken[] = [],
    public readonly version: string = TOKEN_VERSION,
  ) {
    this._nametagTokens = [..._nametagTokens];
    this._transactions = [..._transactions];
  }

  public get nametagTokens(): NameTagToken[] {
    return [...this._nametagTokens];
  }

  public get transactions(): [Transaction<MTD>, ...Transaction<TransactionData>[]] {
    return [...this._transactions];
  }

  public toDto(): ITokenDto {
    return {
      coins: this.coins ? HexConverter.encode(this.coins.encode()) : null,
      data: HexConverter.encode(this.data.encode()),
      id: this.id.toDto(),
      nametagTokens: this.nametagTokens.map((token) => token.toDto()),
      state: this.state.toDto(),
      transactions: this.transactions.map((transaction) => transaction.toDto()) as [
        ITransactionDto<IMintTransactionDataDto>,
        ...ITransactionDto<ITransactionDataDto>[],
      ],
      type: this.type.toDto(),
      version: this.version,
    };
  }

  public toString(): string {
    return dedent`
        Token[${this.version}]:
          Id: ${this.id.toString()}
          Type: ${this.type.toString()}
          Data: 
            ${this.data.toString()}
          Coins:
            ${this.coins?.toString() ?? null}
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
