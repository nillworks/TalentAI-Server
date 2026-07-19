import { createRemoteJWKSet, jwtVerify } from 'jose';
import { sendError } from '../utils/response';
import { ObjectId } from 'mongodb';
let jwks = null;
const getJWKS = () => {
    if (!jwks) {
        jwks = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
    }
    return jwks;
};
let userCollectionRef = null;
export const setUserCollection = (collection) => {
    userCollectionRef = collection;
};
export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return sendError(res, 'Unauthorized', 401);
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return sendError(res, 'Unauthorized', 401);
    }
    try {
        const { payload } = await jwtVerify(token, getJWKS());
        req.user = payload;
        if (userCollectionRef && req.user?.sub) {
            const user = await userCollectionRef.findOne({ _id: new ObjectId(req.user.sub) });
            if (user?.isBlocked) {
                return sendError(res, 'Account blocked. Contact admin.', 403);
            }
            if (user?.role) {
                req.user.role = user.role;
            }
            if (user?.plan) {
                req.user.plan = user.plan;
            }
        }
        next();
    }
    catch {
        return sendError(res, 'Unauthorized', 401);
    }
};
export const requireRole = (...roles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !roles.includes(user.role)) {
            return sendError(res, 'Forbidden', 403);
        }
        next();
    };
};
