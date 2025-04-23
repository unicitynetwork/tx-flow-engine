import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { Transaction } from '@unicitylabs/commons/lib/api/Transaction.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { SparseMerkleTree } from '@unicitylabs/commons/lib/smt/SparseMerkleTree.js';

import { IAggregatorClient } from '../src/api/IAggregatorClient.js';
import { IAuthenticator } from '../src/api/IAuthenticator.js';
import { SubmitStateTransitionResponse } from '../src/api/SubmitStateTransitionResponse.js';

export class TestAggregatorClient implements IAggregatorClient {
  private readonly requests: Map<bigint, Transaction> = new Map();

  public constructor(private readonly smt: SparseMerkleTree) {}

  public async submitTransaction(
    requestId: RequestId,
    transactionHash: DataHash,
    authenticator: IAuthenticator,
  ): Promise<SubmitStateTransitionResponse> {
    const path = requestId.toBigInt();
    const transaction = await Transaction.create(authenticator as Authenticator, transactionHash);
    await this.smt.addLeaf(path, transaction.leafValue.imprint);
    this.requests.set(path, transaction);

    return new SubmitStateTransitionResponse(
      new InclusionProof(this.smt.getPath(path), authenticator as Authenticator, transactionHash),
    );
  }

  public async getInclusionProof(requestId: RequestId): Promise<InclusionProof> {
    const transaction = this.requests.get(requestId.toBigInt());
    // TODO: If element does not exist, authenticator and transactionHash should be null
    return new InclusionProof(
      this.smt.getPath(requestId.toBigInt()),
      transaction?.authenticator as Authenticator,
      transaction?.transactionHash as DataHash,
    );
  }
}
