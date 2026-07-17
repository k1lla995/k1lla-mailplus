import { recycleReasonConst } from '../const/entity-const';

export function resolveRecycleReason({ automaticSpam = false, manualRule = false, blacklisted = false }) {
	if (blacklisted) return recycleReasonConst.BLACKLIST;
	if (manualRule) return recycleReasonConst.MANUAL_RULE;
	if (automaticSpam) return recycleReasonConst.AUTO_SPAM;
	return null;
}
