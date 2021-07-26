import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MainDataSource} from '../datasources';
import {Round, RoundRelations} from '../models';

export class RoundRepository extends DefaultCrudRepository<
  Round,
  typeof Round.prototype.epoch,
  RoundRelations
> {
  constructor(@inject('datasources.main') dataSource: MainDataSource) {
    super(Round, dataSource);
  }
}
