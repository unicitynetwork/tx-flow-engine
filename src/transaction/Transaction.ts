import type { IInclusionProofDto } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { IMintTransactionDataDto, MintTransactionData } from './MintTransactionData.js';
import { ITransactionDataDto, TransactionData } from './TransactionData.js';

type TransactionDataDtoType<T extends TransactionData | MintTransactionData> = T extends TransactionData
  ? ITransactionDataDto
  : IMintTransactionDataDto;

export interface ITransactionDto<T extends TransactionData | MintTransactionData> {
  readonly data: TransactionDataDtoType<T>;
  readonly inclusionProof: IInclusionProofDto;
}

export class Transaction<T extends TransactionData | MintTransactionData> {
  public constructor(
    public readonly data: T,
    public readonly inclusionProof: InclusionProof,
  ) {}

  public toDto(): ITransactionDto<T> {
    return {
      data: this.data.toDto() as TransactionDataDtoType<T>,
      inclusionProof: this.inclusionProof.toDto(),
    };
  }

  public toString(): string {
    return dedent`
        Transaction
          ${this.data.toString()}
          ${this.inclusionProof.toString()}`;
  }
}
