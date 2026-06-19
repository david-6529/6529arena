export function hasUnsavedPostContentChanges(params: {
  savedTitle: string;
  savedContent: string;
  draftTitle: string;
  draftContent: string;
}) {
  return params.savedTitle !== params.draftTitle || params.savedContent !== params.draftContent;
}

export function isWaveBriefContentLocked(status: string) {
  return status === "posted" || status === "rejected" || status === "posting";
}

export function isWaveBriefApprovalBlocked(params: {
  status: string;
  finalMissingSourceCount: number;
  hasUnsavedContentChanges: boolean;
}) {
  return isWaveBriefContentLocked(params.status) || params.finalMissingSourceCount > 0 || params.hasUnsavedContentChanges;
}
