import {Entity, model, property} from '@loopback/repository';

export enum RoundStatus {
  STARTED = 'STARTED',
  LOCKED = 'LOCKED',
  ENDED = 'ENDED',
  EXECUTING = 'EXECUTING',
}

@model()
export class Round extends Entity {
  @property({
    type: 'number',
    id: true,
    required: true,
  })
  epoch: number;

  @property({
    type: 'number',
    required: true,
  })
  startTime: number;

  @property({
    type: 'number',
    required: true,
  })
  lockTime: number;

  @property({
    type: 'number',
    required: true,
  })
  endTime: number;

  @property({
    type: 'string',
  })
  openPrice?: string;

  @property({
    type: 'string',
  })
  closePrice?: string;

  @property({
    type: 'string',
    required: true,
  })
  totalAmount: string;

  @property({
    type: 'string',
    required: true,
  })
  rewardAmount: string;

  @property({
    type: 'string',
    required: true,
  })
  upAmount: string;

  @property({
    type: 'string',
    required: true,
  })
  downAmount: string;

  @property({
    type: 'boolean',
    required: true,
  })
  isGenesis: boolean;

  @property({
    type: 'string',
    required: true,
  })
  status: RoundStatus;

  @property({
    type: 'string',
  })
  executeTx?: string;

  constructor(data?: Partial<Round>) {
    super(data);
  }
}

export interface RoundRelations {
  // describe navigational properties here
}

export type RoundWithRelations = Round & RoundRelations;
