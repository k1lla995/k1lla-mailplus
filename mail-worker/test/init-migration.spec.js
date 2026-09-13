import { describe, expect, it, vi } from 'vitest';
import { dbInit, isDuplicateSchemaError } from '../src/init/init';

function createMigrationContext({ first = async () => null, run = async () => {} } = {}) {
	return {
		env: {
			db: {
				prepare(sql) {
					return {
						first: () => first(sql),
						run: () => run(sql)
					};
				}
			}
		}
	};
}

describe('database initialization migrations', () => {
	it('recognizes only duplicate column and index errors as ignorable', () => {
		expect(isDuplicateSchemaError(new Error('D1_ERROR: duplicate column name: uid'))).toBe(true);
		expect(isDuplicateSchemaError(new Error('index idx_user_uid already exists'))).toBe(true);
		expect(isDuplicateSchemaError(new Error('no such column: auto_refresh_time'))).toBe(false);
		expect(isDuplicateSchemaError(new Error('UNIQUE constraint failed: user.email'))).toBe(false);
	});

	it('does not run the legacy auto-refresh rename when the old column is absent', async () => {
		const run = vi.fn();
		const context = createMigrationContext({ run });

		await dbInit.v2_7DB(context);

		expect(run).not.toHaveBeenCalled();
	});

	it('propagates a failed legacy auto-refresh rename', async () => {
		let columnLookup = 0;
		const context = createMigrationContext({
			first: async () => (++columnLookup === 1 ? { name: 'auto_refresh_time' } : null),
			run: async () => {
				throw new Error('no such column: auto_refresh_time');
			}
		});

		await expect(dbInit.v2_7DB(context)).rejects.toThrow('no such column: auto_refresh_time');
	});

	it('continues past an explicit duplicate column error', async () => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const context = createMigrationContext({
			run: async () => {
				throw new Error('duplicate column name: primary_color');
			}
		});

		try {
			await expect(dbInit.v3_1DB(context)).resolves.toBeUndefined();
			expect(warning).toHaveBeenCalledWith(expect.stringContaining('duplicate schema migration'));
		} finally {
			warning.mockRestore();
		}
	});
});
