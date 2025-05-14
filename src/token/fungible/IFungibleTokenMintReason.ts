import { FungibleTokenMintReasonType } from './FungibleTokenMintReasonType.js';
import { ISerializable } from '../../ISerializable.js';

export interface IFungibleTokenMintReason extends ISerializable {
  readonly type: FungibleTokenMintReasonType;
}
