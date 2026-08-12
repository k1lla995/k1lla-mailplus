import BizError from '../error/biz-error';
import userService from './user-service';
import emailUtils from '../utils/email-utils';
import { isDel, settingConst, userConst } from '../const/entity-const';
import JwtUtils from '../utils/jwt-utils';
import { v4 as uuidv4 } from 'uuid';
import KvConst from '../const/kv-const';
import constant from '../const/constant';
import userContext from '../security/user-context';
import verifyUtils from '../utils/verify-utils';
import accountService from './account-service';
import settingService from './setting-service';
import saltHashUtils from '../utils/crypto-utils';
import cryptoUtils from '../utils/crypto-utils';
import turnstileService from './turnstile-service';
import roleService from './role-service';
import regKeyService from './reg-key-service';
import dayjs from 'dayjs';
import { toUtc } from '../utils/date-uitil';
import { t } from '../i18n/i18n.js';
import verifyRecordService from './verify-record-service';
import adminUtils from '../utils/admin-utils';

const loginService = {

	async register(c, params) {
		const { email, password, token, code } = params;
		let { regKey, register, registerVerify, regVerifyCount, minEmailPrefix, emailPrefixFilter } = await settingService.query(c);
		emailPrefixFilter = Array.isArray(emailPrefixFilter)
			? emailPrefixFilter
			: String(emailPrefixFilter || '').split(',').filter(Boolean);

		if (register === settingConst.register.CLOSE) {
			throw new BizError(t('regDisabled'));
		}

		if (!verifyUtils.isEmail(email)) {
			throw new BizError(t('notEmail'));
		}

		if (adminUtils.isAdminEmail(email, c.env.admin)) {
			throw new BizError(t('adminEmailReserved'), 403);
		}

		const emailName = emailUtils.getName(email);
		if (emailName.length < minEmailPrefix) {
			throw new BizError(t('minEmailPrefix', { msg: minEmailPrefix }));
		}

		if (emailPrefixFilter.some(content => emailName.includes(content))) {
			throw new BizError(t('banEmailPrefix'));
		}

		if (emailName.length > 64) {
			throw new BizError(t('emailLengthLimit'));
		}

		if (typeof password !== 'string' || password.length > 30) {
			throw new BizError(t('pwdLengthLimit'));
		}

		if (password.length < 6) {
			throw new BizError(t('pwdMinLength'));
		}

		if (!c.env.domain.includes(emailUtils.getDomain(email))) {
			throw new BizError(t('notEmailDomain'));
		}

		let type = null;
		let regKeyId = 0;
		if (regKey === settingConst.regKey.OPEN) {
			const result = await this.handleOpenRegKey(c, code);
			type = result.type;
			regKeyId = result.regKeyId;
		} else if (regKey === settingConst.regKey.OPTIONAL) {
			const result = await this.handleOptionalRegKey(c, code);
			type = result?.type ?? null;
			regKeyId = result?.regKeyId ?? 0;
		}

		const accountRow = await accountService.selectByEmailIncludeDel(c, email);
		if (accountRow?.isDel === isDel.DELETE) {
			throw new BizError(t('isDelUser'));
		}
		if (accountRow) {
			throw new BizError(t('isRegAccount'));
		}

		const defaultRole = type ? null : await roleService.selectDefaultRole(c);
		const roleId = type || defaultRole?.roleId;
		const roleRow = await roleService.selectById(c, roleId);
		if (!roleRow || !roleService.hasAvailDomainPerm(roleRow.availDomain, email)) {
			throw new BizError(t(type ? 'noDomainPermRegKey' : 'noDomainPermReg'), 403);
		}

		let regVerifyOpen = false;
		if (registerVerify === settingConst.registerVerify.OPEN) {
			regVerifyOpen = true;
			await turnstileService.verify(c, token);
		} else if (registerVerify === settingConst.registerVerify.COUNT) {
			regVerifyOpen = await verifyRecordService.isOpenRegVerify(c, regVerifyCount);
			if (regVerifyOpen) {
				await turnstileService.verify(c, token);
			}
		}

		const { salt, hash } = await saltHashUtils.hashPassword(password);
		const userId = await userService.insert(c, { email, regKeyId, password: hash, salt, type: roleId });
		await accountService.insert(c, { userId, email, name: emailName });
		await userService.updateUserInfo(c, userId, true);

		if (type) {
			await regKeyService.reduceCount(c, code, 1);
		}

		if (registerVerify === settingConst.registerVerify.COUNT && !regVerifyOpen) {
			const row = await verifyRecordService.increaseRegCount(c);
			return { regVerifyOpen: row.count >= regVerifyCount };
		}

		return { regVerifyOpen };
	},

	async bootstrapAdmin(c) {
		const email = adminUtils.normalizeEmail(c.env.admin);

		if (!verifyUtils.isEmail(email)) {
			throw new BizError(t('adminNotConfigured'));
		}

		const userRow = await userService.selectByEmailIncludeDel(c, email);

		if (adminUtils.isAdminUser(userRow, c.env.admin)) {
			if (userRow.uid !== '0000') {
				await userService.assignRootAdminUid(c, userRow.userId);
				await userService.markAdmin(c, userRow.userId);
			}
			return { created: false, temporaryPassword: null };
		}

		const password = cryptoUtils.genRandomPwd(24);

		if (userRow) {
			await userService.recoverAdmin(c, userRow.userId, password);
		} else {
			await this.createAdministrator(c, email, password);
		}

		return { created: true, temporaryPassword: password };
	},

	async createAdministrator(c, email, password) {
		const { salt, hash } = await saltHashUtils.hashPassword(password);
		const userId = await userService.insert(c, {
			email,
			password: hash,
			salt,
			type: 0,
			uid: '0000'
		});

		await accountService.insert(c, { userId, email, name: email.split('@')[0] });
		await userService.updateUserInfo(c, userId, true);
		return userId;
	},

	async handleOpenRegKey(c, code) {
		if (!code) {
			throw new BizError(t('emptyRegKey'));
		}

		const regKeyRow = await regKeyService.selectByCode(c, code);
		if (!regKeyRow) {
			throw new BizError(t('notExistRegKey'));
		}
		if (regKeyRow.count <= 0) {
			throw new BizError(t('noRegKeyCount'));
		}
		if (toUtc(regKeyRow.expireTime).tz('Asia/Shanghai').startOf('day').isBefore(toUtc().tz('Asia/Shanghai').startOf('day'))) {
			throw new BizError(t('regKeyExpire'));
		}

		return { type: regKeyRow.roleId, regKeyId: regKeyRow.regKeyId };
	},

	async handleOptionalRegKey(c, code) {
		if (!code) return null;

		const regKeyRow = await regKeyService.selectByCode(c, code);
		if (!regKeyRow || regKeyRow.count <= 0) return null;
		if (toUtc(regKeyRow.expireTime).tz('Asia/Shanghai').startOf('day').isBefore(toUtc().tz('Asia/Shanghai').startOf('day'))) {
			return null;
		}

		return { type: regKeyRow.roleId, regKeyId: regKeyRow.regKeyId };
	},

	async login(c, params, noVerifyPwd = false) {

		const { email, password, token } = params;

		if ((!email || !password) && !noVerifyPwd) {
			throw new BizError(t('emailAndPwdEmpty'));
		}

		const { loginVerify, loginVerifyCount } = await settingService.query(c);
		if (!noVerifyPwd && loginVerify === settingConst.registerVerify.OPEN) {
			await turnstileService.verify(c, token);
		}
		if (!noVerifyPwd && loginVerify === settingConst.registerVerify.COUNT &&
			await verifyRecordService.isOpenLoginVerify(c, loginVerifyCount)) {
			await turnstileService.verify(c, token);
		}

		const userRow = await userService.selectByEmailIncludeDel(c, email);

		if (!userRow) {
			await verifyRecordService.increaseLoginCount(c);
			throw new BizError(t('notExistUser'));
		}

		if(userRow.isDel === isDel.DELETE) {
			throw new BizError(t('isDelUser'));
		}

		if(userRow.status === userConst.status.BAN) {
			throw new BizError(t('isBanUser'));
		}

		if (!await cryptoUtils.verifyPassword(password, userRow.salt, userRow.password) && !noVerifyPwd) {
			await verifyRecordService.increaseLoginCount(c);
			throw new BizError(t('IncorrectPwd'));
		}

		if (!noVerifyPwd) {
			await verifyRecordService.clearLoginCount(c);
		}

		const uuid = uuidv4();
		const jwt = await JwtUtils.generateToken(c,{ userId: userRow.userId, token: uuid });

		let authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userRow.userId, { type: 'json' });

		if (authInfo && (authInfo.user.email === userRow.email)) {

			if (authInfo.tokens.length > 10) {
				authInfo.tokens.shift();
			}

			authInfo.tokens.push(uuid);

		} else {

			authInfo = {
				tokens: [],
				user: userRow,
				refreshTime: dayjs().toISOString()
			};

			authInfo.tokens.push(uuid);

		}

		await userService.updateUserInfo(c, userRow.userId);

		await c.env.kv.put(KvConst.AUTH_INFO + userRow.userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
		return jwt;
	},

	async logout(c, userId) {
		const token =userContext.getToken(c);
		const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });
		const index = authInfo.tokens.findIndex(item => item === token);
		authInfo.tokens.splice(index, 1);
		await c.env.kv.put(KvConst.AUTH_INFO + userId, JSON.stringify(authInfo));
	}

};

export default loginService;
