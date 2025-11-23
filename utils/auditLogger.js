import AuditLog from '../models/auditLogModel.js';

/**
 * Create audit log entry
 */
export const createAuditLog = async (actor, action, details = {}, target = null, req = null) => {
    try {
        const auditData = {
            actor: actor._id || actor,
            actorEmail: actor.email || actor.actorEmail,
            action,
            details,
            timestamp: new Date()
        };

        if (target) {
            auditData.target = target._id || target;
            auditData.targetEmail = target.email || target.targetEmail;
        }

        if (req) {
            auditData.ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            auditData.userAgent = req.headers['user-agent'];
        }

        await AuditLog.create(auditData);
    } catch (error) {
        console.error("Audit Log Error:", error.message);
        // Don't throw error - audit logging should not break the main flow
    }
};

/**
 * Get audit logs with filters
 */
export const getAuditLogs = async (filters = {}, page = 1, limit = 50) => {
    try {
        const skip = (page - 1) * limit;
        const logs = await AuditLog.find(filters)
            .populate('actor', 'name email')
            .populate('target', 'name email')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await AuditLog.countDocuments(filters);

        return {
            logs,
            total,
            page,
            pages: Math.ceil(total / limit)
        };
    } catch (error) {
        console.error("Get Audit Logs Error:", error.message);
        throw error;
    }
};

