import BizError from '../error/biz-error';
import userService from './user-service';
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
import dayjs from 'dayjs';
import { t } from '../i18n/i18n.js';
import verifyRecordService from './verify-record-service';
import adminUtils from '../utils/admin-utils';

const loginService = {

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
