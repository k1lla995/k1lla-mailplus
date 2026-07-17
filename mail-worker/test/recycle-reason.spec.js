import { describe, expect, it } from 'vitest';
import { recycleReasonConst } from '../src/const/entity-const';
import { resolveRecycleReason } from '../src/utils/recycle-reason-utils';

describe('recycle reason resolution', () => {
	it('classifies automatic spam', () => {
		expect(resolveRecycleReason({ automaticSpam: true })).toBe(recycleReasonConst.AUTO_SPAM);
	});

	it('prefers an explicit blacklist over other matching rules', () => {
		expect(resolveRecycleReason({ automaticSpam: true, manualRule: true, blacklisted: true })).toBe(recycleReasonConst.BLACKLIST);
	});

	it('does not create a reason when no rule matched', () => {
		expect(resolveRecycleReason({})).toBeNull();
	});
});
