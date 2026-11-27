/**
 * The dispute rules exactly as disputeservice serves them at /policy/rules, through
 * /api/dispute-rules. The text is ARBITRATION_POLICY.md's own; the site keeps no copy.
 */

export interface RuleSection {
  /** The policy's own section number, e.g. '4' or '3b'. */
  number: string;
  title: string;
  /** Markdown. Subsections are ### headings. */
  markdown: string;
}

export interface PolicyRules {
  /** The commit that last changed ARBITRATION_POLICY.md; null when the service was built without git. */
  policySha: string | null;
  /** When that commit was made, Unix seconds. */
  policyCommittedAt: number | null;
  /** True when the service was built with uncommitted changes to the policy. */
  policyModified: boolean;
  /** The commit disputeservice itself was built from. */
  buildSha: string | null;
  sections: RuleSection[];
}
