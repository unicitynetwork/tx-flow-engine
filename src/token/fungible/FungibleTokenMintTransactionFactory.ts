import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { ISerializable } from '../../ISerializable.js';
import { IMintTransactionDataDto, MintTransactionData } from '../../transaction/MintTransactionData.js';
import { ITransactionDto, Transaction } from '../../transaction/Transaction.js';
import { IMintTransactionFactory } from '../IMintTransactionFactory.js';
import { TokenId } from '../TokenId.js';
import { TokenType } from '../TokenType.js';
import { IFungibleTokenMintReason } from './IFungibleTokenMintReason.js';

export class FungibleTokenMintTransactionFactory implements IMintTransactionFactory {
  public async create(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: ISerializable,
    sourceState: RequestId,
    transaction: ITransactionDto<IMintTransactionDataDto>,
  ): Promise<Transaction<MintTransactionData<ISerializable | null>>> {
    return new Transaction(
      await MintTransactionData.create(
        tokenId,
        tokenType,
        tokenData,
        sourceState,
        transaction.data.recipient,
        HexConverter.decode(transaction.data.salt),
        transaction.data.dataHash ? DataHash.fromDto(transaction.data.dataHash) : null,
        // TODO: Parse reason properly
        transaction.data.reason ? this.createReason(HexConverter.decode(transaction.data.reason)) : null,
      ),
      InclusionProof.fromDto(transaction.inclusionProof),
    );
  }

  private createReason(bytes: Uint8Array): IFungibleTokenMintReason {
    const data = CborDecoder.readArray(bytes);
    const type = CborDecoder.readTextString(data[0]);
    switch (type) {
      default:
        throw new Error('NOT IMPLEMENTED');
    }
  }
}
