const adminUtils = {
	normalizeEmail(email) {
		return typeof email === 'string' ? email.trim().toLowerCase() : '';
	},

	isAdminEmail(email, configuredAdmin) {
		const normalizedAdmin = this.normalizeEmail(configuredAdmin);
		return normalizedAdmin !== '' && this.normalizeEmail(email) === normalizedAdmin;
	},

	isAdminUser(user, configuredAdmin) {
		return Number(user?.type) === 0 && this.isAdminEmail(user?.email, configuredAdmin);
	}
};

export default adminUtils;
