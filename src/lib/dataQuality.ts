// Re-exports the implementation from /shared so Cloud Functions can use the same code.
export {
  findDuplicates,
  findOutliers,
  findMissingCoverage,
  runAllChecks,
  type DataIssue,
} from '../../shared/dataQuality';
