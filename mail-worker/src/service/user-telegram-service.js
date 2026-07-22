import { and, eq } from 'drizzle-orm';
import orm from '../entity/orm';
import { telegramBinding, userTelegram } from '../entity/user-telegram';
import user from '../entity/user';
import { isDel, userConst } from '../const/entity-const';
import userContext from '../security/user-context';
import accessControlService from '../security/access-control-service';
import BizError from '../error/biz-error';
import settingService from './setting-service';
import adminUtils from '../utils/admin-utils';

const BINDING_TTL_SECONDS = 10 * 60;

function normalizeTgBotUsername(input) {
	if (!input || typeof input !== 'string') return '';
	let value = input.trim();
	if (!value) return '';
	const fromUrl = value.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)/i);
	if (fromUrl) value = fromUrl[1];
	value = value.replace(/^@/, '');
	if (!/^[A-Za-z0-9_]{5,32}$/.test(value)) return '';
	return value;
}

function buildBotBindLink(username, code) {
	const bot = normalizeTgBotUsername(username);
	if (!bot || !code) return '';
	return `https://t.me/${bot}?start=bind_${code}`;
}


function randomCode() {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hashCode(value) {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function expiresAt() {
	return new Date(Date.now() + BINDING_TTL_SECONDS * 1000).toISOString();
}

const userTelegramService = {
	async get(c, userId = userContext.getUserId(c)) {
		const row = await orm(c).select().from(userTelegram).where(eq(userTelegram.userId, userId)).get();
		const settings = await settingService.query(c);
		const botUsername = normalizeTgBotUsername(settings.tgBotUsername);
		const botLink = botUsername ? `https://t.me/${botUsername}` : '';

		if (row) {
			return { ...row, botUsername, botLink };
		}

		// Root admin is authorized by default even before a user_telegram row exists.
		const ctxUser = c.get?.('user');
		let isRoot = false;
		if (ctxUser && Number(ctxUser.userId) === Number(userId)) {
			isRoot = adminUtils.isAdminUser(ctxUser, c.env.admin);
		} else {
			const owner = await orm(c).select().from(user).where(eq(user.userId, userId)).get();
			isRoot = adminUtils.isAdminUser(owner, c.env.admin);
		}

		return {
			userId,
			authorized: isRoot ? 1 : 0,
			pushEnabled: 0,
			chatId: '',
			chatUsername: '',
			boundAt: null,
			botUsername,
			botLink
		};
	},

	async ensureRootAuthorization(c, userId) {
		await orm(c).insert(userTelegram).values({
			userId,
			authorized: 1,
			updatedAt: new Date().toISOString()
		}).onConflictDoUpdate({
			target: userTelegram.userId,
			set: {
				authorized: 1,
				updatedAt: new Date().toISOString()
			}
		}).run();
	},

	async setAuthorization(c, params) {
		const { userId, authorized } = params;
		if (!Number.isInteger(Number(userId)) || ![0, 1].includes(Number(authorized))) {
			throw new BizError('Invalid Telegram authorization request');
		}
		if (!await accessControlService.isRootAdmin(c)) {
			throw new BizError('Only the root administrator can manage Telegram authorization', 403);
		}
		const target = await orm(c).select().from(user).where(eq(user.userId, Number(userId))).get();
		if (!target || target.isDel !== isDel.NORMAL) {
			throw new BizError('User does not exist');
		}
		// Root admin cannot be de-authorized.
		if (adminUtils.isAdminUser(target, c.env.admin) && Number(authorized) === 0) {
			throw new BizError('Root administrator Telegram push cannot be revoked', 403);
		}
		await orm(c).insert(userTelegram).values({
			userId: Number(userId),
			authorized: Number(authorized),
			pushEnabled: 0,
			updatedAt: new Date().toISOString()
		}).onConflictDoUpdate({
			target: userTelegram.userId,
			set: {
				authorized: Number(authorized),
				pushEnabled: Number(authorized) ? userTelegram.pushEnabled : 0,
				updatedAt: new Date().toISOString()
			}
		});
		return this.get(c, Number(userId));
	},

	async createBinding(c) {
		const userId = userContext.getUserId(c);
		const isRoot = await accessControlService.isRootAdmin(c);

		// Always persist root authorization so webhook verification can see it without JWT context.
		if (isRoot) {
			await this.ensureRootAuthorization(c, userId);
		}

		const config = await this.get(c, userId);
		if (!config.authorized) {
			throw new BizError('Telegram push has not been authorized for this user', 403);
		}
		if (!(await settingService.query(c)).tgBotToken) {
			throw new BizError('The root administrator has not configured the Telegram bot');
		}
		const code = randomCode();
		const codeHash = await hashCode(code);
		await orm(c).delete(telegramBinding).where(eq(telegramBinding.userId, userId)).run();
		await orm(c).insert(telegramBinding).values({ codeHash, userId, expiresAt: expiresAt() }).run();
		const botUsername = normalizeTgBotUsername((await settingService.query(c)).tgBotUsername);
		return {
			code,
			expiresIn: BINDING_TTL_SECONDS,
			botUsername,
			botLink: buildBotBindLink(botUsername, code)
		};
	},

	async setPushEnabled(c, enabled) {
		const userId = userContext.getUserId(c);
		if (await accessControlService.isRootAdmin(c)) {
			await this.ensureRootAuthorization(c, userId);
		}
		const config = await this.get(c, userId);
		if (!config.authorized || !config.chatId) {
			throw new BizError('Bind Telegram before enabling push', 403);
		}
		await orm(c).update(userTelegram).set({
			pushEnabled: enabled ? 1 : 0,
			updatedAt: new Date().toISOString()
		}).where(eq(userTelegram.userId, userId)).run();
		return this.get(c, userId);
	},

	async unbind(c) {
		const userId = userContext.getUserId(c);
		await orm(c).update(userTelegram).set({
			pushEnabled: 0,
			chatId: '',
			chatUsername: '',
			boundAt: null,
			updatedAt: new Date().toISOString()
		}).where(eq(userTelegram.userId, userId)).run();
		return this.get(c, userId);
	},

	async consumeBinding(c, code, chat) {
		const codeHash = await hashCode(code);
		const binding = await orm(c).select().from(telegramBinding).where(eq(telegramBinding.codeHash, codeHash)).get();
		if (!binding) return { ok: false, reason: 'invalid' };
		if (!(binding.expiresAt > new Date().toISOString())) {
			await orm(c).delete(telegramBinding).where(eq(telegramBinding.codeHash, codeHash)).run();
			return { ok: false, reason: 'expired' };
		}

		const owner = await orm(c).select().from(user).where(eq(user.userId, binding.userId)).get();
		if (!owner || owner.isDel !== isDel.NORMAL || owner.status !== userConst.status.NORMAL) {
			return { ok: false, reason: 'unauthorized' };
		}

		const configRow = await orm(c).select().from(userTelegram).where(eq(userTelegram.userId, binding.userId)).get();
		const isRoot = adminUtils.isAdminUser(owner, c.env.admin);
		const authorized = Number(configRow?.authorized) === 1 || isRoot;
		if (!authorized) {
			return { ok: false, reason: 'unauthorized' };
		}

		await orm(c).insert(userTelegram).values({
			userId: binding.userId,
			authorized: 1,
			chatId: String(chat.id),
			chatUsername: chat.username || '',
			boundAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}).onConflictDoUpdate({
			target: userTelegram.userId,
			set: {
				authorized: 1,
				chatId: String(chat.id),
				chatUsername: chat.username || '',
				boundAt: new Date().toISOString(),
				pushEnabled: 0,
				updatedAt: new Date().toISOString()
			}
		}).run();
		await orm(c).delete(telegramBinding).where(eq(telegramBinding.codeHash, codeHash)).run();
		return { ok: true, userId: binding.userId };
	},

	async recipient(c, userId) {
		return orm(c).select({ chatId: userTelegram.chatId }).from(userTelegram)
			.where(and(eq(userTelegram.userId, userId), eq(userTelegram.authorized, 1), eq(userTelegram.pushEnabled, 1)))
			.get();
	}
};

export default userTelegramService;
