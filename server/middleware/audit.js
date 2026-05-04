const AuditLog = require('../models/AuditLog');

const audit = (action, resource) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = async (data) => {
    try {
      await AuditLog.create({
        user: req.user ? req.user._id : null,
        username: req.user ? req.user.username : 'anonymous',
        action,
        resource,
        resourceId: req.params.id || null,
        details: { body: req.body, query: req.query },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        success: res.statusCode < 400
      });
    } catch (err) {
      console.error('Audit log error:', err.message);
    }
    return originalJson(data);
  };
  next();
};

module.exports = audit;
