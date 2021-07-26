import {Entity, model, property} from '@loopback/repository';

@model()
export class State extends Entity {
  @property({
    type: 'number',
    required: true,
  })
  epoch: number;

  @property({
    type: 'string',
    required: true,
  })
  totalFee: string;

  @property({
    type: 'boolean',
    required: true,
  })
  paused: boolean;

  constructor(data?: Partial<State>) {
    super(data);
  }
}
