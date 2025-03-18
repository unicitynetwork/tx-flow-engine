import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { JsonRpcHttpTransport } from '@unicitylabs/commons/lib/json-rpc/JsonRpcHttpTransport.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { SubmitStateTransitionResponse } from './SubmitStateTransitionResponse.js';
import { IAuthenticator } from '../IAuthenticator.js';

export class AggregatorClient {
  private readonly transport: JsonRpcHttpTransport;
  public constructor(url: string) {
    this.transport = new JsonRpcHttpTransport(url);
  }

  public async submitTransaction(
    requestId: RequestId,
    payload: Uint8Array,
    authenticator: IAuthenticator,
  ): Promise<SubmitStateTransitionResponse> {
    const data = {
      authenticator: authenticator.toDto(),
      payload: HexConverter.encode(payload),
      requestId: requestId.toString(),
    };

    return SubmitStateTransitionResponse.fromDto(await this.transport.request('aggregator_submit', data));
  }

  public async getInclusionProof(requestId: RequestId, blockNum?: bigint): Promise<InclusionProof> {
    const data = { blockNum: blockNum?.toString(), requestId: requestId.toString() };
    return InclusionProof.fromDto(await this.transport.request('aggregator_get_path', data));
  }

  public getNodelProof(requestId: RequestId): Promise<unknown> {
    const data = { requestId: requestId.toString() };
    return this.transport.request('aggregator_get_nodel', data);
  }
}
