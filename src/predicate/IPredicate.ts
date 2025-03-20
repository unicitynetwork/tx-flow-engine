import { Transaction } from '../transaction/Transaction.js';
import { MintTransactionData } from '../transaction/MintTransactionData.js';
import { TransactionData } from '../transaction/TransactionData.js';

export interface IPredicateDto {
  readonly type: string;
}

export interface IPredicate {
  readonly hash: Uint8Array;
  readonly nonce: Uint8Array;

  verify(transaction: Transaction<MintTransactionData | TransactionData>): Promise<boolean>;
  toDto(): IPredicateDto;
}
