import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';

export interface IPredicate {
  readonly hash: Uint8Array;
  verify(inclusionProof: InclusionProof, stateHash: Uint8Array): Promise<string>;
}
