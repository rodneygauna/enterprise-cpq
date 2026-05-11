/**
 * Role-based access control middleware factory.
 *
 * Usage:  router.get('/admin', authenticate, requireRole(['admin', 'super_admin']), handler)
 *
 * Role hierarchy (highest → lowest):
 *   super_admin > admin > executive > sales_manager > sales_rep
 */
const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ data: null, error: "Forbidden", meta: null });
  }
  return next();
};

module.exports = { requireRole };
