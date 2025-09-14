/**
 * Repository Index
 * Exports all repository classes for easy importing
 */

const BaseRepository = require('./BaseRepository');
const LoanRepository = require('./LoanRepository');
const ClientRepository = require('./ClientRepository');
const StaffRepository = require('./StaffRepository');
const RegionRepository = require('./RegionRepository');

module.exports = {
  BaseRepository,
  LoanRepository,
  ClientRepository,
  StaffRepository,
  RegionRepository
};