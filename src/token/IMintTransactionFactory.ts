import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';

import { TokenId } from './TokenId.js';
import { TokenType } from './TokenType.js';
import { ISerializable } from '../ISerializable.js';
import { IMintTransactionDataDto, MintTransactionData } from '../transaction/MintTransactionData.js';
import { ITransactionDto, Transaction } from '../transaction/Transaction.js';

export interface IMintTransactionFactory {
  create(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: ISerializable,
    sourceState: RequestId,
    transaction: ITransactionDto<IMintTransactionDataDto>,
  ): Promise<Transaction<MintTransactionData<ISerializable | null>>>;
}
